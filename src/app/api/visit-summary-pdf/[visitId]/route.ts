import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { generateVisitSummaryPdf } from "@/lib/pdf";
import { format } from "date-fns";

export async function GET(req: NextRequest, { params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;
  await requireUser();

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      patient:           true,
      hospital:          true,
      doctor:            true,
      generalExam:       true,
      visualAcuity:      true,
      refraction:        true,
      anteriorSegment:   true,
      posteriorSegment:  true,
      iopReadings:       { orderBy: { takenAt: "desc" } },
      diagnoses:         { orderBy: { createdAt: "asc" } },
      medications:       { orderBy: { createdAt: "asc" } },
      investigationOrders: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  const pdf = await generateVisitSummaryPdf(visit as any);

  const dateStr = format(visit.date, "ddMMyyyy");
  const patientName = visit.patient.name.replace(/\s+/g, "_");
  const filename = `${patientName}_${visit.patient.udid}_${dateStr}_VisitSummary.pdf`;
  const disposition = `inline; filename="${filename}"`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": disposition,
    },
  });
}
