import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { generateShortSummaryPdf } from "@/lib/pdf";
import { parseJSON } from "@/lib/json";
import { format } from "date-fns";

export async function GET(req: NextRequest, { params }: { params: Promise<{ visitId: string }> }) {
  try {
  const { visitId } = await params;
  const user = await requireRole("DOCTOR");

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      patient: true,
      hospital: true,
      doctor: true,
      refraction: true,
      visualAcuity: true,
      retinoscopy: true,
      generalExam: true,
      diagnoses: { orderBy: { createdAt: "asc" } },
      medications: { orderBy: { createdAt: "asc" } },
      investigationOrders: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  if (visit.doctorId !== user.profileId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Refraction-section inclusion params (absent or "1" = include, "0" = exclude)
  const sp = req.nextUrl.searchParams;
  const inclRx     = sp.get("rx")     !== "0";
  const inclExtras = sp.get("extras") !== "0";
  const inclVa     = sp.get("va")     !== "0";
  const inclRetino = sp.get("retino") !== "0";

  // ?spv=<visitId> pins a historical spectacle Rx to the summary
  const spv = sp.get("spv");
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

  // Collect all checked corrections as a flat list, handling both v1 and v2 storage formats.
  type FlatCorr = { label: string; re: Record<string, string>; le: Record<string, string>; method: string };
  const c1Corrections: FlatCorr[] = [];
  const extraCorrectionsList: FlatCorr[] = [];

  const reRaw = parseJSON((rc as any)?.re, {} as any);
  if (reRaw._v === 2) {
    // v2: per-method map stored in re field
    const methods = (reRaw.methods || {}) as Record<string, { re: any; le: any; includedInPrint?: boolean }>;
    Object.entries(methods).forEach(([method, entry]) => {
      if (entry.includedInPrint !== false && Object.values(entry.re || {}).some(Boolean)) {
        c1Corrections.push({ label: "Correction 1", re: entry.re || {}, le: entry.le || {}, method });
      }
    });
  } else {
    // v1: flat re/le
    const re = parseJSON((rc as any)?.re, { sph: "", cyl: "", axis: "", nearSph: "", va: "", nearVa: "" } as any);
    const le = parseJSON((rc as any)?.le, { sph: "", cyl: "", axis: "", nearSph: "", va: "", nearVa: "" } as any);
    const included = (re as any).includedInPrint !== false;
    if (included && rc && (re.sph || re.cyl || re.axis || (le as any).sph || (le as any).cyl || (le as any).axis || re.nearSph || (le as any).nearSph || re.va || (le as any).va)) {
      c1Corrections.push({ label: "Correction 1", re: re as any, le: le as any, method: (re as any).method || "" });
    }
  }

  // Extra corrections from current visit's refraction (not overridable by spv)
  const rawExtras: any[] = parseJSON((visit.refraction as any)?.extraCorrections, []);
  rawExtras.forEach((ex: any) => {
    if (ex._v === 2) {
      const methods = (ex.methods || {}) as Record<string, { re: any; le: any; includedInPrint?: boolean }>;
      Object.entries(methods).forEach(([method, entry]) => {
        if (entry.includedInPrint !== false && Object.values(entry.re || {}).some(Boolean)) {
          extraCorrectionsList.push({ label: ex.label, re: entry.re || {}, le: entry.le || {}, method });
        }
      });
    } else {
      if (ex.includedInPrint !== false) {
        extraCorrectionsList.push({ label: ex.label, re: ex.re || {}, le: ex.le || {}, method: ex.re?.method || "" });
      }
    }
  });

  const allCorrections = [
    ...(inclRx ? c1Corrections : []),
    ...(inclExtras ? extraCorrectionsList : []),
  ];
  const extraCorrections = allCorrections.length > 0
    ? allCorrections.map((c) => ({ label: c.label, re: { ...c.re, method: c.method }, le: { ...c.le, method: c.method } }))
    : null;

  // Visual Acuity
  const va = visit.visualAcuity as any;
  const visualAcuity = inclVa && va
    ? {
        reDistance: parseJSON(va.reDistance, null) as { unaided?: string; ph?: string; bcva?: string } | null,
        leDistance: parseJSON(va.leDistance, null) as { unaided?: string; ph?: string; bcva?: string } | null,
        reNear: va.reNear ?? null,
        leNear: va.leNear ?? null,
      }
    : null;

  // Retinoscopy
  const reti = visit.retinoscopy as any;
  const retinoscopy = inclRetino && reti
    ? {
        re: parseJSON(reti.re, null) as { sph?: string; cyl?: string; axis?: string } | null,
        le: parseJSON(reti.le, null) as { sph?: string; cyl?: string; axis?: string } | null,
      }
    : null;

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
      notes: inv.notes ?? null,
    })),
    opticalRx: null,
    extraCorrections,
    visualAcuity,
    retinoscopy,
    minorProcedure: (visit as any).procedureName ? {
      procedureName: (visit as any).procedureName ?? null,
      procedureLaterality: (visit as any).procedureLaterality ?? null,
      anesthesiaType: (visit as any).anesthesiaType ?? null,
    } : null,
  });

  const dateStr = format(visit.date, "ddMMyyyy");
  const patientName = visit.patient.name.replace(/\s+/g, "_");
  const filename = `${patientName}_${visit.patient.udid}_${dateStr}_Summary.pdf`;
  const disposition = sp.get("dl") === "1"
    ? `attachment; filename="${filename}"`
    : `inline; filename="${filename}"`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": disposition,
    },
  });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? (err.stack ?? "") : "";
    console.error("[PDF ERROR]", msg, stack);
    return NextResponse.json({ error: msg, stack }, { status: 500 });
  }
}
