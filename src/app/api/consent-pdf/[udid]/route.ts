import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { generateConsentPdf } from "@/lib/pdf";
import { format } from "date-fns";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ udid: string }> }
) {
  const { udid } = await params;
  await requirePermission("patients.view");

  const patient = await prisma.patient.findUnique({
    where: { udid },
    select: {
      name: true, udid: true, age: true, sex: true, mobile: true,
      visits: {
        where: { surgeryAdvised: true },
        orderBy: { date: "desc" },
        take: 1,
        select: {
          advisedSurgeryName: true,
          advisedSurgeryEye:  true,
          doctor:   { select: { name: true } },
          hospital: { select: { name: true, address: true, contact: true } },
          counsellingRecord: {
            select: {
              procedure: true, laterality: true, anaesthesia: true,
              iolLensName: true, iolPower: true, iolBrand: true, iolToric: true,
              estimateAmount: true, dateOfSurgery: true,
              paymentMode: true, schemeName: true,
              confirmedAt: true, status: true,
            },
          },
        },
      },
    },
  });

  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const visit = patient.visits[0];
  if (!visit) return NextResponse.json({ error: "No surgical visit" }, { status: 404 });

  const rec = visit.counsellingRecord;
  if (!rec || rec.status !== "CONFIRMED")
    return NextResponse.json({ error: "Counselling not yet confirmed" }, { status: 400 });

  const pdf = await generateConsentPdf({
    hospital: {
      name:    visit.hospital?.name ?? "Hospital",
      address: visit.hospital?.address ?? null,
      contact: visit.hospital?.contact ?? null,
    },
    patient: {
      name:   patient.name,
      udid:   patient.udid ?? null,
      age:    patient.age,
      sex:    patient.sex,
      mobile: patient.mobile,
    },
    doctor: { name: visit.doctor?.name ?? "" },
    surgery: {
      advisedSurgeryName: visit.advisedSurgeryName,
      advisedSurgeryEye:  visit.advisedSurgeryEye,
      procedure:    rec.procedure,
      laterality:   rec.laterality,
      anaesthesia:  rec.anaesthesia,
      iolLensName:  rec.iolLensName,
      iolPower:     rec.iolPower,
      iolBrand:     rec.iolBrand,
      iolToric:     rec.iolToric,
      estimateAmount: rec.estimateAmount ? String(rec.estimateAmount) : null,
      dateOfSurgery:  rec.dateOfSurgery
        ? format(new Date(rec.dateOfSurgery), "dd MMM yyyy")
        : null,
      paymentMode: rec.paymentMode,
      schemeName:  rec.schemeName,
    },
    confirmedAt: rec.confirmedAt,
  });

  const dateStr = format(new Date(), "ddMMyyyy");
  const filename = `${patient.name.replace(/\s+/g, "_")}_${patient.udid ?? "consent"}_${dateStr}_Consent.pdf`;
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
