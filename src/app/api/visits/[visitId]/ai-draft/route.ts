/**
 * POST /api/visits/:visitId/ai-draft
 *
 * Saves a doctor-confirmed AI-generated draft to the visit record.
 *
 * Authentication: NextAuth session cookie (NOT a plugin token).
 * Authorization:
 *   - doctorId, hospitalId derived from the authenticated session — never from request body
 *   - visit.doctorId must match the authenticated doctor
 *   - visit must belong to the doctor's hospital
 *
 * The Copilot sends PLUGIN_DRAFT_CONFIRMED via postMessage.
 * ExternalPluginSlotClient surfaces the draft for doctor review, then calls
 * this endpoint only after the doctor explicitly clicks "Save to EMR".
 *
 * Security invariants:
 *   - No pluginId, doctorId, tenantId, or token accepted from the request body
 *   - draftText is sanitised (trimmed, length-capped)
 *   - draftType is validated against the allowed enum
 *   - visitId in the URL is cross-checked against the authenticated doctor's record
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MAX_DRAFT_LENGTH = 10_000;
const ALLOWED_DRAFT_TYPES = ["consultation_note", "follow_up_summary"] as const;
type DraftType = (typeof ALLOWED_DRAFT_TYPES)[number];

function isDraftType(v: unknown): v is DraftType {
  return ALLOWED_DRAFT_TYPES.includes(v as DraftType);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ visitId: string }> },
) {
  const { visitId } = await params;

  // 1. Session auth — derive doctor identity server-side
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as {
    id: string;
    role: string;
    profileId: string;
    hospitalId?: string;
  };
  if (user.role !== "DOCTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const doctorId = user.profileId;
  const hospitalId = user.hospitalId ?? "";

  // 2. Parse and validate body — only draftText and draftType are accepted
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { draftType, draftText } = body as Record<string, unknown>;

  if (!isDraftType(draftType)) {
    return NextResponse.json(
      { error: `draftType must be one of: ${ALLOWED_DRAFT_TYPES.join(", ")}` },
      { status: 400 },
    );
  }
  if (typeof draftText !== "string" || !draftText.trim()) {
    return NextResponse.json({ error: "draftText must be a non-empty string" }, { status: 400 });
  }
  const sanitizedDraft = draftText.trim().slice(0, MAX_DRAFT_LENGTH);

  // 3. Verify the visit belongs to the authenticated doctor and their hospital
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: { id: true, doctorId: true, hospitalId: true, status: true },
  });
  if (!visit) {
    return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  }
  if (visit.doctorId !== doctorId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (hospitalId && visit.hospitalId !== hospitalId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 4. Write the confirmed AI draft — only after all auth checks pass
  await prisma.visit.update({
    where: { id: visitId },
    data: {
      aiDraftText: sanitizedDraft,
      aiDraftType: draftType,
      aiDraftConfirmedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, visitId, draftType });
}
