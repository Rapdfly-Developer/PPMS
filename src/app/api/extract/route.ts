import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
import { canRecordRefraction } from "@/lib/refraction-access";
import { UPLOAD_TYPES } from "@/lib/file-storage";
import { readDocument, visionConfigured } from "@/lib/extract/vision";
import { AR_PROMPT, buildArExtraction } from "@/lib/extract/ar";
import { buildImplantExtraction, implantPrompt } from "@/lib/extract/implant";

export const maxDuration = 60;

const MAX_SIZE = 15 * 1024 * 1024;

/**
 * POST /api/extract   multipart: file, kind = "ar" | "implant", group (implant only)
 *
 * Reads an AR slip or an implant label and returns the values found, checked
 * and cross-checked between the AI readers. It never saves anything: the form
 * fills itself from the answer and the clinician confirms.
 *
 * Same access as /api/uploads. The file is sent to the AI provider as is, with
 * no patient details added; the prompts tell the model to ignore names and IDs.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user.role !== "DOCTOR" && user.role !== "HOSPITAL" && !canRecordRefraction(user)) {
    return NextResponse.json({ error: "You do not have permission to read files." }, { status: 403 });
  }
  if (!visionConfigured()) {
    return NextResponse.json({ error: "Auto-fill is not set up (no AI key configured)." }, { status: 503 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const kind = form.get("kind");
  const group = typeof form.get("group") === "string" ? (form.get("group") as string) : "";
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (kind !== "ar" && kind !== "implant") return NextResponse.json({ error: "Unknown document kind" }, { status: 400 });
  if (!UPLOAD_TYPES[file.type]) return NextResponse.json({ error: "Auto-fill reads PNG, JPEG, WebP or PDF files." }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large (max 15 MB)." }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const prompt = kind === "ar" ? AR_PROMPT : implantPrompt(group || "OTHER");
  const reads = await readDocument(prompt, file.type, bytes);
  if (reads.length === 0) {
    return NextResponse.json({ error: "Could not read this file. Fill the values by hand." }, { status: 502 });
  }

  const data = reads.map((r) => r.data);
  const result = kind === "ar" ? buildArExtraction(data) : buildImplantExtraction(data, group || "OTHER");
  if (!result) {
    return NextResponse.json({ error: "No values could be read from this file. Fill the values by hand." }, { status: 422 });
  }
  return NextResponse.json({ kind, result });
}
