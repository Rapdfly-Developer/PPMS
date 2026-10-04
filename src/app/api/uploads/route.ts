import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
import { canRecordRefraction } from "@/lib/refraction-access";
import { storeUpload, UPLOAD_TYPES } from "@/lib/file-storage";
import { fileHref } from "@/lib/file-href";

const MAX_SIZE = 15 * 1024 * 1024;

/**
 * POST /api/uploads — investigation results, AR slips, external visit scans
 * (clinical, private) and, with kind=branding, hospital logos and doctor
 * signatures (public, because PDFs load them by URL).
 *
 * Returns { url } — the stored reference to save on the record — and
 * { href }, the address the browser may open it at.
 */
export async function POST(req: NextRequest) {
  // Staff recording refraction attach AR slips, so they may upload too.
  const user = await requireUser();
  if (user.role !== "DOCTOR" && user.role !== "HOSPITAL" && !canRecordRefraction(user)) {
    return NextResponse.json({ error: "You do not have permission to upload files." }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const kind = formData.get("kind") === "branding" ? "branding" : "clinical";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!UPLOAD_TYPES[file.type]) {
    return NextResponse.json({ error: "Unsupported file type. Upload PNG, JPEG, WebP or PDF." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 15 MB)." }, { status: 400 });
  }

  const url = await storeUpload(file, kind, user.id);
  return NextResponse.json({ url, href: kind === "branding" ? url : fileHref(url), filename: file.name });
}
