import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

// DPDP Act 2023, Sections 11-15 — Data principal rights.
// Patients (or staff on their behalf) submit requests; Grievance Officer resolves them.

const VALID_TYPES = ["ACCESS", "CORRECTION", "ERASURE", "NOMINATION", "GRIEVANCE"] as const;
type RequestType = (typeof VALID_TYPES)[number];

type Params = { params: Promise<{ udid: string }> };

// GET — list data rights requests for a patient
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  const { udid } = await params;

  const patient = await prisma.patient.findFirst({
    where: { OR: [{ udid }, { uhid: udid }] },
    select: { id: true, registeredAtId: true },
  });
  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.hospitalId && patient.registeredAtId !== user.hospitalId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requests = await prisma.dataRightsRequest.findMany({
    where: { patientId: patient.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, status: true, description: true, resolution: true, createdAt: true, resolvedAt: true },
  });

  return NextResponse.json({ requests });
}

// POST — submit a new data rights request
export async function POST(req: NextRequest, { params }: Params) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  const { udid } = await params;

  const body = await req.json();
  const { type, description } = body as { type: RequestType; description?: string };

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: `type must be one of: ${VALID_TYPES.join(", ")}` }, { status: 400 });
  }

  const patient = await prisma.patient.findFirst({
    where: { OR: [{ udid }, { uhid: udid }] },
    select: { id: true, registeredAtId: true },
  });
  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.hospitalId && patient.registeredAtId !== user.hospitalId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const request = await prisma.dataRightsRequest.create({
    data: { patientId: patient.id, type, description },
  });

  return NextResponse.json({ request }, { status: 201 });
}

// PATCH — resolve a data rights request (Doctor/Hospital admin)
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  const { udid } = await params;

  const body = await req.json();
  const { requestId, status, resolution } = body as {
    requestId: string;
    status: "IN_PROGRESS" | "RESOLVED" | "REJECTED";
    resolution?: string;
  };

  if (!requestId || !["IN_PROGRESS", "RESOLVED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: "requestId and valid status required" }, { status: 400 });
  }

  const patient = await prisma.patient.findFirst({
    where: { OR: [{ udid }, { uhid: udid }] },
    select: { id: true, registeredAtId: true },
  });
  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.hospitalId && patient.registeredAtId !== user.hospitalId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.dataRightsRequest.updateMany({
    where: { id: requestId, patientId: patient.id },
    data: {
      status,
      resolution: resolution ?? null,
      resolvedBy: ["RESOLVED", "REJECTED"].includes(status) ? user.id : null,
      resolvedAt: ["RESOLVED", "REJECTED"].includes(status) ? new Date() : null,
    },
  });

  if (updated.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
