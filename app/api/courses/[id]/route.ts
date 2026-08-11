import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Course } from "@/models";
import { courseSchema } from "@/lib/validators/academic";
import { requireRole, requireSession, ApiError, withErrorHandling } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/permissions";

export const GET = withErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  await requireSession();
  await connectDB();
  if (!isValidObjectId(params.id)) throw new ApiError(400, "Invalid course id.");
  const course = await Course.findById(params.id);
  if (!course) throw new ApiError(404, "Course not found.");
  return NextResponse.json(course);
});

export const PATCH = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  await requireRole("admin");
  await connectDB();
  if (!isValidObjectId(params.id)) throw new ApiError(400, "Invalid course id.");
  const body = await req.json();
  const data = courseSchema.partial().parse(body);
  const course = await Course.findByIdAndUpdate(params.id, data, { new: true, runValidators: true });
  if (!course) throw new ApiError(404, "Course not found.");
  return NextResponse.json(course);
});

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  await requireRole("admin");
  await connectDB();
  if (!isValidObjectId(params.id)) throw new ApiError(400, "Invalid course id.");
  // Soft-delete per spec 8 — prefer deactivation over hard delete.
  const course = await Course.findByIdAndUpdate(params.id, { status: "inactive" }, { new: true });
  if (!course) throw new ApiError(404, "Course not found.");
  return NextResponse.json(course);
});
