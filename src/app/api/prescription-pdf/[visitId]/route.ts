import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { generateFullEmrPdf } from "@/lib/pdf";
import { parseJSON } from "@/lib/json";

export async function GET(req: NextRequest, { params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;
  const user = await requireRole("DOCTOR");

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      patient: true,
      hospital: true,
      doctor: true,
      generalExam: true,
      visualAcuity: true,
      refraction: true,
      colourVisionCS: true,
      iopReadings: { orderBy: { takenAt: "desc" } },
      anteriorSegment: true,
      posteriorSegment: true,
      diagnoses: { orderBy: { createdAt: "asc" } },
      medications: { orderBy: { createdAt: "asc" } },
      investigationOrders: { orderBy: { createdAt: "asc" } },
      admission: true,
      surgicalCounselling: true,
    },
  });

  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  if (visit.doctorId !== user.profileId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ge = visit.generalExam;
  const va = visit.visualAcuity;
  const rc = visit.refraction;
  const cv = visit.colourVisionCS;
  const as_ = visit.anteriorSegment;
  const ps = visit.posteriorSegment;

  const vaData = va ? {
    reDistance: parseJSON((va as any).reDistance, null),
    leDistance: parseJSON((va as any).leDistance, null),
    reNear: (va as any).reNear ?? null,
    leNear: (va as any).leNear ?? null,
    reNearN: (va as any).reNearN ?? null,
    leNearN: (va as any).leNearN ?? null,
  } : null;

  const pdf = await generateFullEmrPdf({
    patient: {
      udid: visit.patient.udid,
      name: visit.patient.name,
      age: visit.patient.age,
      sex: visit.patient.sex,
      mobile: (visit.patient as any).mobile ?? null,
      address: (visit.patient as any).address ?? null,
    },
    visit: {
      date: visit.date,
      visitType: visit.visitType ?? null,
      hospitalName: visit.hospital.name,
      doctorName: visit.doctor.name,
    },
    generalExam: ge ? {
      bp: ge.bp, pulse: ge.pulse, temperature: ge.temperature, weight: ge.weight,
      chiefComplaint: ge.chiefComplaint, hpi: (ge as any).hpi ?? null,
      pastMedicalHistory: parseJSON((ge as any).pastMedicalHistory, [] as string[]),
      pmhOtherText: (ge as any).pmhOtherText ?? null,
      medications: (ge as any).medications ?? null,
      allergies: (ge as any).allergies ?? null,
      nkda: (ge as any).nkda ?? null,
      familyHistory: (ge as any).familyHistory ?? null,
      socialHistory: (ge as any).socialHistory ?? null,
    } : null,
    visualAcuity: vaData,
    iopReadings: visit.iopReadings.map((r: any) => ({
      method: r.method, re: r.re, le: r.le, takenAt: r.takenAt,
    })),
    colourVision: cv ? {
      re: (cv as any).re ?? null,
      le: (cv as any).le ?? null,
      notes: (cv as any).notes ?? null,
    } : null,
    anteriorSegment: as_ ? parseJSON((as_ as any).data, null) : null,
    posteriorSegment: ps ? {
      data: parseJSON((ps as any).data, null),
      cdr: (ps as any).cdr ?? null,
      notes: (ps as any).notes ?? null,
    } : null,
    diagnoses: visit.diagnoses.map((d: any) => ({
      description: d.description, icd10Code: d.icd10Code,
      status: d.status, laterality: d.laterality ?? null,
    })),
    medications: visit.medications.map((m: any) => ({
      drugName: m.drugName, dosage: m.dosage, frequency: m.frequency,
      duration: m.duration, instructions: m.instructions ?? null,
    })),
    opticalRx: {
      re: parseJSON(rc?.re, { sph: "", cyl: "", axis: "", nearSph: "", nearCyl: "", nearAxis: "" }),
      le: parseJSON(rc?.le, { sph: "", cyl: "", axis: "", nearSph: "", nearCyl: "", nearAxis: "" }),
    },
    investigations: visit.investigationOrders.map((i: any) => ({
      testName: i.testName, priority: i.priority, status: i.status,
      result: i.result ?? null, notes: i.notes ?? null,
    })),
    admission: visit.admission ? {
      wardName: (visit.admission as any).wardName ?? null,
      bedNumber: (visit.admission as any).bedNumber ?? null,
      reason: (visit.admission as any).reason ?? null,
    } : null,
    surgicalCounselling: visit.surgicalCounselling ? {
      surgeryType: (visit.surgicalCounselling as any).surgeryType ?? null,
      surgeryDate: (visit.surgicalCounselling as any).surgeryDate ?? null,
      notes: (visit.surgicalCounselling as any).notes ?? null,
    } : null,
  });

  const filename = `PPMS-EMR-${visit.patient.udid}-${visit.id.slice(0, 8)}.pdf`;
  const disposition = req.nextUrl.searchParams.get("dl") === "1"
    ? `attachment; filename="${filename}"`
    : `inline; filename="${filename}"`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": disposition,
    },
  });
}
