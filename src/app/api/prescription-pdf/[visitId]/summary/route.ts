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
      anteriorSegment: true,
      posteriorSegment: true,
      colourVisionCS: true,
      iopReadings: { orderBy: { takenAt: "desc" } },
      tearFilm: true,
      lacrimalSac: true,
      diplopiaChart: true,
      hessChart: true,
      diagnoses: { orderBy: { createdAt: "asc" } },
      medications: { orderBy: { createdAt: "asc" } },
      investigationOrders: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  if (visit.doctorId !== user.profileId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Section inclusion params (absent or "1" = include, "0" = exclude)
  const sp = req.nextUrl.searchParams;
  const inclRx     = sp.get("rx")     !== "0";
  const inclExtras = sp.get("extras") !== "0";
  const inclVa     = sp.get("va")     !== "0";
  const inclRetino = sp.get("retino") !== "0";
  const inclCc     = sp.get("cc")     !== "0";
  const inclDx     = sp.get("dx")     !== "0";
  const inclMeds   = sp.get("meds")   !== "0";
  const inclInv    = sp.get("inv")    !== "0";
  const inclProc   = sp.get("proc")   !== "0";
  const inclAdvice = sp.get("advice") !== "0";
  const inclAllergy = sp.get("allergy") !== "0";
  const inclAnt    = sp.get("ant")    !== "0";
  const inclPos    = sp.get("pos")    !== "0";
  const inclCv     = sp.get("cv")     !== "0";
  const inclCs     = sp.get("cs")     !== "0";
  const inclIop    = sp.get("iop")    !== "0";
  const inclGonio  = sp.get("gonio")  !== "0";
  const inclTear   = sp.get("tear")   !== "0";
  const inclLacrimal = sp.get("lacrimal") !== "0";
  const inclDiplopia = sp.get("diplopia") !== "0";
  const inclHess   = sp.get("hess")   !== "0";

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

  // Parse anterior / posterior segment JSON
  const parseSegJson = (s: string | null | undefined): Record<string, string> | null => {
    if (!s) return null;
    try { const p = typeof s === "string" ? JSON.parse(s) : s; return p && typeof p === "object" ? p : null; }
    catch { return null; }
  };

  const ant = (visit as any).anteriorSegment;
  const pos = (visit as any).posteriorSegment;

  const anteriorSegment = inclAnt && ant ? (() => {
    const re = parseSegJson(ant.re);
    const le = parseSegJson(ant.le);
    const hasData = (r?: Record<string, string> | null) => r && Object.values(r).some((v) => v && v.trim());
    return (hasData(re) || hasData(le)) ? { re, le } : null;
  })() : null;

  const posteriorSegment = inclPos && pos ? (() => {
    const re = parseSegJson(pos.re);
    const le = parseSegJson(pos.le);
    const hasData = (r?: Record<string, string> | null) => r && Object.values(r).some((v) => v && v.trim());
    return (hasData(re) || hasData(le) || pos.notes) ? { re, le, notes: pos.notes ?? null } : null;
  })() : null;

  const colourRaw = (visit as any).colourVisionCS;
  const colourRe = parseJSON<Record<string, string>>(colourRaw?.re, {});
  const colourLe = parseJSON<Record<string, string>>(colourRaw?.le, {});
  const colourVision = inclCv ? {
    re: { method: colourRe.cvMethod ?? "", result: colourRe.result ?? "", notes: colourRe.notes ?? "" },
    le: { method: colourLe.cvMethod ?? colourRe.cvMethod ?? "", result: colourLe.result ?? "", notes: colourLe.notes ?? "" },
  } : null;
  const contrastSensitivity = inclCs ? {
    re: { method: colourRe.csMethod ?? "", result: colourRe.csResult ?? "", notes: colourRe.csNotes ?? "" },
    le: { method: colourLe.csMethod ?? colourRe.csMethod ?? "", result: colourLe.csResult ?? "", notes: colourLe.csNotes ?? "" },
  } : null;
  const iopReadings = inclIop ? (visit as any).iopReadings.map((reading: any) => ({
    method: reading.method ?? "",
    takenAt: reading.takenAt,
    re: reading.re,
    le: reading.le,
  })) : null;
  const gonioRaw = parseJSON<Record<string, string>>((visit as any).gonioNotes, {});
  const gonioscopy = inclGonio && Object.values(gonioRaw).some((value) => !!value)
    ? gonioRaw
    : null;
  const tearFilm = inclTear && (visit as any).tearFilm ? {
    tbutRe: (visit as any).tearFilm.tbutRe,
    tbutLe: (visit as any).tearFilm.tbutLe,
    schirmer1Re: (visit as any).tearFilm.schirmer1Re,
    schirmer1Le: (visit as any).tearFilm.schirmer1Le,
    schirmer2Re: (visit as any).tearFilm.schirmer2Re,
    schirmer2Le: (visit as any).tearFilm.schirmer2Le,
  } : null;
  const parseChart = (raw: string | null | undefined) => parseJSON<Record<string, any>>(raw, {});
  const lacrimalRaw = (visit as any).lacrimalSac;
  const parseLacrimalEye = (raw: string | null | undefined) => {
    const parsed = parseJSON<any>(raw, {});
    return Array.isArray(parsed) ? { chips: parsed, findings: "" } : { chips: parsed.chips ?? [], findings: parsed.findings ?? "" };
  };
  const lacrimalSac = inclLacrimal && lacrimalRaw ? {
    re: parseLacrimalEye(lacrimalRaw.re),
    le: parseLacrimalEye(lacrimalRaw.le),
  } : null;
  const diplopiaChart = inclDiplopia && (visit as any).diplopiaChart
    ? parseChart((visit as any).diplopiaChart.grid)
    : null;
  const hessChart = inclHess && (visit as any).hessChart
    ? { grid: parseChart((visit as any).hessChart.grid), interpretation: (visit as any).hessChart.interpretation ?? null }
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
    chiefComplaint: inclCc ? ((visit as any).generalExam?.chiefComplaint ?? null) : null,
    advice: inclAdvice ? ((visit as any).adviseNotes ?? null) : null,
    allergies: inclAllergy ? ((visit as any).generalExam?.allergies ?? null) : null,
    diagnoses: inclDx ? visit.diagnoses.map((d: any) => ({
      description: d.description,
      icd10Code: d.icd10Code,
      status: d.status,
      laterality: d.laterality ?? null,
    })) : [],
    medications: inclMeds ? visit.medications.map((m: any) => ({
      drugName: m.drugName,
      dosage: m.dosage,
      frequency: m.frequency,
      duration: m.duration,
      instructions: m.instructions ?? null,
      route: m.route ?? null,
      laterality: m.laterality ?? null,
    })) : [],
    investigations: inclInv ? visit.investigationOrders.map((inv: any) => ({
      testName: inv.testName,
      category: inv.category,
      priority: inv.priority,
      laterality: inv.laterality ?? null,
      status: inv.status,
      notes: inv.notes ?? null,
    })) : [],
    opticalRx: null,
    extraCorrections,
    visualAcuity,
    retinoscopy,
    anteriorSegment,
    posteriorSegment,
    colourVision,
    contrastSensitivity,
    iopReadings,
    gonioscopy,
    tearFilm,
    lacrimalSac,
    diplopiaChart,
    hessChart,
    minorProcedure: inclProc && (visit as any).procedureName ? {
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
