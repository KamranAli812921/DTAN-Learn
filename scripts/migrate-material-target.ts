import path from "path";
import dns from "dns";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import mongoose from "mongoose";

/**
 * One-off migration for course-wide study materials.
 *
 * `Material` gained a `targetType` field ("batch" | "course"). Rows created
 * before this change have no `targetType`, and the student/teacher queries now
 * match on it explicitly, so those rows would silently stop showing. Backfill
 * every existing material as batch-scoped (its previous, only behaviour).
 *
 * Idempotent: running it twice is a no-op the second time.
 *
 *   npx tsx scripts/migrate-material-target.ts [--dry-run]
 */

const DRY_RUN = process.argv.includes("--dry-run");

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Add it to .env.local before running this migration.");
    process.exit(1);
  }

  console.log(`Connecting to ${uri}...${DRY_RUN ? "  (DRY RUN — no writes)" : ""}`);
  await mongoose.connect(uri, { dbName: "DTAN-Learn" });
  const materials = mongoose.connection.db!.collection("materials");

  const missing = await materials.countDocuments({ targetType: { $exists: false } });
  const noBatch = await materials.countDocuments({ targetType: { $exists: false }, batch: { $in: [null, undefined] } });
  console.log(`${missing} material(s) without targetType${noBatch ? ` (${noBatch} of them also have no batch — check these manually)` : ""}.`);

  if (!DRY_RUN && missing > 0) {
    const res = await materials.updateMany({ targetType: { $exists: false } }, { $set: { targetType: "batch" } });
    console.log(`Set targetType="batch" on ${res.modifiedCount} material(s).`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
