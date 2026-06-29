import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "past-visits");
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(req: NextRequest) {
  await requireRole("DOCTOR", "HOSPITAL");

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported file type. Upload PNG, JPEG, WebP or PDF." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 20 MB)." }, { status: 400 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const ext = path.extname(file.name) || ".bin";
  const savedName = `${crypto.randomUUID()}${ext}`;
  const savedPath = path.join(UPLOAD_DIR, savedName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(savedPath, buffer);

  return NextResponse.json({
    savedName,
    originalFileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  });
}
