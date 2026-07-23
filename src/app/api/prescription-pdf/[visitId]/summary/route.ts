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
      diagnoses: { orderBy: { createdAt: "asc" } },
      medications: { orderBy: { createdAt: "asc" } },
      investigationOrders: { orderBy: { createdAt: "asc" } },
      surgicalCounselling: true,
    },
  });

  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  if (visit.doctorId !== user.profileId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rc = visit.refraction;
  const re = parseJSON((rc as any)?.re, { sph: "", cyl: "", axis: "", nearSph: "" });
  const le = parseJSON((rc as any)?.le, { sph: "", cyl: "", axis: "", nearSph: "" });

  const hasOptical = re.sph || re.cyl || re.axis || le.sph || le.cyl || le.axis || re.nearSph || le.nearSph;

  const pdf = await generateShortSummaryPdf({
    patient: {
      udid: visit.patient.udid ?? "",
      name: visit.patient.name,
      age: visit.patient.age,
      sex: visit.patient.sex,
      mobile: (visit.patient as any).mobile ?? null,
    },
    visit: {
      date: visit.date,
      visitType: visit.visitType ?? null,
      hospitalName: visit.hospital.name,
      hospitalAddress: (visit.hospital as any).address ?? null,
      hospitalContact: (visit.hospital as any).contact ?? null,
      doctorName: visit.doctor.name,
      followUpDate: (visit as any).followUpDate ?? null,
      referralEnabled: (visit as any).referralEnabled ?? false,
      referralNote: (visit as any).referralNote ?? null,
    },
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
    })),
    investigations: visit.investigationOrders.map((inv: any) => ({
      testName: inv.testName,
      category: inv.category,
      priority: inv.priority,
      laterality: inv.laterality ?? null,
      status: inv.status,
    })),
    opticalRx: hasOptical ? { re, le } : null,
    surgicalCounselling: visit.surgicalCounselling ? {
      surgeryType: (visit.surgicalCounselling as any).surgeryType ?? null,
      surgeryDate: (visit.surgicalCounselling as any).surgeryDate ?? null,
      notes: (visit.surgicalCounselling as any).notes ?? null,
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
