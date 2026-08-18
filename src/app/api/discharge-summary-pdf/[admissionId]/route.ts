import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { generateDischargeSummaryPdf } from "@/lib/pdf";
import { format } from "date-fns";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ admissionId: string }> }
) {
  const { admissionId } = await params;
  const user = await requireRole("DOCTOR");

  const admission = await prisma.admission.findUnique({
    where: { id: admissionId },
    include: {
      visit: {
        include: {
          patient: true,
          hospital: true,
          doctor: true,
        },
      },
      dischargeSummary: true,
    },
  });

  if (!admission) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (admission.visit.doctorId !== user.profileId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!admission.dischargeSummary)
    return NextResponse.json({ error: "Discharge summary not yet created" }, { status: 404 });

  const ds = admission.dischargeSummary;
  const doctor = admission.visit.doctor!;
  const hospital = admission.visit.hospital;
  const patient = admission.visit.patient;

  const pdf = await generateDischargeSummaryPdf({
    patient: {
      name: patient.name,
      udid: patient.udid ?? "",
      age: patient.age,
      sex: patient.sex,
      mobile: (patient as any).mobile ?? null,
    },
    visit: {
      doctorName: doctor.name,
      doctorSpecialty: (doctor as any).specialty ?? null,
      doctorRegNumber: (doctor as any).medicalRegNumber ?? null,
      doctorSignatureUrl: (doctor as any).signatureUrl ?? null,
      hospitalName: hospital.name,
      hospitalLogo: (hospital as any).logoUrl ?? null,
      hospitalAddress: (hospital as any).address ?? null,
      hospitalContact: (hospital as any).contact ?? null,
      hospitalEmail: (hospital as any).email ?? null,
    },
    admission: {
      admissionDate: ds.admissionDate,
      dischargeDate: ds.dischargeDate,
      ward: admission.ward,
      reason: admission.reason,
    },
    summary: {
      surgeryPerformed: ds.surgeryPerformed,
      operatingEye: ds.operatingEye,
      anesthesiaUsed: ds.anesthesiaUsed,
      iolDetails: ds.iolDetails,
      postOpDiagnosis: ds.postOpDiagnosis,
      intraopComplications: ds.intraopComplications,
      postOpCourse: ds.postOpCourse,
      conditionAtDischarge: ds.conditionAtDischarge,
      dischargeMedications: ds.dischargeMedications,
      dischargeInstructions: ds.dischargeInstructions,
      activityRestrictions: ds.activityRestrictions,
      dietAdvice: ds.dietAdvice,
      woundCareInstructions: ds.woundCareInstructions,
      followUpDate: ds.followUpDate,
      followUpInstructions: ds.followUpInstructions,
    },
  });

  const dateStr = ds.dischargeDate ? format(ds.dischargeDate, "ddMMyyyy") : format(new Date(), "ddMMyyyy");
  const filename = `${patient.name.replace(/\s+/g, "_")}_${patient.udid}_${dateStr}_Discharge.pdf`;
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
