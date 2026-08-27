import path from "path";
import dns from "dns";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// See scripts/seed.ts for why this is needed on some Windows setups.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import mongoose from "mongoose";

/**
 * One-off migration for the "attendance keyed per live class" change.
 *
 * Attendance used to be one record per student per batch per DAY. A batch can
 * run several live classes on the same day, so the record is now keyed by the
 * live class it belongs to. This script:
 *
 *  1. Drops the old unique index {student, batch, date} and creates the new
 *     {student, liveClass, date} unique index (+ a {batch, date} helper).
 *  2. For every record tied to a live class, recomputes:
 *       - each session's durationMinutes  -> minutes that overlap the class
 *         window [startTime, startTime + durationMinutes]
 *       - totalDurationMinutes            -> sum of the above, capped at the
 *         class length
 *       - status                          -> present iff attended >= 70% of
 *         the class, else absent
 *       - isLate                          -> first join was after
 *         startTime + joinWindowMinutes (a genuine late arrival, not the old
 *         "attended too little" meaning the previous migration assumed)
 *  3. Records with no live class (manual marks / grace on a day with nothing
 *     scheduled) are left as-is except isLate is forced to false.
 *
 * Idempotent: running it twice produces the same result.
 */

const DRY_RUN = process.argv.includes("--dry-run");

function classWindowMinutes(
  joinTime: Date,
  leaveTime: Date | null | undefined,
  lc: { startTime: Date; durationMinutes: number }
): number {
  const classStart = new Date(lc.startTime).getTime();
  const classEnd = classStart + lc.durationMinutes * 60_000;
  const start = Math.max(new Date(joinTime).getTime(), classStart);
  const end = Math.min((leaveTime ? new Date(leaveTime).getTime() : Date.now()), classEnd);
  return Math.max(0, Math.round((end - start) / 60_000));
}

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Add it to .env.local before running this migration.");
    process.exit(1);
  }

  console.log(`Connecting to ${uri}...${DRY_RUN ? "  (DRY RUN — no writes)" : ""}`);
  await mongoose.connect(uri, { dbName: "DTAN-Learn" });

  const db = mongoose.connection.db!;
  const attendances = db.collection("attendances");
  const liveClasses = db.collection("liveclasses");

  // --- 1. indexes ---------------------------------------------------------
  const indexes = await attendances.indexes();
  const oldIdx = indexes.find((i) => i.name === "student_1_batch_1_date_1");
  if (oldIdx) {
    console.log(`Dropping old index ${oldIdx.name}${DRY_RUN ? " (skipped)" : ""}`);
    if (!DRY_RUN) await attendances.dropIndex(oldIdx.name!);
  }
  if (!DRY_RUN) {
    await attendances.createIndex({ student: 1, liveClass: 1, date: 1 }, { unique: true });
    await attendances.createIndex({ batch: 1, date: 1 });
    console.log("Created {student, liveClass, date} (unique) and {batch, date} indexes.");
  }

  // --- 2. recompute records ---------------------------------------------
  const lcCache = new Map<string, any>();
  async function getLiveClass(id: any) {
    const key = String(id);
    if (!lcCache.has(key)) lcCache.set(key, await liveClasses.findOne({ _id: new mongoose.Types.ObjectId(key) }));
    return lcCache.get(key);
  }

  const all = await attendances.find({}).toArray();
  let recomputed = 0;
  let statusFlips = 0;
  let lateFlips = 0;

  for (const a of all) {
    let lc = a.liveClass ? await getLiveClass(a.liveClass) : null;

    // No liveClass on the record: try to attach one if exactly one class ran
    // for this batch on this day and the record's sessions fall in its window.
    if (!lc) {
      const day = new Date(a.date); day.setUTCHours(0, 0, 0, 0);
      const next = new Date(day); next.setUTCDate(next.getUTCDate() + 1);
      const sameDay = await liveClasses.find({ batch: a.batch, startTime: { $gte: day, $lt: next } }).toArray();
      if (sameDay.length === 1) lc = sameDay[0];
    }

    const sessions = (a.sessions ?? []) as any[];
    const set: Record<string, unknown> = {};

    if (lc) {
      const newSessions = sessions.map((s) => ({
        ...s,
        durationMinutes: s.leaveTime ? classWindowMinutes(s.joinTime, s.leaveTime, lc) : (s.durationMinutes || 0),
      }));
      const total = Math.min(
        newSessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0),
        lc.durationMinutes
      );
      const newStatus = !newSessions.length ? "absent" : total >= 0.7 * lc.durationMinutes ? "present" : "absent";

      let isLate = false;
      if (newSessions.length) {
        const firstJoin = newSessions.reduce(
          (earliest, s) => (new Date(s.joinTime) < earliest ? new Date(s.joinTime) : earliest),
          new Date(newSessions[0].joinTime)
        );
        const windowEnd = new Date(new Date(lc.startTime).getTime() + (lc.joinWindowMinutes ?? 0) * 60_000);
        isLate = firstJoin.getTime() > windowEnd.getTime();
      }

      if (a.status !== newStatus) statusFlips++;
      if (Boolean(a.isLate) !== isLate) lateFlips++;

      set.sessions = newSessions;
      set.totalDurationMinutes = total;
      set.status = newStatus;
      set.isLate = isLate;
      if (!a.liveClass) set.liveClass = lc._id;

      console.log(
        `  ${new Date(a.date).toISOString().slice(0, 10)} student=${a.student} "${lc.topic}" ` +
          `${a.status}->${newStatus}  isLate ${Boolean(a.isLate)}->${isLate}  total ${a.totalDurationMinutes}->${total}m`
      );
    } else {
      if (a.isLate) { set.isLate = false; lateFlips++; console.log(`  ${new Date(a.date).toISOString().slice(0, 10)} student=${a.student} (no class) isLate ${a.isLate}->false`); }
    }

    if (Object.keys(set).length && !DRY_RUN) {
      await attendances.updateOne({ _id: a._id }, { $set: set });
    }
    if (Object.keys(set).length) recomputed++;
  }

  console.log(`\n${recomputed} record(s) ${DRY_RUN ? "would be" : ""} updated  (${statusFlips} status change(s), ${lateFlips} isLate change(s)).`);

  await mongoose.disconnect();
  console.log("Done.");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
