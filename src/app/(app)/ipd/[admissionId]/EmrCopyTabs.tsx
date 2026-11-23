"use client";

// Doctor's Notes: a new (or edited) note is the real EMR screens (General,
// Ophthalmic, Plan) on a draft copy of the EMR. Every edit stays in the draft
// (see EmrActionsProvider); only Finalize & Sign saves it, as one note. The real
// EMR is never written. Medications are the Treatment Chart's drugs: adds and
// removes are held in the draft and applied to the chart when the note is signed.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, PenLine } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmrActionsProvider, type EmrActions } from "@/app/(app)/emr/[udid]/EmrActionsContext";
import { GeneralExamTab } from "@/app/(app)/emr/[udid]/GeneralExamTab";
import { OphthalmicExamTab } from "@/app/(app)/emr/[udid]/OphthalmicExamTab";
import { PlanTab } from "@/app/(app)/emr/[udid]/PlanTab";
import { InvestigationsTab } from "@/app/(app)/emr/[udid]/InvestigationsTab";
import { applyCopyOp, reviveDates, type CopyOp, type EmrCopy, type MergeKey } from "@/lib/ipd-emr-copy";
import {
  addIpdExtraReport, addIpdInvestigationOrder, attachIpdReport, deleteIpdInvestigationOrder, finalizeDoctorNote, removeIpdExtraReport, removeIpdReport, updateIpdInvestigationNotes,
  type NoteMedChanges,
} from "../actions";

type TabKey = "general" | "ophthalmic" | "investigations" | "plan";
const TABS: { key: TabKey; label: string }[] = [{ key: "general", label: "General" }, { key: "ophthalmic", label: "Ophthalmic" }, { key: "investigations", label: "Investigations" }, { key: "plan", label: "Plan" }];

export interface ChartDrug { id: string; name: string; dose: string; route: string; eye: string; frequency: string; instructions: string; start: string }
type NewMed = NoteMedChanges["add"][number] & { tempId: string };

const uid = () => `ipd${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const never = async () => { throw new Error("Not available in the doctor's notes."); };

export function NoteEditor({ admissionId, udid, patient, seed, noteId, drugs, orders = [], onDone, onDischarge, dischargeBlock }: {
  /** The patient's investigation orders: the same records as the EMR and the Investigation Reports tab, so they stay in sync. */
  orders?: Record<string, unknown>[];
  onDischarge?: () => void;
  dischargeBlock?: string;
  admissionId: string; udid: string; patient: { age: number; sex: string };
  /** The draft starts as this copy (the latest note, or the EMR for the first note). */
  seed: EmrCopy;
  /** Set when an existing note is being edited. */
  noteId: string | null;
  /** The Treatment Chart's active drugs. */
  drugs: ChartDrug[];
  onDone: () => void;
}) {
  const [copy, setCopy] = useState<EmrCopy>(seed);
  const copyRef = useRef<EmrCopy>(seed);
  const [added, setAdded] = useState<NewMed[]>([]);
  const [stopIds, setStopIds] = useState<string[]>([]);
  const addedRef = useRef<NewMed[]>([]);
  const stopRef = useRef<string[]>([]);
  const [tab, setTab] = useState<TabKey>("general");
  const [flushing, setFlushing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [askDiscard, setAskDiscard] = useState(false);

  // Edits only change the draft
  const run = useCallback(async (op: CopyOp) => {
    copyRef.current = applyCopyOp(copyRef.current, op);
    setCopy(copyRef.current);
  }, []);

  // The medicine list the tabs show (Plan tab and Post-op medications): the Treatment Chart's active drugs less the pending removes, plus the pending adds.
  // Signing the note applies the adds and removes to the Treatment Chart.
  const list = useMemo(() => [
    ...drugs.filter((x) => !stopIds.includes(x.id)).map((x) => ({ id: x.id, name: x.name, dose: x.dose, route: x.route, eye: x.eye, frequency: x.frequency, instructions: x.instructions, start: x.start })),
    ...added.map((m) => ({ id: m.tempId, name: m.name, dose: m.dose, route: m.route, eye: m.eye, frequency: m.frequency, instructions: m.instructions, start: "" })),
  ], [drugs, added, stopIds]);
  const listRef = useRef(list);
  useEffect(() => { listRef.current = list; addedRef.current = added; stopRef.current = stopIds; });

  const actions = useMemo<EmrActions>(() => {
    const merge = (key: MergeKey) => async (_v: string, _u: string, data: Record<string, unknown>) => { await run({ t: "merge", key, data }); };
    const scalar = (name: string) => async (_v: string, _u: string, value: string) => { await run({ t: "scalar", data: { [name]: value || null } }); };
    const toNew = (m: { drugName: string; dosage?: string | null; frequency?: string | null; duration?: string | null; instructions?: string | null; route?: string | null; laterality?: string | null }): NewMed => ({
      tempId: uid(), name: m.drugName.trim(), dose: m.dosage ?? "", route: m.route || "Topical", eye: m.laterality ?? "", frequency: m.frequency ?? "",
      instructions: [m.duration && `For ${m.duration}`, m.instructions].filter(Boolean).join(". "),
    });
    const drop = (id: string) => {
      if (addedRef.current.some((x) => x.tempId === id)) setAdded((cur) => cur.filter((x) => x.tempId !== id));
      else setStopIds((cur) => (cur.includes(id) ? cur : [...cur, id]));
    };
    const a = {
      saveGeneralExam: merge("generalExam"),
      saveVisualAcuity: merge("visualAcuity"),
      saveRefraction: merge("refraction"),
      saveColourVision: merge("colourVisionCS"),
      addIOPReading: async (_v: string, _u: string, d: { re?: number; le?: number; method: string }) => {
        const now = new Date().toISOString();
        await run({ t: "iopAdd", row: { id: uid(), re: d.re ?? null, le: d.le ?? null, method: d.method, source: "DOCTOR", reviewedByDoctor: true, takenAt: now, createdAt: now } });
      },
      removeIOPReading: async (id: string) => { await run({ t: "iopRemove", id }); },
      saveGonioNotes: async (_v: string, _u: string, d: unknown) => { await run({ t: "scalar", data: { gonioNotes: JSON.stringify(d) } }); },
      saveAnteriorSegment: merge("anteriorSegment"),
      savePosteriorSegment: merge("posteriorSegment"),
      saveDiplopia: async (_v: string, _u: string, grid: string) => { await run({ t: "merge", key: "diplopiaChart", data: { grid } }); },
      saveHess: async (_v: string, _u: string, grid: string, interpretation?: string) => { await run({ t: "merge", key: "hessChart", data: { grid, interpretation } }); },
      saveRetinoscopy: merge("retinoscopy"),
      getRefractionForVisit: async () => { const r = copyRef.current.visit.refraction; return r ? { re: r.re ?? "", le: r.le ?? "" } : null; },
      saveTearFilm: merge("tearFilm"),
      saveLacrimalSac: merge("lacrimalSac"),
      markOphthalmicReviewed: async () => undefined,
      saveOculoplasty: async (_v: string, _u: string, d: string) => { await run({ t: "scalar", data: { oculoplasty: d } }); },
      saveFollowUp: async (_v: string, _u: string, d: Record<string, unknown>) => {
        const out: Record<string, unknown> = {};
        if ("followUpDate" in d) out.followUpDate = d.followUpDate ? new Date(d.followUpDate as string).toISOString() : null;
        if ("referralEnabled" in d) out.referralEnabled = !!d.referralEnabled;
        if ("referralNote" in d) out.referralNote = d.referralNote ?? null;
        if ("inViewOf" in d) out.inViewOf = d.inViewOf ?? null;
        if ("referralType" in d) out.referralType = d.referralType === "INTERNAL" || d.referralType === "EXTERNAL" ? d.referralType : null;
        if ("referralInViewOf" in d) out.referralInViewOf = d.referralInViewOf ?? null;
        await run({ t: "scalar", data: out });
      },
      saveAdviseNotes: async (_v: string, _u: string, notes: string) => { await run({ t: "scalar", data: { adviseNotes: notes } }); },
      saveAnesthesiaType: scalar("anesthesiaType"),
      saveProcedureLaterality: scalar("procedureLaterality"),
      saveProcedureName: scalar("procedureName"),
      saveProcedureNotes: scalar("procedureNotes"),
      // Medications are the Treatment Chart's drugs; changes wait in the draft until the note is signed
      addMedication: async (_v: string, _u: string, m: Parameters<typeof toNew>[0]) => { setAdded((cur) => [...cur, toNew(m)]); },
      removeMedication: async (id: string) => { drop(id); },
      updateMedication: async (id: string, _u: string, m: Parameters<typeof toNew>[0]) => { drop(id); setAdded((cur) => [...cur, toNew(m)]); },
      // Clear All in the Plan tab clears what was added in this note (not the chart's medicines)
      clearAllMedications: async () => { setAdded([]); },
      // Investigations are the patient's real orders (the same as the EMR and the Investigation Reports tab), so they are saved at once, not held in the draft
      addInvestigationOrder: async (_v: string, _u: string, data: { category: string; testName: string; priority: string; laterality?: string; notes?: string }) => { await addIpdInvestigationOrder(admissionId, data); },
      deleteInvestigationOrder: async (id: string) => { await deleteIpdInvestigationOrder(admissionId, id); },
      updateInvestigationStatus: async () => undefined,
      attachResult: async (id: string, _u: string, ref: string) => attachIpdReport(admissionId, id, ref),
      removeResult: async (id: string) => removeIpdReport(admissionId, id),
      addExtraResult: async (id: string, _u: string, ref: string) => addIpdExtraReport(admissionId, id, ref),
      removeExtraResult: async (id: string, _u: string, ref: string) => removeIpdExtraReport(admissionId, id, ref),
      updateInvestigationDoctorNotes: async (id: string, _u: string, text: string) => { await updateIpdInvestigationNotes(admissionId, id, text); },
      saveSurgicalCounselling: never,
      clearSurgicalCounselling: never,
      saveAdmission: never,
      clearAdmission: never,
    };
    return a as unknown as EmrActions;
  }, [run]);

  const visit = useMemo(() => ({
    ...reviveDates(copy.visit),
    id: `ipdcopy-${admissionId}`,
    diagnoses: [], investigationOrders: orders, dispense: null, ipdAdmission: null, counsellingRecord: null,
    // The Plan tab's prescription starts empty in every new note: only the medicines added in this note show there.
    // (The General tab's Post-op medications and the Treatment Chart keep the full list.)
    medications: added.map((m) => ({ id: m.tempId, visitId: `ipdcopy-${admissionId}`, drugName: m.name, dosage: m.dose, frequency: m.frequency, duration: "", instructions: m.instructions, route: m.route, laterality: m.eye, createdAt: "" })),
  }), [copy, added, admissionId, orders]);

  const ipd = useMemo(() => ({ values: copy.ipd, save: (patch: Partial<EmrCopy["ipd"]>) => run({ t: "ipd", data: patch }), meds: { list }, onDischarge, dischargeBlock }), [copy.ipd, run, list, onDischarge, dischargeBlock]);

  // Finalize: unmount the tabs first so their pending autosaves reach the draft, then save
  useEffect(() => {
    if (!flushing) return;
    const t = setTimeout(async () => {
      setSaving(true);
      const meds: NoteMedChanges = { add: addedRef.current.map(({ tempId: _t, ...m }) => m), stopIds: stopRef.current };
      const r = await finalizeDoctorNote(admissionId, noteId, copyRef.current, meds);
      setSaving(false);
      setFlushing(false);
      if (r.error) setError(r.error); else onDone();
    }, 150);
    return () => clearTimeout(t);
  }, [flushing, admissionId, noteId, onDone]);

  // Close without saving; asks first when something was changed
  const cancel = () => {
    const changed = JSON.stringify(copyRef.current) !== JSON.stringify(seed) || addedRef.current.length > 0 || stopRef.current.length > 0;
    if (changed) setAskDiscard(true); else onDone();
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white">
      <div className="flex gap-5 border-b border-[var(--color-border)] px-4">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 py-2.5 text-xs font-semibold transition-colors ${tab === t.key ? "border-[var(--color-ink-900)] text-[var(--color-ink-900)]" : "border-transparent text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)]"}`}>{t.label}</button>
        ))}
      </div>

      <div className="p-4">
        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
        {!flushing && (
          <EmrActionsProvider value={{ actions, ipd }}>
            {tab === "general" && <GeneralExamTab visit={visit} priorVisits={[]} udid={udid} patient={{ age: patient.age, sex: patient.sex }} readOnly={false} />}
            {tab === "ophthalmic" && (
              <OphthalmicExamTab
                visit={visit} priorVisits={[]} udid={udid} role="DOCTOR"
                canEditVA canEditRefraction canEditColour canEditIOP canEditAnterior canEditGonioscopy canEditPosterior canEditOculoplasty
                canViewVA canViewRefraction canViewColour canViewIOP canViewAnterior canViewPosterior canViewOculoplasty
              />
            )}
            {tab === "investigations" && <InvestigationsTab visit={visit} priorVisits={[]} udid={udid} readOnly={false} />}
            {tab === "plan" && <PlanTab visit={visit} udid={udid} patientSex={patient.sex} priorVisits={[]} readOnly={false} medicationsReadOnly={false} canViewMedications />}
          </EmrActionsProvider>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-4 py-2.5">
        <button type="button" disabled={flushing || saving} onClick={cancel}
          className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-xs font-semibold text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-800)] disabled:opacity-60">
          Cancel
        </button>
        <button type="button" disabled={flushing || saving} onClick={() => { setError(""); setFlushing(true); }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary-600)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60">
          {flushing || saving ? <Loader2 size={12} className="animate-spin" /> : <PenLine size={12} />} Finalize &amp; Sign
        </button>
      </div>
      {askDiscard && (
        <ConfirmDialog
          title="Discard this note?"
          message={noteId ? "Your changes to this note will be lost." : "What you entered in this note will be lost."}
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onConfirm={() => { setAskDiscard(false); onDone(); }}
          onCancel={() => setAskDiscard(false)}
        />
      )}
    </section>
  );
}
