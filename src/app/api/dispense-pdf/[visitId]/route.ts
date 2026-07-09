import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { maskAadhaar, decryptAadhaar } from "@/lib/crypto";
import { generateDispensePdf } from "@/lib/pdf";

export async function GET(req: NextRequest, { params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;
  const user = await requireUser();

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      patient: true,
      hospital: true,
      doctor: true,
      generalExam: true,
      diagnoses: true,
      investigationOrders: true,
      dispense: true,
    },
  });

  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  if (user.role === "DOCTOR" && visit.doctorId !== user.profileId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (user.role === "HOSPITAL" && visit.hospitalId !== user.hospitalId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (user.role === "REFRACTIONIST") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mobileMasked = user.role === "DOCTOR" ? visit.patient.mobile : `XXXXXX${visit.patient.mobile.slice(-4)}`;

  const pdf = await generateDispensePdf({
    patient: {
      udid: visit.patient.udid ?? "",
      name: visit.patient.name,
      age: visit.patient.age,
      sex: visit.patient.sex,
      mobileMasked,
    },
    visit: {
      date: visit.date,
      hospitalName: visit.hospital.name,
      doctorName: visit.doctor.name,
    },
    vitals: {
      bp: visit.generalExam?.bp,
      pulse: visit.generalExam?.pulse,
      temperature: visit.generalExam?.temperature,
      weight: visit.generalExam?.weight,
    },
    chiefComplaint: visit.generalExam?.chiefComplaint,
    diagnoses: visit.diagnoses.map((d) => ({
      description: d.description,
      icd10Code: d.icd10Code,
      status: d.status,
      laterality: d.laterality,
    })),
    investigations: visit.investigationOrders.map((i) => ({ testName: i.testName, priority: i.priority, status: i.status })),
    dispenseSummary: visit.dispense?.shortSummary,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="PPMS-${visit.patient.udid}-${visit.id}.pdf"`,
    },
  });
}
