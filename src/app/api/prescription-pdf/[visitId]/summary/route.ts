import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { generateShortSummaryPdf } from "@/lib/pdf";
import { parseJSON } from "@/lib/json";
import { format } from "date-fns";

export async function GET(req: NextRequest, { params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;
  const user = await requireRole("DOCTOR");

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      patient: true,
      hospital: true,
      doctor: true,
      refraction: true,
      generalExam: true,
      diagnoses: { orderBy: { createdAt: "asc" } },
      medications: { orderBy: { createdAt: "asc" } },
      investigationOrders: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  if (visit.doctorId !== user.profileId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // ?spv=<visitId> pins a historical spectacle Rx to the summary
  const spv = req.nextUrl.searchParams.get("spv");
  let spectRc: any = null;
  if (spv) {
    if (spv === visitId) {
      spectRc = visit.refraction ?? null;
    } else {
      const spectVisit = await prisma.visit.findUnique({ where: { id: spv }, include: { refraction: true } });
      spectRc = spectVisit?.refraction ?? null;
    }
  }

  // Use pinned spectacle Rx if set, otherwise fall back to current visit's refraction
  const rc = spectRc ?? visit.refraction ?? null;
  const re = parseJSON((rc as any)?.re, { sph: "", cyl: "", axis: "", nearSph: "", va: "", nearVa: "" });
  const le = parseJSON((rc as any)?.le, { sph: "", cyl: "", axis: "", nearSph: "", va: "", nearVa: "" });

  const hasOptical = rc && (re.sph || re.cyl || re.axis || le.sph || le.cyl || le.axis || re.nearSph || le.nearSph || re.va || le.va);

  const pdf = await generateShortSummaryPdf({
    patient: {
      udid: visit.patient.udid ?? "",
      uhid: visit.patient.uhid ?? null,
      name: visit.patient.name,
      age: visit.patient.age,
      sex: visit.patient.sex,
      mobile: (visit.patient as any).mobile ?? null,
    },
    visit: {
      date: visit.date,
      visitType: visit.visitType ?? null,
      hospitalName: visit.hospital.name,
      hospitalLogo: (visit.hospital as any).logoUrl ?? null,
      hospitalAddress: (visit.hospital as any).address ?? null,
      hospitalContact: (visit.hospital as any).contact ?? null,
      hospitalEmail: (visit.hospital as any).email ?? null,
      doctorName: visit.doctor.name,
      doctorQualifications: (visit.doctor as any).qualifications ?? null,
      doctorSpecialty: (visit.doctor as any).specialty || null,
      doctorRegNumber: (visit.doctor as any).medicalRegNumber ?? null,
      doctorSignatureUrl: (visit.doctor as any).signatureUrl ?? null,
      followUpDate: (visit as any).followUpDate ?? null,
      referralEnabled: (visit as any).referralEnabled ?? false,
      referralNote: (visit as any).referralNote ?? null,
      inViewOf: (visit as any).inViewOf ?? null,
    },
    chiefComplaint: (visit as any).generalExam?.chiefComplaint ?? null,
    advice: (visit as any).adviseNotes ?? null,
    diagnoses: visit.diagnoses.map((d: any) => ({
      description: d.description,
      icd10Code: d.icd10Code,
      status: d.status,
      laterality: d.laterality ?? null,
    })),
    medications: visit.medications.map((m: any) => ({
      drugName: m.drugName,
      dosage: m.dosage,
      frequency: m.frequency,
      duration: m.duration,
      instructions: m.instructions ?? null,
      route: m.route ?? null,
      laterality: m.laterality ?? null,
    })),
    investigations: visit.investigationOrders.map((inv: any) => ({
      testName: inv.testName,
      category: inv.category,
      priority: inv.priority,
      laterality: inv.laterality ?? null,
      status: inv.status,
    })),
    opticalRx: hasOptical ? { re, le } : null,
    minorProcedure: (visit as any).procedureName ? {
      procedureName: (visit as any).procedureName ?? null,
      procedureLaterality: (visit as any).procedureLaterality ?? null,
      anesthesiaType: (visit as any).anesthesiaType ?? null,
    } : null,
  });

  const dateStr = format(visit.date, "ddMMyyyy");
  const patientName = visit.patient.name.replace(/\s+/g, "_");
  const filename = `${patientName}_${visit.patient.udid}_${dateStr}_Summary.pdf`;
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
