import path from "path";
import dns from "dns";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import mongoose from "mongoose";

/**
 * Read-only diagnostic for "admin uploaded a study material but the student
 * can't see it". The student materials list is filtered server-side by the
 * student's OWN batch (app/api/materials/route.ts), so a material only shows
 * if material.batch === student.batch. This script prints every material and
 * every student's batch so a mismatch is obvious.
 *
 *   npx tsx scripts/diagnose-materials.ts
 *   npx tsx scripts/diagnose-materials.ts student@email.com   # focus one student
 */

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Add it to .env.local.");
    process.exit(1);
  }
  await mongoose.connect(uri, { dbName: "DTAN-Learn" });
  const db = mongoose.connection.db!;

  const focusEmail = process.argv[2]?.toLowerCase();

  const batches = await db.collection("batches").find({}).toArray();
  const courses = await db.collection("courses").find({}).toArray();
  const users = await db.collection("users").find({}).toArray();
  const batchName = (id: any) => batches.find((b) => String(b._id) === String(id))?.batchName ?? `??(${id})`;
  const courseName = (id: any) => courses.find((c) => String(c._id) === String(id))?.courseCode ?? `??(${id})`;

  const materials = await db.collection("materials").find({}).sort({ createdAt: -1 }).toArray();
  const sees = (m: any, s: any) =>
    m.targetType === "course" ? String(m.course) === String(s.course) : String(m.batch) === String(s.batch);
  console.log(`\n=== MATERIALS (${materials.length}) ===`);
  for (const m of materials) {
    const scope = m.targetType === "course" ? `course-wide (${courseName(m.course)})` : `batch ${batchName(m.batch)}`;
    console.log(
      `- "${m.title}"  scope=${scope}  targetType=${m.targetType ?? "(unset — legacy)"}  ` +
        `fileUrl=${m.fileUrl ? "set" : "MISSING"}  created=${m.createdAt?.toISOString?.().slice(0, 10)}`
    );
  }

  const studentFilter: Record<string, unknown> = {};
  if (focusEmail) {
    const u = users.find((x) => x.email?.toLowerCase() === focusEmail);
    if (!u) {
      console.error(`\nNo user with email ${focusEmail}`);
      process.exit(1);
    }
    studentFilter.user = u._id;
  }
  const students = await db.collection("students").find(studentFilter).toArray();

  console.log(`\n=== STUDENTS (${students.length}) ===`);
  for (const s of students) {
    const u = users.find((x) => String(x._id) === String(s.user));
    const visible = materials.filter((m) => sees(m, s));
    console.log(
      `- ${s.fullName} <${u?.email ?? "?"}>  batch=${batchName(s.batch)}  course=${courseName(s.course)}  ` +
        `batchId=${s.batch}\n    materials visible to this student: ${visible.length}` +
        (visible.length ? `  (${visible.map((m) => `"${m.title}"`).join(", ")})` : "")
    );
  }

  // Materials no current student can see at all.
  const orphan = materials.filter((m) => !students.some((s) => sees(m, s)));
  if (orphan.length && !focusEmail) {
    console.log(`\n=== MATERIALS NO STUDENT CAN SEE (${orphan.length}) ===`);
    for (const m of orphan) {
      const scope = m.targetType === "course" ? `course ${courseName(m.course)}` : `batch ${batchName(m.batch)}`;
      console.log(`- "${m.title}"  ${scope}`);
    }
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
