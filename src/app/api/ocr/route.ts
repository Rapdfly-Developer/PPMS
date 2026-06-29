import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { recognizeText, extractFields } from "@/lib/ocr";
import { writeFile, unlink, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "uploads");
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const MAX_SIZE = 15 * 1024 * 1024; // 15MB

export async function POST(req: NextRequest) {
  await requireRole("DOCTOR", "HOSPITAL");

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported file type. Upload an image (PNG/JPEG/WebP) or PDF." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 15MB)." }, { status: 400 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const ext = path.extname(file.name) || ".png";
  const tempPath = path.join(UPLOAD_DIR, `${crypto.randomUUID()}${ext}`);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(tempPath, buffer);

    const rawText = await recognizeText(tempPath);
    const fields = extractFields(rawText);

    return NextResponse.json({ originalFileName: file.name, ...fields });
  } catch (err) {
    console.error("OCR processing failed:", err);
    return NextResponse.json({ error: "OCR processing failed. Please try a clearer scan." }, { status: 500 });
  } finally {
    // Always clean up the temp upload, even if OCR failed.
    await unlink(tempPath).catch(() => {});
  }
}
