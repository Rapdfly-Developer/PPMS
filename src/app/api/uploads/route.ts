import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
import { canRecordRefraction } from "@/lib/refraction-access";
import crypto from "crypto";
import path from "path";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const MAX_SIZE = 15 * 1024 * 1024;

export async function POST(req: NextRequest) {
  // Staff recording refraction attach AR slips, so they may upload too.
  const user = await requireUser();
  if (user.role !== "DOCTOR" && user.role !== "HOSPITAL" && !canRecordRefraction(user)) {
    return NextResponse.json({ error: "You do not have permission to upload files." }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 15MB)." }, { status: 400 });
  }

  const ext = path.extname(file.name) || ".png";
  const filename = `${crypto.randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(filename, buffer, { access: "public", contentType: file.type });
    return NextResponse.json({ url: blob.url, filename });
  }

  // Local dev fallback — save to public/uploads/
  const { writeFile, mkdir } = await import("fs/promises");
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);
  return NextResponse.json({ url: `/uploads/${filename}`, filename });
}
