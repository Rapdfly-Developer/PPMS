import { NextRequest, NextResponse } from "next/server";
import { parseOculoplasty, hasFindings, hasEom } from "@/lib/oculoplasty";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { printDeniedReason } from "../access";
import { generateFullEmrPdf } from "@/lib/pdf";
import { parseJSON } from "@/lib/json";

export async function GET(req: NextRequest, { params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;
  const user = await requireUser();

  // Section inclusion params (absent or "1" = include, "0" = exclude). The
  // plain long print sends none, so it prints every section; Custom Print sends
  // "0" for each section left unticked (ids in src/lib/print-sections.ts).
  const sp = req.nextUrl.searchParams;
  const on = (key: string) => sp.get(key) !== "0";
  const inclExtras = on("extras") && on("rx");
  // Retinoscopy has no EMR section of its own; it prints with the refractions.
  const inclRetino = on("retino") && on("rx");

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      patient: true,
      hospital: true,
      doctor: true,
      generalExam: true,
      visualAcuity: true,
      refraction: true,
      retinoscopy: true,
      colourVisionCS: true,
      iopReadings: { orderBy: { takenAt: "desc" } },
      anteriorSegment: true,
      posteriorSegment: true,
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
  const denied = await printDeniedReason(user, visit);
  if (denied) return NextResponse.json({ error: "Forbidden", reason: denied }, { status: 403 });

  const ge = visit.generalExam;
  const va = visit.visualAcuity;
  const rc = visit.refraction;
  const cv = visit.colourVisionCS;
  const as_ = visit.anteriorSegment;
  const ps = visit.posteriorSegment;

  const vaReJson = parseJSON((va as any)?.re, {} as Record<string, string>);
  const vaLeJson = parseJSON((va as any)?.le, {} as Record<string, string>);
  const vaHasValues = [vaReJson.unaided, vaReJson.pinhole, vaReJson.bestCorrected, vaReJson.nearUnaided, vaReJson.nearBestCorrected, vaLeJson.unaided, vaLeJson.pinhole, vaLeJson.bestCorrected, vaLeJson.nearUnaided, vaLeJson.nearBestCorrected].some(Boolean);
  const vaData = va && vaHasValues ? {
    testMethod: (va as any).testMethod ?? null,
    reDistance: { unaided: vaReJson.unaided ?? null, ph: vaReJson.pinhole ?? null, bcva: vaReJson.bestCorrected ?? null },
    leDistance: { unaided: vaLeJson.unaided ?? null, ph: vaLeJson.pinhole ?? null, bcva: vaLeJson.bestCorrected ?? null },
    reNear: vaReJson.nearUnaided ?? null,
    leNear: vaLeJson.nearUnaided ?? null,
    reNearN: vaReJson.nearBestCorrected ?? null,
    leNearN: vaLeJson.nearBestCorrected ?? null,
  } : null;

  let pdf: Buffer;
  try {
    pdf = await generateFullEmrPdf({
      patient: {
        udid: visit.patient.udid ?? "",
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
        hospitalLogo: (visit.hospital as any).logoUrl ?? null,
        hospitalAddress: (visit.hospital as any).address ?? null,
        hospitalContact: (visit.hospital as any).contact ?? null,
        hospitalEmail: (visit.hospital as any).email ?? null,
        doctorName: visit.doctor.name,
        doctorQualifications: visit.doctor.qualifications ?? null,
        doctorRegNumber: visit.doctor.medicalRegNumber ?? null,
        followUpDate: on("followup") ? (visit as any).followUpDate ?? null : null,
        referralEnabled: on("referral") ? (visit as any).referralEnabled ?? false : false,
        referralNote: (visit as any).referralNote ?? null,
        inViewOf: (visit as any).inViewOf ?? null,
      },
      generalExam: ge ? {
        bp: on("vitals") ? ge.bp : null,
        pulse: on("vitals") ? ge.pulse : null,
        temperature: on("vitals") ? ge.temperature : null,
        weight: on("vitals") ? ge.weight : null,
        chiefComplaint: on("cc") ? ge.chiefComplaint : null,
        hpi: on("hpi") ? (ge as any).hpi ?? null : null,
        pastMedicalHistory: on("pmh") ? parseJSON((ge as any).pastMedicalHistory, [] as string[]) : [],
        pmhOtherText: on("systemic") ? (ge as any).pmhOtherText ?? null : null,
        medications: on("curmeds") ? (ge as any).medications ?? null : null,
        allergies: on("allergy") ? (ge as any).allergies ?? null : null,
        nkda: on("allergy") ? (ge as any).nkda ?? null : null,
        familyHistory: on("family") ? (ge as any).familyHistory ?? null : null,
        socialHistory: on("systemic") ? (ge as any).socialHistory ?? null : null,
      } : null,
      visualAcuity: on("va") ? vaData : null,
      iopReadings: on("iop") ? visit.iopReadings.map((r: any) => ({
        method: r.method, re: r.re, le: r.le, takenAt: r.takenAt,
      })) : [],
      colourVision: cv && (on("cv") || on("cs")) ? (() => {
        const parseCvEye = (raw: unknown) => {
          if (!raw) return null;
          const eye: any = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
          if (!eye) return null;
          const inclCv = on("cv"), inclCs = on("cs");
          return {
            cvMethod: inclCv ? eye.cvMethod ?? undefined : undefined,
            result: inclCv ? eye.result ?? undefined : undefined,
            notes: inclCv ? eye.notes ?? undefined : undefined,
            csMethod: inclCs ? eye.csMethod ?? undefined : undefined,
            csResult: inclCs ? eye.csResult ?? undefined : undefined,
            csNotes: inclCs ? eye.csNotes ?? undefined : undefined,
          };
        };
        return { re: parseCvEye((cv as any).re), le: parseCvEye((cv as any).le), notes: on("cv") ? (cv as any).notes ?? null : null };
      })() : null,
      // Raw per-eye records (incl. _method / _notes / freeText), the shape renderFullEmrHtml reads.
      anteriorSegment: as_ && on("ant") ? {
        re: parseJSON((as_ as any).re, {} as Record<string, any>),
        le: parseJSON((as_ as any).le, {} as Record<string, any>),
      } : null,
      posteriorSegment: ps && on("pos") ? {
        re: parseJSON((ps as any).re, {} as Record<string, any>),
        le: parseJSON((ps as any).le, {} as Record<string, any>),
        notes: (ps as any).notes ?? null,
      } : null,
      diagnoses: visit.diagnoses.filter((d: any) => on(d.provisional ? "pdx" : "dx")).map((d: any) => ({
        description: d.description, icd10Code: d.icd10Code,
        status: d.status, laterality: d.laterality ?? null,
      })),
      medications: on("meds") ? visit.medications.map((m: any) => ({
        drugName: m.drugName, dosage: m.dosage, frequency: m.frequency,
        duration: m.duration, instructions: m.instructions ?? null,
        route: m.route ?? null, laterality: m.laterality ?? null,
      })) : [],
      opticalRx: null,
      // Every refraction and method that has values, same as the Previous Visits long summary.
      extraCorrections: (() => {
        type FlatCorr = { label: string; re: any; le: any; method: string };
        const c1Corrs: FlatCorr[] = [];
        const extraCorrs: FlatCorr[] = [];
        const reRaw = parseJSON(rc?.re, {} as any);
        if (reRaw._v === 2) {
          const methods = (reRaw.methods || {}) as Record<string, { re: any; le: any; includedInPrint?: boolean }>;
          Object.entries(methods).forEach(([method, entry]) => {
            if (Object.values(entry.re || {}).some(Boolean)) {
              c1Corrs.push({ label: "Refraction 1", re: entry.re || {}, le: entry.le || {}, method });
            }
          });
        } else {
          const rcRe = parseJSON(rc?.re, { sph: "", cyl: "", axis: "", nearSph: "", nearCyl: "", nearAxis: "" } as any);
          if (Object.values(rcRe).some(Boolean)) {
            c1Corrs.push({ label: "Refraction 1", re: rcRe, le: parseJSON(rc?.le, {} as any), method: rcRe.method || "" });
          }
        }
        if (inclExtras) {
          const rawExtras: any[] = parseJSON((rc as any)?.extraCorrections, []);
          rawExtras.forEach((ex: any) => {
            if (ex._v === 2) {
              const methods = (ex.methods || {}) as Record<string, { re: any; le: any; includedInPrint?: boolean }>;
              Object.entries(methods).forEach(([method, entry]) => {
                if (Object.values(entry.re || {}).some(Boolean)) {
                  extraCorrs.push({ label: (ex.label || "Extra Correction").replace(/^Correction\b/i, "Refraction"), re: entry.re || {}, le: entry.le || {}, method });
                }
              });
            } else {
              if (Object.values(ex.re || {}).some(Boolean)) {
                extraCorrs.push({ label: (ex.label || "Extra Correction").replace(/^Correction\b/i, "Refraction"), re: ex.re || {}, le: ex.le || {}, method: ex.re?.method || "" });
              }
            }
          });
        }
        const all = [...(on("rx") ? c1Corrs : []), ...extraCorrs];
        return all.length > 0
          ? all.map((c) => ({ label: c.label, re: { ...c.re, method: c.method }, le: { ...c.le, method: c.method } }))
          : null;
      })(),
      retinoscopy: (() => {
        if (!inclRetino) return null;
        const reti = visit.retinoscopy as any;
        if (!reti) return null;
        return {
          re: parseJSON(reti.re, null) as { sph?: string; cyl?: string; axis?: string } | null,
          le: parseJSON(reti.le, null) as { sph?: string; cyl?: string; axis?: string } | null,
        };
      })(),
      oculoplasty: (() => {
        const o = parseOculoplasty((visit as any).oculoplasty);
        const out = {
          deviation: on("deviation") && hasFindings(o.deviation) ? o.deviation : null,
          eom: on("eom") && hasEom(o) ? o.eom : null,
          exo: on("exo") && hasFindings(o.exo) ? o.exo : null,
        };
        return out.deviation || out.eom || out.exo ? out : null;
      })(),
      gonioscopy: (() => {
        if (!on("gonio")) return null;
        const raw = parseJSON((visit as any).gonioNotes, {} as Record<string, string>);
        return Object.values(raw).some(Boolean) ? raw : null;
      })(),
      tearFilm: (visit as any).tearFilm && on("tear") ? {
        tbutRe: (visit as any).tearFilm.tbutRe ?? null,
        tbutLe: (visit as any).tearFilm.tbutLe ?? null,
        schirmer1Re: (visit as any).tearFilm.schirmer1Re ?? null,
        schirmer1Le: (visit as any).tearFilm.schirmer1Le ?? null,
        schirmer2Re: (visit as any).tearFilm.schirmer2Re ?? null,
        schirmer2Le: (visit as any).tearFilm.schirmer2Le ?? null,
      } : null,
      lacrimalSac: (() => {
        const ls = (visit as any).lacrimalSac;
        if (!ls || !on("lacrimal")) return null;
        const parseEye = (raw: unknown) => {
          const parsed = parseJSON(raw as any, {} as any);
          return Array.isArray(parsed)
            ? { chips: parsed as string[], findings: "" }
            : { chips: (parsed as any).chips ?? [], findings: (parsed as any).findings ?? "" };
        };
        const reRaw = parseJSON(ls.re, {} as any);
        const method = Array.isArray(reRaw) ? null : ((reRaw as any).method ?? null);
        return { re: ls.re ? parseEye(ls.re) : null, le: ls.le ? parseEye(ls.le) : null, method };
      })(),
      diplopiaChart: (visit as any).diplopiaChart && on("diplopia")
        ? parseJSON((visit as any).diplopiaChart.grid, null)
        : null,
      hessChart: (visit as any).hessChart && on("hess")
        ? { grid: parseJSON((visit as any).hessChart.grid, undefined) as Record<string, any> | undefined, interpretation: (visit as any).hessChart.interpretation ?? null }
        : null,
      minorProcedure: (visit as any).procedureName && on("proc") ? {
        procedureName: (visit as any).procedureName ?? null,
        procedureLaterality: (visit as any).procedureLaterality ?? null,
        anesthesiaType: (visit as any).anesthesiaType ?? null,
        procedureNotes: (visit as any).procedureNotes ?? null,
      } : null,
      adviseNotes: on("advice") ? (visit as any).adviseNotes ?? null : null,
      investigations: on("inv") ? visit.investigationOrders.map((i: any) => ({
        testName: i.testName, priority: i.priority, status: i.status,
        laterality: i.laterality ?? null,
        result: i.result ?? null, notes: i.notes ?? null,
      })) : [],
    });
  } catch (err: any) {
    console.error("[prescription-pdf] generation error:", err);
    return NextResponse.json({ error: err?.message ?? "PDF generation failed", stack: err?.stack }, { status: 500 });
  }

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
