import path from "path";
import dns from "dns";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// See scripts/seed.ts for why this is needed on some Windows setups.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import mongoose from "mongoose";

/**
 * One-off migration for the "late"/"excused" -> "present"/"absent" +
 * isLate status collapse. Run once after deploying the new Attendance
 * schema, before any new attendance writes use the narrowed enum.
 *  - "late"    -> status "present", isLate: true (it already meant "attended,
 *                 but joined after the window or fell short on duration" —
 *                 the closest fit here is "attended late", noted rather than
 *                 penalized)
 *  - "excused" -> status "present" (an excused absence isn't held against
 *                 the student, same intent as a manual "present" override)
 */
async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Add it to .env.local before running this migration.");
    process.exit(1);
  }

  console.log(`Connecting to ${uri}...`);
  await mongoose.connect(uri, { dbName: "DTAN-Learn" });

  const db = mongoose.connection.db!;
  // Mongoose pluralizes the "Attendance" / "AttendanceAuditLog" model names
  // into these collection names (no explicit `collection` option on either
  // schema), so the raw driver calls below must use the pluralized forms.
  const attendance = db.collection("attendances");
  const auditLogs = db.collection("attendanceauditlogs");

  const lateResult = await attendance.updateMany(
    { status: "late" },
    { $set: { status: "present", isLate: true } }
  );
  console.log(`"late" -> "present" (isLate: true): ${lateResult.modifiedCount} record(s) updated.`);

  const excusedResult = await attendance.updateMany(
    { status: "excused" },
    { $set: { status: "present", isLate: false } }
  );
  console.log(`"excused" -> "present": ${excusedResult.modifiedCount} record(s) updated.`);

  // Backfill the new isLate flag on every record that predates it so the
  // field is always present (present/absent records were never late).
  const backfillResult = await attendance.updateMany(
    { isLate: { $exists: false } },
    { $set: { isLate: false } }
  );
  console.log(`isLate backfilled to false on ${backfillResult.modifiedCount} older record(s).`);

  const auditLateResult = await auditLogs.updateMany({ previousStatus: "late" }, { $set: { previousStatus: "present" } });
  const auditLateResult2 = await auditLogs.updateMany({ newStatus: "late" }, { $set: { newStatus: "present" } });
  const auditExcusedResult = await auditLogs.updateMany({ previousStatus: "excused" }, { $set: { previousStatus: "present" } });
  const auditExcusedResult2 = await auditLogs.updateMany({ newStatus: "excused" }, { $set: { newStatus: "present" } });
  console.log(
    `Audit log entries updated: ${
      auditLateResult.modifiedCount + auditLateResult2.modifiedCount + auditExcusedResult.modifiedCount + auditExcusedResult2.modifiedCount
    }`
  );

  await mongoose.disconnect();
  console.log("Done.");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
