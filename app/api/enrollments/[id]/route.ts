import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Enrollment } from "@/models";
import { enrollmentSchema } from "@/lib/validators/academic";
import { requireRole, ApiError, withErrorHandling } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/permissions";

export const PATCH = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  await requireRole("admin");
  await connectDB();
  if (!isValidObjectId(params.id)) throw new ApiError(400, "Invalid enrollment id.");
  const body = await req.json();
  const data = enrollmentSchema.partial().parse(body);
  const enrollment = await Enrollment.findByIdAndUpdate(params.id, data, { new: true, runValidators: true });
  if (!enrollment) throw new ApiError(404, "Enrollment not found.");
  return NextResponse.json(enrollment);
});

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  await requireRole("admin");
  await connectDB();
  if (!isValidObjectId(params.id)) throw new ApiError(400, "Invalid enrollment id.");
  const enrollment = await Enrollment.findByIdAndUpdate(params.id, { status: "dropped" }, { new: true });
  if (!enrollment) throw new ApiError(404, "Enrollment not found.");
  return NextResponse.json(enrollment);
});
