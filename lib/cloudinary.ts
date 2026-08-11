import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const ALLOWED_UPLOAD_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "zip",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "txt",
  "md",
];

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB

export function sanitizeFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.slice(-150); // keep it short
}

export function getExtension(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

/**
 * Upload a base64-encoded (data URI) file buffer to Cloudinary under a
 * folder scoped by purpose. Server-side only — never expose api_secret to
 * the client. Validates extension + size before sending upstream.
 */
export async function uploadToCloudinary(
  dataUri: string,
  opts: { folder: string; filename: string; bytes: number }
): Promise<{ url: string; publicId: string }> {
  const ext = getExtension(opts.filename);
  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
    throw new Error(`File type ".${ext}" is not allowed.`);
  }
  if (opts.bytes > MAX_UPLOAD_BYTES) {
    throw new Error("File exceeds the 20MB size limit.");
  }

  const safeName = sanitizeFilename(opts.filename);
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: `dtan-learn/${opts.folder}`,
    public_id: `${Date.now()}-${safeName}`.replace(/\.[^.]+$/, ""),
    resource_type: "auto",
    overwrite: false,
  });

  return { url: result.secure_url, publicId: result.public_id };
}

export default cloudinary;
