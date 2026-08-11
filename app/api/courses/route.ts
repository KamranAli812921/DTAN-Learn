import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Course } from "@/models";
import { courseSchema } from "@/lib/validators/academic";
import { requireRole, requireSession, withErrorHandling } from "@/lib/api-helpers";

// GET: any authenticated role may list courses (students/teachers need it for
// dropdowns and their own course view); only admin can create.
export const GET = withErrorHandling(async () => {
  await requireSession();
  await connectDB();
  const courses = await Course.find().sort({ createdAt: -1 });
  return NextResponse.json(courses);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  await requireRole("admin");
  await connectDB();
  const body = await req.json();
  const data = courseSchema.parse(body);
  const course = await Course.create(data);
  return NextResponse.json(course, { status: 201 });
});
