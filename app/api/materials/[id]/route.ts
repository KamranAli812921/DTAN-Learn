import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Material } from "@/models";
import { requireRole, ApiError, withErrorHandling } from "@/lib/api-helpers";
import { isValidObjectId, getTeacherProfileId, assertTeacherOwnsBatch, assertTeacherOwnsCourse } from "@/lib/permissions";

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireRole("admin", "teacher");
  await connectDB();
  if (!isValidObjectId(params.id)) throw new ApiError(400, "Invalid material id.");

  const material = await Material.findById(params.id);
  if (!material) throw new ApiError(404, "Material not found.");

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    if (material.targetType === "batch" && material.batch) {
      await assertTeacherOwnsBatch(teacherId, material.batch.toString());
    } else {
      await assertTeacherOwnsCourse(teacherId, material.course.toString());
    }
  }

  await material.deleteOne();
  return NextResponse.json({ message: "Material deleted." });
});
