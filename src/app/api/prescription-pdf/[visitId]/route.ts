import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { generateFullEmrPdf } from "@/lib/pdf";
import { parseJSON } from "@/lib/json";

export async function GET(req: NextRequest, { params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;
  const user = await requireRole("DOCTOR");

  // Refraction-section inclusion params (absent or "1" = include, "0" = exclude)
  const sp = req.nextUrl.searchParams;
  const inclExtras = sp.get("extras") !== "0";
  const inclRetino = sp.get("retino") !== "0";

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
      diagnoses: { orderBy: { createdAt: "asc" } },
      medications: { orderBy: { createdAt: "asc" } },
      investigationOrders: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  if (visit.doctorId !== user.profileId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ge = visit.generalExam;
  const va = visit.visualAcuity;
  const rc = visit.refraction;
  const cv = visit.colourVisionCS;
  const as_ = visit.anteriorSegment;
  const ps = visit.posteriorSegment;

  const vaData = va ? {
    reDistance: parseJSON((va as any).reDistance, null),
    leDistance: parseJSON((va as any).leDistance, null),
    reNear: (va as any).reNear ?? null,
    leNear: (va as any).leNear ?? null,
    reNearN: (va as any).reNearN ?? null,
    leNearN: (va as any).leNearN ?? null,
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
      },
      generalExam: ge ? {
        bp: ge.bp, pulse: ge.pulse, temperature: ge.temperature, weight: ge.weight,
        chiefComplaint: ge.chiefComplaint, hpi: (ge as any).hpi ?? null,
        pastMedicalHistory: parseJSON((ge as any).pastMedicalHistory, [] as string[]),
        pmhOtherText: (ge as any).pmhOtherText ?? null,
        medications: (ge as any).medications ?? null,
        allergies: (ge as any).allergies ?? null,
        nkda: (ge as any).nkda ?? null,
        familyHistory: (ge as any).familyHistory ?? null,
        socialHistory: (ge as any).socialHistory ?? null,
      } : null,
      visualAcuity: vaData,
      iopReadings: visit.iopReadings.map((r: any) => ({
        method: r.method, re: r.re, le: r.le, takenAt: r.takenAt,
      })),
      colourVision: cv ? (() => {
        const parseCvEye = (raw: unknown) => {
          if (!raw) return null;
          const eye: any = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
          if (!eye) return null;
          return {
            cvMethod: eye.cvMethod ?? undefined,
            result: eye.result ?? undefined,
            notes: eye.notes ?? undefined,
            csMethod: eye.csMethod ?? undefined,
            csResult: eye.csResult ?? undefined,
            csNotes: eye.csNotes ?? undefined,
          };
        };
        return { re: parseCvEye((cv as any).re), le: parseCvEye((cv as any).le), notes: (cv as any).notes ?? null };
      })() : null,
      anteriorSegment: as_ ? parseJSON((as_ as any).data, undefined) : null,
      posteriorSegment: ps ? {
        data: parseJSON((ps as any).data, undefined),
        cdr: (ps as any).cdr ?? null,
        notes: (ps as any).notes ?? null,
      } : null,
      diagnoses: visit.diagnoses.map((d: any) => ({
        description: d.description, icd10Code: d.icd10Code,
        status: d.status, laterality: d.laterality ?? null,
      })),
      medications: visit.medications.map((m: any) => ({
        drugName: m.drugName, dosage: m.dosage, frequency: m.frequency,
        duration: m.duration, instructions: m.instructions ?? null,
        route: m.route ?? null, laterality: m.laterality ?? null,
      })),
      opticalRx: null,
      extraCorrections: (() => {
        type FlatCorr = { label: string; re: any; le: any; method: string };
        const c1Corrs: FlatCorr[] = [];
        const extraCorrs: FlatCorr[] = [];
        const reRaw = parseJSON(rc?.re, {} as any);
        if (reRaw._v === 2) {
          const methods = (reRaw.methods || {}) as Record<string, { re: any; le: any; includedInPrint?: boolean }>;
          Object.entries(methods).forEach(([method, entry]) => {
            if (entry.includedInPrint !== false && Object.values(entry.re || {}).some(Boolean)) {
              c1Corrs.push({ label: "Correction 1", re: entry.re || {}, le: entry.le || {}, method });
            }
          });
        } else {
          const rcRe = parseJSON(rc?.re, { sph: "", cyl: "", axis: "", nearSph: "", nearCyl: "", nearAxis: "", includedInPrint: true } as any);
          if (rcRe.includedInPrint !== false) {
            c1Corrs.push({ label: "Correction 1", re: rcRe, le: parseJSON(rc?.le, {} as any), method: rcRe.method || "" });
          }
        }
        if (inclExtras) {
          const rawExtras: any[] = parseJSON((rc as any)?.extraCorrections, []);
          rawExtras.forEach((ex: any) => {
            if (ex._v === 2) {
              const methods = (ex.methods || {}) as Record<string, { re: any; le: any; includedInPrint?: boolean }>;
              Object.entries(methods).forEach(([method, entry]) => {
                if (entry.includedInPrint !== false && Object.values(entry.re || {}).some(Boolean)) {
                  extraCorrs.push({ label: ex.label, re: entry.re || {}, le: entry.le || {}, method });
                }
              });
            } else {
              if (ex.includedInPrint !== false) {
                extraCorrs.push({ label: ex.label, re: ex.re || {}, le: ex.le || {}, method: ex.re?.method || "" });
              }
            }
          });
        }
        const all = [...c1Corrs, ...extraCorrs];
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
      investigations: visit.investigationOrders.map((i: any) => ({
        testName: i.testName, priority: i.priority, status: i.status,
        result: i.result ?? null, notes: i.notes ?? null,
      })),
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
