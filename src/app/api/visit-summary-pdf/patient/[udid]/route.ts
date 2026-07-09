import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { generateAllVisitsSummaryPdf } from "@/lib/pdf";
import { format } from "date-fns";

export async function GET(req: NextRequest, { params }: { params: Promise<{ udid: string }> }) {
  const { udid } = await params;
  await requireUser();

  const visits = await prisma.visit.findMany({
    where: { patient: { udid } },
    orderBy: { date: "desc" },
    include: {
      patient:             true,
      hospital:            true,
      doctor:              true,
      generalExam:         true,
      visualAcuity:        true,
      refraction:          true,
      anteriorSegment:     true,
      posteriorSegment:    true,
      iopReadings:         { orderBy: { takenAt: "desc" } },
      diagnoses:           { orderBy: { createdAt: "asc" } },
      medications:         { orderBy: { createdAt: "asc" } },
      investigationOrders: { orderBy: { createdAt: "asc" } },
    },
  });

  if (visits.length === 0) return NextResponse.json({ error: "No visits found" }, { status: 404 });

  const pdf = await generateAllVisitsSummaryPdf(visits as any[]);

  const patient = visits[0].patient;
  const dateStr = format(new Date(), "ddMMyyyy");
  const patientName = patient.name.replace(/\s+/g, "_");
  const filename = `${patientName}_${udid}_AllVisits_${dateStr}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
