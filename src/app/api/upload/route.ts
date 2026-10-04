import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
import { storeUpload, UPLOAD_TYPES } from "@/lib/file-storage";
import { fileHref } from "@/lib/file-href";

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

/**
 * GET /api/upload?file=<name> — legacy local-development address; now goes
 * through the same access check as every other file.
 */
export async function GET(req: NextRequest) {
  const href = fileHref(req.nextUrl.searchParams.get("file"));
  if (!href) return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
  return NextResponse.redirect(new URL(href, req.nextUrl.origin));
}

/**
 * POST /api/upload — patient photos, Aadhaar scans and other clinical
 * documents. Always stored as clinical (private once the private store is
 * configured). `savedName` is the reference to save on the record.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser();

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!UPLOAD_TYPES[file.type]) {
    return NextResponse.json({ error: "Unsupported file type. Upload PNG, JPEG, WebP or PDF." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 20 MB)." }, { status: 400 });
  }

  const savedName = await storeUpload(file, "clinical", user.id);
  return NextResponse.json({
    savedName,
    href: fileHref(savedName),
    originalFileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  });
}
