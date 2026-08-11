import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, ApiError, withErrorHandling } from "@/lib/api-helpers";
import { uploadToCloudinary } from "@/lib/cloudinary";

const ALLOWED_FOLDERS = ["assignments", "materials", "submissions", "avatars"] as const;

const uploadSchema = z.object({
  dataUri: z.string().startsWith("data:", "Expected a base64 data URI."),
  filename: z.string().min(1).max(255),
  bytes: z.number().int().positive(),
  folder: z.enum(ALLOWED_FOLDERS),
});

// Server-side upload proxy: the browser sends the file as a data URI, we
// validate type/size and forward to Cloudinary using the server-only API
// secret — the secret never reaches the client (spec 8).
export const POST = withErrorHandling(async (req: NextRequest) => {
  await requireSession();
  const body = await req.json();
  const data = uploadSchema.parse(body);

  try {
    const result = await uploadToCloudinary(data.dataUri, {
      folder: data.folder,
      filename: data.filename,
      bytes: data.bytes,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    throw new ApiError(400, err instanceof Error ? err.message : "Upload failed.");
  }
});
