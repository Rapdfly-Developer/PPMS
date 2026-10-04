import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { patientRecordScope } from "@/lib/patient-access";

type Params = { params: Promise<{ udid: string }> };

// GET — fetch current consent status for a patient
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  const { udid } = await params;

  const scope = await patientRecordScope(user);
  const patient = scope && await prisma.patient.findFirst({
    where: { AND: [{ OR: [{ udid }, { uhid: udid }] }, scope] },
    select: { id: true, registeredAtId: true },
  });
  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const latest = await prisma.patientConsent.findFirst({
    where: { patientId: patient.id, purpose: "TREATMENT" },
    orderBy: { consentedAt: "desc" },
    select: { status: true, consentedAt: true, withdrawnAt: true, noticeText: true },
  });

  return NextResponse.json({ consent: latest ?? null });
}

// POST — record a new consent event (grant or withdrawal)
export async function POST(req: NextRequest, { params }: Params) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  const { udid } = await params;

  const body = await req.json();
  const { status, purpose = "TREATMENT", method = "ELECTRONIC", noticeText } = body as {
    status: "GRANTED" | "WITHDRAWN";
    purpose?: string;
    method?: string;
    noticeText?: string;
  };

  if (status !== "GRANTED" && status !== "WITHDRAWN") {
    return NextResponse.json({ error: "status must be GRANTED or WITHDRAWN" }, { status: 400 });
  }

  const scope = await patientRecordScope(user);
  const patient = scope && await prisma.patient.findFirst({
    where: { AND: [{ OR: [{ udid }, { uhid: udid }] }, scope] },
    select: { id: true, registeredAtId: true },
  });
  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const consent = await prisma.patientConsent.create({
    data: {
      patientId:   patient.id,
      purpose,
      method,
      status,
      noticeText,
      capturedBy:  user.id,
      withdrawnAt: status === "WITHDRAWN" ? new Date() : null,
    },
  });

  return NextResponse.json({ consent }, { status: 201 });
}
