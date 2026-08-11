import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { User } from "@/models";
import { changeAccountStatusSchema } from "@/lib/validators/user";
import { requireRole, ApiError, withErrorHandling } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/permissions";

async function assertNotLastActiveAdmin(id: string) {
  const activeCount = await User.countDocuments({ role: "admin", status: "active", _id: { $ne: id } });
  if (activeCount === 0) {
    throw new ApiError(400, "Cannot deactivate the last remaining admin account.");
  }
}

export const PATCH = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireRole("admin");
  await connectDB();
  if (!isValidObjectId(params.id)) throw new ApiError(400, "Invalid admin id.");
  if (params.id === session.user.id) throw new ApiError(400, "Use Change password to manage your own account.");

  const admin = await User.findOne({ _id: params.id, role: "admin" });
  if (!admin) throw new ApiError(404, "Admin not found.");

  const body = await req.json();
  const data = changeAccountStatusSchema.parse(body);

  if (data.status === "inactive") {
    await assertNotLastActiveAdmin(params.id);
  }

  admin.status = data.status;
  await admin.save();

  return NextResponse.json({ _id: admin._id, username: admin.username, email: admin.email, status: admin.status });
});

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireRole("admin");
  await connectDB();
  if (!isValidObjectId(params.id)) throw new ApiError(400, "Invalid admin id.");
  if (params.id === session.user.id) throw new ApiError(400, "Use Change password to manage your own account.");

  const admin = await User.findOne({ _id: params.id, role: "admin" });
  if (!admin) throw new ApiError(404, "Admin not found.");

  await assertNotLastActiveAdmin(params.id);

  // Soft-delete: deactivate rather than hard-deleting.
  admin.status = "inactive";
  await admin.save();

  return NextResponse.json({ message: "Admin account deactivated." });
});
