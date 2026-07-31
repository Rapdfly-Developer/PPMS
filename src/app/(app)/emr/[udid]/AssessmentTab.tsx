"use client";

import { useState, useTransition, useRef, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { SingleChipSelect } from "@/components/ui/Chip";
import { ICD10_OPHTHALMOLOGY, DIAGNOSIS_STATUSES, LATERALITY } from "@/lib/constants";
import { addDiagnosis, updateDiagnosisStatus, removeDiagnosis, addMedication, removeMedication, saveFollowUp } from "./actions";
import { useAutoSave, SaveIndicator } from "@/lib/useAutoSave";
import { X, History, ChevronDown, Search, PenLine, Plus } from "lucide-react";
import {
  getTreatmentPresets, saveTreatmentPresets, matchPresets, mergeMeds,
  getApplied, setApplied,
  getDismissedPresets,
  type AppliedPreset,
  type TreatmentPresetMed,
} from "./treatmentPresets";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast } from "@/components/ui/Toast";
import { format } from "date-fns";
import { getCustomDiagnoses, saveCustomDiagnosis, isDuplicateDescription, type CustomDx } from "@/lib/customDiagnoses";

type DiagnosisItem = { code: string; description: string; custom: boolean; category?: string };

type PresetMedDraft = { drugName: string; dosage: string; frequency: string; duration: string; instructions: string };

type CustomModalState = {
  name: string;
  code: string;
  category: string;
  notes: string;
  target: "icd" | "provisional";
  error: string;
  step: "diagnosis" | "preset";
  savedCode: string;
  savedDescription: string;
};

export function AssessmentTab({ visit, udid, priorVisits = [] }: { visit: any; udid: string; priorVisits?: any[] }) {
  // Split diagnoses by provisional flag
  const provisionalDiagnoses: any[] = (visit.diagnoses ?? []).filter((d: any) => d.provisional);
  const diagnoses: any[] = (visit.diagnoses ?? []).filter((d: any) => !d.provisional);

  const [provQuery, setProvQuery] = useState("");
  const [provLaterality, setProvLaterality] = useState("OU");
  const [showProvSuggestions, setShowProvSuggestions] = useState(false);
  const [provSuggestionIndex, setProvSuggestionIndex] = useState(-1);
  const provBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showProvManual, setShowProvManual] = useState(false);
  const [provManualText, setProvManualText] = useState("");
  const [provHistoryOpen, setProvHistoryOpen] = useState(false);
  const [confirmProvGroup, setConfirmProvGroup] = useState<any[] | null>(null);
  const [provDxToast, setProvDxToast] = useState(false);

  const [query, setQuery] = useState("");
  const [laterality, setLaterality] = useState("OU");
  const [pending, startTransition] = useTransition();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualText, setManualText] = useState("");
  const [confirmDxGroup, setConfirmDxGroup] = useState<any[] | null>(null);
  const [dxToast, setDxToast] = useState(false);
  const [presetToast, setPresetToast] = useState<string[]>([]);
  const [customDxList, setCustomDxList] = useState<CustomDx[]>([]);
  const [customModal, setCustomModal] = useState<CustomModalState | null>(null);
  const emptyMed = (): PresetMedDraft => ({ drugName: "", dosage: "", frequency: "", duration: "", instructions: "" });
  const [presetName, setPresetName] = useState("");
  const [presetMeds, setPresetMeds] = useState<PresetMedDraft[]>([emptyMed()]);
  const [presetFollowUpDays, setPresetFollowUpDays] = useState("");
  const [presetAdvice, setPresetAdvice] = useState("");
  const [presetInvestigations, setPresetInvestigations] = useState("");
  const [medDropdownOpen, setMedDropdownOpen] = useState(-1);
  const [allKnownMeds, setAllKnownMeds] = useState<import("./treatmentPresets").TreatmentPresetMed[]>([]);

  useEffect(() => {
    setCustomDxList(getCustomDiagnoses());
    const presets = getTreatmentPresets();
    const seen = new Set<string>();
    const meds: import("./treatmentPresets").TreatmentPresetMed[] = [];
    for (const preset of presets) {
      for (const med of preset.medications) {
        const key = med.drugName.toLowerCase();
        if (!seen.has(key)) { seen.add(key); meds.push(med); }
      }
    }
    setAllKnownMeds(meds);
  }, []);

  // Merged ICD-10 + custom diagnoses for search
  const allDiagnoses = useMemo<DiagnosisItem[]>(() => [
    ...ICD10_OPHTHALMOLOGY.map((d) => ({ ...d, custom: false })),
    ...customDxList.map((d) => ({ code: d.code, description: d.description, custom: true, category: d.category })),
  ], [customDxList]);

  // Prior visit groups — provisional
  const priorProvGroups = priorVisits
    .filter((v) => v.diagnoses?.some((d: any) => d.provisional))
    .map((v) => ({ date: v.date, diagnoses: (v.diagnoses as any[]).filter((d) => d.provisional) }));

  // Prior visit groups — ICD-10
  const priorDxGroups = priorVisits
    .filter((v) => v.diagnoses?.some((d: any) => !d.provisional))
    .map((v) => ({ date: v.date, diagnoses: (v.diagnoses as any[]).filter((d) => !d.provisional) }));

  const existingCodes = new Set(diagnoses.map((d: any) => d.icd10Code));
  const existingProvCodes = new Set(provisionalDiagnoses.map((d: any) => d.icd10Code));

  // Search suggestions — provisional
  const provSuggestions = useMemo(() =>
    provQuery.length >= 2
      ? allDiagnoses
          .filter((d) =>
            d.description.toLowerCase().includes(provQuery.toLowerCase()) ||
            d.code.toLowerCase().includes(provQuery.toLowerCase()),
          )
          .sort((a, b) => {
            const q = provQuery.toLowerCase();
            return (a.description.toLowerCase().startsWith(q) ? -1 : 0) -
                   (b.description.toLowerCase().startsWith(q) ? -1 : 0);
          })
          .slice(0, 8)
      : [],
  [provQuery, allDiagnoses]);

  // Search suggestions — ICD-10
  const icdMatches = useMemo(() =>
    query.length > 0
      ? allDiagnoses
          .filter((d) =>
            d.code.toLowerCase().includes(query.toLowerCase()) ||
            d.description.toLowerCase().includes(query.toLowerCase()),
          )
          .slice(0, 6)
      : [],
  [query, allDiagnoses]);

  const openCustomModal = (target: "icd" | "provisional") => {
    const prefill = target === "icd" ? query.trim() : provQuery.trim();
    setCustomModal({ name: prefill, code: "", category: "", notes: "", target, error: "", step: "diagnosis", savedCode: "", savedDescription: "" });
    if (target === "icd") setQuery(""); else setProvQuery("");
    setShowProvSuggestions(false);
  };

  const handleSaveCustomDx = () => {
    if (!customModal) return;
    const name = customModal.name.trim();
    if (!name) { setCustomModal({ ...customModal, error: "Diagnosis name is required." }); return; }
    if (isDuplicateDescription(name, ICD10_OPHTHALMOLOGY)) {
      setCustomModal({ ...customModal, error: "A diagnosis with this name already exists." }); return;
    }
    const saved = saveCustomDiagnosis({
      code: customModal.code.trim(),
      description: name,
      category: customModal.category.trim(),
      notes: customModal.notes.trim(),
    });
    setCustomDxList((prev) => [...prev, saved]);

    if (customModal.target === "icd") {
      addIcd(saved.code, saved.description);
    } else {
      addProv(saved.code, saved.description);
    }

    setPresetName(`${name} Protocol`);
    setPresetMeds([emptyMed()]);
    setPresetFollowUpDays("");
    setPresetAdvice("");
    setPresetInvestigations("");
    setCustomModal({ ...customModal, step: "preset", savedCode: saved.code, savedDescription: saved.description, error: "" });
  };

  const handleSavePreset = () => {
    if (!customModal) return;
    const validMeds: TreatmentPresetMed[] = presetMeds
      .filter((m) => m.drugName.trim())
      .map((m) => ({
        drugName: m.drugName.trim(),
        ...(m.dosage.trim()        && { dosage:        m.dosage.trim() }),
        ...(m.frequency.trim()     && { frequency:     m.frequency.trim() }),
        ...(m.duration.trim()      && { duration:      m.duration.trim() }),
        ...(m.instructions.trim()  && { instructions:  m.instructions.trim() }),
      }));
    const investigations = presetInvestigations.trim()
      ? presetInvestigations.split("\n").map((s) => s.trim()).filter(Boolean)
      : undefined;
    const followUpDays = presetFollowUpDays ? parseInt(presetFollowUpDays, 10) : undefined;

    const newPreset = {
      id: `tx-custom-${Date.now()}`,
      name: presetName.trim() || `${customModal.savedDescription} Protocol`,
      diagnosisCodes: customModal.savedCode ? [customModal.savedCode] : [],
      diagnosisKeywords: [customModal.savedDescription.toLowerCase()],
      medications: validMeds,
      ...(investigations && { investigations }),
      ...(presetAdvice.trim() && { advice: presetAdvice.trim() }),
      ...(followUpDays        && { followUpDays }),
      createdAt: new Date().toISOString(),
    };

    const existing = getTreatmentPresets().filter((p) => !p.isDefault);
    saveTreatmentPresets([...existing, newPreset]);

    startTransition(async () => {
      await autoApplyPresets([{ icd10Code: customModal.savedCode, description: customModal.savedDescription }]);
    });
    setCustomModal(null);
  };

  // Auto-apply matching treatment presets to Plan
  const autoApplyPresets = async (newDiagnoses: { icd10Code: string; description: string }[]) => {
    const allPresets = getTreatmentPresets();
    const allDx = [
      ...diagnoses.map((d: any) => ({ icd10Code: d.icd10Code, description: d.description })),
      ...provisionalDiagnoses.map((d: any) => ({ icd10Code: d.icd10Code, description: d.description })),
      ...newDiagnoses,
    ];
    const presetMatches = matchPresets(allDx, allPresets);
    const alreadyApplied = getApplied(visit.id);
    const dismissedIds   = getDismissedPresets(visit.id);
    const appliedIds     = new Set(alreadyApplied.map((a) => a.presetId));
    const dismissedSet   = new Set(dismissedIds);
    const toApply        = presetMatches.filter((m) => !appliedIds.has(m.preset.id) && !dismissedSet.has(m.preset.id));

    if (toApply.length === 0) return;

    const newRecords: AppliedPreset[] = toApply.map((m) => ({
      presetId:      m.preset.id,
      presetName:    m.preset.name,
      appliedAt:     new Date().toISOString(),
      diagnosisDesc: m.diagnosisDesc,
    }));
    setApplied(visit.id, [...alreadyApplied, ...newRecords]);

    const presetsToApply = toApply.map((m) => m.preset);
    const currentMeds: { drugName: string }[] = visit.medications ?? [];
    const newMeds = mergeMeds(presetsToApply, currentMeds);
    for (const med of newMeds) { await addMedication(visit.id, udid, med); }

    if (!visit.followUpDate) {
      const days = presetsToApply.map((p) => p.followUpDays).filter((d): d is number => !!d);
      if (days.length > 0) {
        const fuDate = new Date();
        fuDate.setDate(fuDate.getDate() + Math.min(...days));
        await saveFollowUp(visit.id, udid, {
          followUpDate:    fuDate.toISOString(),
          referralEnabled: visit.referralEnabled ?? false,
          referralNote:    visit.referralNote ?? null,
        });
      }
    }

    setPresetToast(presetsToApply.map((p) => p.name));
    setTimeout(() => setPresetToast([]), 5000);
  };

  // Remove preset meds when a diagnosis is deleted
  const autoRemovePresetMeds = async (removedDesc: string) => {
    const allPresets = getTreatmentPresets();
    const applied    = getApplied(visit.id);

    const allCurrentDx = [
      ...(diagnoses as any[]).map((d) => ({ icd10Code: d.icd10Code ?? "", description: d.description })),
      ...(provisionalDiagnoses as any[]).map((d) => ({ icd10Code: d.icd10Code ?? "", description: d.description })),
    ];
    const remainingDx = allCurrentDx.filter((d) => d.description !== removedDesc);

    const beforeIds = new Set(matchPresets(allCurrentDx, allPresets).map((m) => m.preset.id));
    const afterIds  = new Set(matchPresets(remainingDx,  allPresets).map((m) => m.preset.id));

    const lostPresets = allPresets.filter((p) => beforeIds.has(p.id) && !afterIds.has(p.id));
    if (lostPresets.length === 0) return;

    const drugNamesToRemove = new Set<string>();
    lostPresets.forEach((p) => p.medications.forEach((m) => drugNamesToRemove.add(m.drugName.toLowerCase())));

    const currentMeds: any[] = visit.medications ?? [];
    const medsToDelete = currentMeds.filter((m) => drugNamesToRemove.has(m.drugName.toLowerCase()));
    for (const med of medsToDelete) { await removeMedication(med.id, udid); }

    const lostIds = new Set(lostPresets.map((p) => p.id));
    setApplied(visit.id, applied.filter((a) => !lostIds.has(a.presetId)));

    if (medsToDelete.length > 0) {
      setPresetToast([`Removed ${medsToDelete.length} preset medication${medsToDelete.length > 1 ? "s" : ""} from Plan`]);
      setTimeout(() => setPresetToast([]), 4000);
    }
  };

  // Add provisional diagnosis
  const addProv = (code: string, description: string) => {
    startTransition(async () => {
      await addDiagnosis(visit.id, udid, { icd10Code: code, description, laterality: provLaterality, provisional: true });
      setProvQuery("");
      await autoApplyPresets([{ icd10Code: code, description }]);
    });
  };

  // Add ICD-10 diagnosis
  const addIcd = (code: string, description: string) => {
    startTransition(async () => {
      await addDiagnosis(visit.id, udid, { icd10Code: code, description, laterality });
      setQuery("");
      await autoApplyPresets([{ icd10Code: code, description }]);
    });
  };

  const loadProvGroup = (dxList: any[]) => {
    const missing = dxList.filter((d: any) => !existingProvCodes.has(d.icd10Code));
    startTransition(async () => {
      for (const d of missing) {
        await addDiagnosis(visit.id, udid, { icd10Code: d.icd10Code, description: d.description, laterality: d.laterality ?? "OU", provisional: true });
      }
      await autoApplyPresets(missing.map((d: any) => ({ icd10Code: d.icd10Code, description: d.description })));
    });
    setProvHistoryOpen(false);
    setProvDxToast(true);
  };

  const loadDxGroup = (dxList: any[]) => {
    const missing = dxList.filter((d: any) => !existingCodes.has(d.icd10Code));
    startTransition(async () => {
      for (const d of missing) {
        await addDiagnosis(visit.id, udid, { icd10Code: d.icd10Code, description: d.description, laterality: d.laterality ?? "OU" });
      }
      await autoApplyPresets(missing.map((d: any) => ({ icd10Code: d.icd10Code, description: d.description })));
    });
    setHistoryOpen(false);
    setDxToast(true);
  };

  const handleProvGroupDoubleClick = (dxList: any[]) => {
    if (provisionalDiagnoses.length > 0) setConfirmProvGroup(dxList);
    else loadProvGroup(dxList);
  };

  const handleDxGroupDoubleClick = (dxList: any[]) => {
    if (diagnoses.length > 0) setConfirmDxGroup(dxList);
    else loadDxGroup(dxList);
  };

  const isCustomDiagnosis = (d: any) =>
    !d.icd10Code || customDxList.some((c) => c.description.toLowerCase() === d.description.toLowerCase());

  const handleProvKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showProvSuggestions || provSuggestions.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setProvSuggestionIndex((i) => Math.min(i + 1, provSuggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setProvSuggestionIndex((i) => Math.max(i - 1, -1)); }
    else if (e.key === "Enter" && provSuggestionIndex >= 0) { e.preventDefault(); addProv(provSuggestions[provSuggestionIndex].code, provSuggestions[provSuggestionIndex].description); setShowProvSuggestions(false); setProvSuggestionIndex(-1); }
    else if (e.key === "Escape") { setShowProvSuggestions(false); setProvSuggestionIndex(-1); }
  };

  return (
    <>
    <div className="flex flex-col gap-5">

      {/* ── Provisional Diagnosis ─────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-[var(--color-ink-700)]">Provisional Diagnosis</p>
          <button
            type="button"
            onClick={() => setProvHistoryOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-[#0F766E] bg-[#EEF8F7] hover:bg-[#DCF3F1] font-medium px-2.5 py-0.5 rounded-full border border-[#B2DEDA] transition-colors"
          >
            <History size={11} />
            History {priorProvGroups.length > 0 && `(${priorProvGroups.length})`}
            <ChevronDown size={11} className={provHistoryOpen ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
        </div>

        {provHistoryOpen && (
          <div className="mb-4 rounded-xl border border-[#B2DEDA] bg-[#EEF8F7] p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#0F766E]">Previous Provisional Diagnoses</p>
              {priorProvGroups.length > 0 && (
                <p className="text-[10px] text-[#0D9488]">Double-click a visit to load its diagnoses</p>
              )}
            </div>
            {priorProvGroups.length === 0 ? (
              <p className="text-xs text-[var(--color-ink-400)] py-2 text-center">No previous records found.</p>
            ) : (
              <div className="space-y-3 max-h-56 overflow-y-auto scrollbar-thin">
                {priorProvGroups.map((g, gi) => (
                  <div
                    key={gi}
                    onDoubleClick={() => handleProvGroupDoubleClick(g.diagnoses)}
                    title="Double-click to add these diagnoses"
                    className="cursor-pointer rounded-lg p-1.5 -mx-1.5 hover:bg-[#DCF3F1] transition-colors select-none"
                  >
                    <p className="text-[10px] font-semibold text-[var(--color-ink-400)] mb-1">{format(new Date(g.date), "d MMM yyyy")}</p>
                    {g.diagnoses.map((d: any, di: number) => (
                      <div key={di} className="flex items-center gap-2 text-xs text-[var(--color-ink-700)] mb-0.5">
                        <span className="font-medium">{d.description}</span>
                        {d.laterality && <span className="text-[var(--color-ink-400)]">{d.laterality}</span>}
                        {d.icd10Code && <span className="font-mono text-[var(--color-ink-400)]">{d.icd10Code}</span>}
                        <span className="ml-auto text-[10px] text-[var(--color-ink-400)]">{d.status}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-end gap-3 flex-wrap mb-2">
          <div>
            <p className="text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Laterality</p>
            <SingleChipSelect options={LATERALITY} value={provLaterality} onChange={setProvLaterality} />
          </div>
          <div className="relative flex-1 min-w-[240px]">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
            <input
              value={provQuery}
              onChange={(e) => { setProvQuery(e.target.value); setShowProvSuggestions(true); setProvSuggestionIndex(-1); }}
              onFocus={() => { if (provBlurTimerRef.current) clearTimeout(provBlurTimerRef.current); setShowProvSuggestions(true); }}
              onBlur={() => { provBlurTimerRef.current = setTimeout(() => setShowProvSuggestions(false), 150); }}
              onKeyDown={handleProvKeyDown}
              placeholder="Search ICD-10 code or description..."
              className="w-full rounded-xl border border-[var(--color-border)] pl-9 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
            />
            {showProvSuggestions && provQuery.length >= 2 && (
              <ul className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-[var(--color-border)] bg-white shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                {provSuggestions.length === 0 ? (
                  <li>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); openCustomModal("provisional"); }}
                      className="w-full text-left px-3.5 py-3.5 text-sm flex items-center gap-2.5 text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] transition-colors"
                    >
                      <Plus size={15} className="shrink-0 text-[var(--color-primary-500)]" />
                      <span>No diagnosis found. Add <span className="font-semibold">&ldquo;{provQuery.trim()}&rdquo;</span> as Custom Diagnosis</span>
                    </button>
                  </li>
                ) : (
                  <>
                    {provSuggestions.map((s, i) => (
                      <li key={s.code || s.description}>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); addProv(s.code, s.description); setShowProvSuggestions(false); setProvSuggestionIndex(-1); }}
                          className={`w-full text-left px-3.5 py-2.5 text-sm text-[var(--color-ink-800)] hover:bg-[var(--color-surface-sunken)] flex items-center justify-between gap-4 transition-colors ${
                            i === provSuggestionIndex ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]" : ""
                          }`}
                        >
                          <span className="flex-1 min-w-0 truncate">{s.description}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {s.custom && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Custom</span>
                            )}
                            {s.code && <span className="text-xs font-mono text-[var(--color-ink-400)]">{s.code}</span>}
                          </div>
                        </button>
                      </li>
                    ))}
                    <li className="border-t border-[var(--color-border)]">
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); openCustomModal("provisional"); }}
                        className="w-full text-left px-3.5 py-2.5 text-sm flex items-center gap-2 text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] transition-colors"
                      >
                        <Plus size={13} className="shrink-0" />
                        <span>Add &ldquo;<span className="font-medium">{provQuery.trim()}</span>&rdquo; as Custom Diagnosis</span>
                      </button>
                    </li>
                  </>
                )}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setShowProvManual((v) => !v); setProvManualText(""); setShowProvSuggestions(false); }}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2.5 rounded-xl border transition-colors whitespace-nowrap ${
              showProvManual
                ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]"
                : "bg-white text-[var(--color-ink-600)] border-[var(--color-border)] hover:border-[var(--color-primary-400)] hover:text-[var(--color-primary-600)]"
            }`}
          >
            <PenLine size={13} />
            Add Manually
          </button>
        </div>

        {showProvManual && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl border border-[var(--color-primary-200)] bg-[var(--color-primary-50)]">
            <input
              autoFocus
              value={provManualText}
              onChange={(e) => setProvManualText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && provManualText.trim()) {
                  addProv("", provManualText.trim());
                  setProvManualText(""); setShowProvManual(false);
                } else if (e.key === "Escape") { setShowProvManual(false); }
              }}
              placeholder="Type diagnosis name..."
              className="flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
            />
            <button
              disabled={!provManualText.trim() || pending}
              onClick={() => { addProv("", provManualText.trim()); setProvManualText(""); setShowProvManual(false); }}
              className="px-3.5 py-2 rounded-lg bg-[var(--color-primary-600)] text-white text-sm font-medium hover:bg-[var(--color-primary-700)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => { setShowProvManual(false); setProvManualText(""); }}
              className="p-2 rounded-lg text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] hover:bg-white transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {provisionalDiagnoses.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-400)] py-4 text-center">No provisional diagnoses added yet. Search above to begin.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {provisionalDiagnoses.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-xl border border-[var(--color-border)] px-3.5 py-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--color-ink-900)]">{d.description}</p>
                    {isCustomDiagnosis(d) && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Custom</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-ink-400)] font-mono">
                    {d.icd10Code || "—"} {d.laterality ? `· ${d.laterality}` : ""} · Provisional
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={d.status}
                    onChange={(e) => updateDiagnosisStatus(d.id, udid, e.target.value)}
                    className="text-xs rounded-lg border border-[var(--color-border)] px-2 py-1 bg-white"
                  >
                    {DIAGNOSIS_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => startTransition(async () => { await autoRemovePresetMeds(d.description); await removeDiagnosis(d.id, udid); })}
                    className="text-[var(--color-ink-400)] hover:text-[var(--color-danger-600)]"
                  >
                    <X size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── Diagnosis (ICD-10) ────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-[var(--color-ink-700)]">Diagnosis (ICD-10)</p>
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-[#0F766E] bg-[#EEF8F7] hover:bg-[#DCF3F1] font-medium px-2.5 py-0.5 rounded-full border border-[#B2DEDA] transition-colors"
          >
            <History size={11} />
            History {priorDxGroups.length > 0 && `(${priorDxGroups.length})`}
            <ChevronDown size={11} className={historyOpen ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
        </div>
        {historyOpen && (
          <div className="mb-4 rounded-xl border border-[#B2DEDA] bg-[#EEF8F7] p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#0F766E]">Previous Diagnoses</p>
              {priorDxGroups.length > 0 && (
                <p className="text-[10px] text-[#0D9488]">Double-click a visit to load its diagnoses</p>
              )}
            </div>
            {priorDxGroups.length === 0 ? (
              <p className="text-xs text-[var(--color-ink-400)] py-2 text-center">No previous records found.</p>
            ) : (
              <div className="space-y-3 max-h-56 overflow-y-auto scrollbar-thin">
                {priorDxGroups.map((g, gi) => (
                  <div
                    key={gi}
                    onDoubleClick={() => handleDxGroupDoubleClick(g.diagnoses)}
                    title="Double-click to add these diagnoses"
                    className="cursor-pointer rounded-lg p-1.5 -mx-1.5 hover:bg-[#DCF3F1] transition-colors select-none"
                  >
                    <p className="text-[10px] font-semibold text-[var(--color-ink-400)] mb-1">{format(new Date(g.date), "d MMM yyyy")}</p>
                    {g.diagnoses.map((d: any, di: number) => (
                      <div key={di} className="flex items-center gap-2 text-xs text-[var(--color-ink-700)] mb-0.5">
                        <span className="font-medium">{d.description}</span>
                        {d.laterality && <span className="text-[var(--color-ink-400)]">{d.laterality}</span>}
                        <span className="font-mono text-[var(--color-ink-400)]">{d.icd10Code}</span>
                        <span className="ml-auto text-[10px] text-[var(--color-ink-400)]">{d.status}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-end gap-3 flex-wrap mb-2">
          <div>
            <p className="text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Laterality</p>
            <SingleChipSelect options={LATERALITY} value={laterality} onChange={setLaterality} />
          </div>
          <div className="relative flex-1 min-w-[240px]">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowManual(false); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim() && icdMatches.length === 0) openCustomModal("icd");
              }}
              placeholder="Search ICD-10 code or description..."
              className="w-full rounded-xl border border-[var(--color-border)] pl-9 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
            />
            {query.length > 0 && (
              <ul className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-[var(--color-border)] bg-white shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                {icdMatches.length === 0 ? (
                  <li>
                    <button
                      onClick={() => openCustomModal("icd")}
                      className="w-full text-left px-3.5 py-3.5 text-sm flex items-center gap-2.5 text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] transition-colors"
                    >
                      <Plus size={15} className="shrink-0 text-[var(--color-primary-500)]" />
                      <span>No diagnosis found. Add <span className="font-semibold">&ldquo;{query.trim()}&rdquo;</span> as Custom Diagnosis</span>
                    </button>
                  </li>
                ) : (
                  <>
                    {icdMatches.map((m) => (
                      <li key={m.code || m.description}>
                        <button
                          onClick={() => { addIcd(m.code, m.description); setQuery(""); }}
                          className="w-full text-left px-3.5 py-2.5 text-sm text-[var(--color-ink-800)] hover:bg-[var(--color-surface-sunken)] flex items-center justify-between gap-4"
                        >
                          <span className="flex-1 min-w-0 truncate">{m.description}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {m.custom && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Custom</span>
                            )}
                            {m.code && <span className="text-xs font-mono text-[var(--color-ink-400)]">{m.code}</span>}
                          </div>
                        </button>
                      </li>
                    ))}
                    <li className="border-t border-[var(--color-border)]">
                      <button
                        onClick={() => openCustomModal("icd")}
                        className="w-full text-left px-3.5 py-2.5 text-sm flex items-center gap-2 text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] transition-colors"
                      >
                        <Plus size={13} className="shrink-0" />
                        <span>Add &ldquo;<span className="font-medium">{query.trim()}</span>&rdquo; as Custom Diagnosis</span>
                      </button>
                    </li>
                  </>
                )}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setShowManual((v) => !v); setManualText(""); setQuery(""); }}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2.5 rounded-xl border transition-colors whitespace-nowrap ${
              showManual
                ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]"
                : "bg-white text-[var(--color-ink-600)] border-[var(--color-border)] hover:border-[var(--color-primary-400)] hover:text-[var(--color-primary-600)]"
            }`}
          >
            <PenLine size={13} />
            Add Manually
          </button>
        </div>

        {showManual && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl border border-[var(--color-primary-200)] bg-[var(--color-primary-50)]">
            <input
              autoFocus
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && manualText.trim()) {
                  addIcd("", manualText.trim()); setManualText(""); setShowManual(false);
                } else if (e.key === "Escape") { setShowManual(false); }
              }}
              placeholder="Type diagnosis name..."
              className="flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
            />
            <button
              disabled={!manualText.trim() || pending}
              onClick={() => { addIcd("", manualText.trim()); setManualText(""); setShowManual(false); }}
              className="px-3.5 py-2 rounded-lg bg-[var(--color-primary-600)] text-white text-sm font-medium hover:bg-[var(--color-primary-700)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => { setShowManual(false); setManualText(""); }}
              className="p-2 rounded-lg text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] hover:bg-white transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {diagnoses.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-400)] py-4 text-center">No diagnoses added yet. Search above to begin.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {diagnoses.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-xl border border-[var(--color-border)] px-3.5 py-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--color-ink-900)]">{d.description}</p>
                    {isCustomDiagnosis(d) && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Custom</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-ink-400)] font-mono">
                    {d.icd10Code || "—"} {d.laterality ? `· ${d.laterality}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={d.status}
                    onChange={(e) => updateDiagnosisStatus(d.id, udid, e.target.value)}
                    className="text-xs rounded-lg border border-[var(--color-border)] px-2 py-1 bg-white"
                  >
                    {DIAGNOSIS_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button onClick={() => startTransition(async () => { await autoRemovePresetMeds(d.description); await removeDiagnosis(d.id, udid); })} className="text-[var(--color-ink-400)] hover:text-[var(--color-danger-600)]">
                    <X size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>

      {/* Custom Diagnosis → Add Preset modal */}
      {customModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setCustomModal(null)}
        >
          <div
            className={`relative w-full rounded-2xl shadow-2xl overflow-hidden bg-white ${customModal.step === "preset" ? "max-w-xl" : "max-w-md"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="px-5 py-4 flex items-center justify-between border-b border-[var(--color-border)]"
              style={{ background: "linear-gradient(135deg, #0F766E 0%, #0D9488 100%)" }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                  <Plus size={15} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {customModal.step === "preset" ? "Add Treatment Preset" : "Add Custom Diagnosis"}
                  </p>
                  {customModal.step === "preset" && (
                    <p className="text-xs text-white/70 mt-0.5">for <span className="font-medium text-white">{customModal.savedDescription}</span></p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 mr-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${customModal.step === "diagnosis" ? "bg-white text-[#0F766E]" : "bg-white/30 text-white"}`}>1</div>
                  <div className="w-4 h-px bg-white/30" />
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${customModal.step === "preset" ? "bg-white text-[#0F766E]" : "bg-white/30 text-white"}`}>2</div>
                </div>
                <button type="button" onClick={() => setCustomModal(null)} className="text-white/60 hover:text-white p-1 transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {customModal.step === "diagnosis" && (
              <>
                <div className="px-5 py-4 flex flex-col gap-4">
                  {customModal.error && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{customModal.error}</p>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1.5">
                      Diagnosis Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      autoFocus
                      value={customModal.name}
                      onChange={(e) => setCustomModal({ ...customModal, name: e.target.value, error: "" })}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveCustomDx(); }}
                      placeholder="e.g. Bilateral Exophoria"
                      className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1.5">
                        ICD Code <span className="text-[var(--color-ink-300)] font-normal">(optional)</span>
                      </label>
                      <input
                        value={customModal.code}
                        onChange={(e) => setCustomModal({ ...customModal, code: e.target.value })}
                        placeholder="e.g. H50.9"
                        className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1.5">
                        Category <span className="text-[var(--color-ink-300)] font-normal">(optional)</span>
                      </label>
                      <input
                        value={customModal.category}
                        onChange={(e) => setCustomModal({ ...customModal, category: e.target.value })}
                        placeholder="e.g. Strabismus"
                        className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1.5">
                      Description <span className="text-[var(--color-ink-300)] font-normal">(optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={customModal.notes}
                      onChange={(e) => setCustomModal({ ...customModal, notes: e.target.value })}
                      placeholder="Any additional notes about this diagnosis..."
                      className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                    />
                  </div>
                  <p className="text-[11px] text-[var(--color-ink-400)] -mt-1">
                    Saved to your custom library. Next step: add a treatment preset so medications auto-populate in Plan.
                  </p>
                </div>
                <div className="px-5 py-4 border-t border-[var(--color-border)] flex items-center justify-end gap-2">
                  <button type="button" onClick={() => setCustomModal(null)}
                    className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm font-medium text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] transition-colors">
                    Cancel
                  </button>
                  <button type="button" disabled={!customModal.name.trim()} onClick={handleSaveCustomDx}
                    className="px-5 py-2 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0D6862] transition-colors disabled:opacity-40">
                    Save &amp; Add →
                  </button>
                </div>
              </>
            )}

            {customModal.step === "preset" && (
              <>
                <div className="px-5 py-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1.5">Preset Name</label>
                    <input
                      autoFocus
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="e.g. Infection Protocol"
                      className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-[var(--color-ink-600)]">Medications</label>
                      <button type="button" onClick={() => setPresetMeds((p) => [...p, emptyMed()])}
                        className="flex items-center gap-1 text-xs text-[var(--color-primary-600)] hover:text-[var(--color-primary-800)] font-medium transition-colors">
                        <Plus size={12} /> Add
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {presetMeds.map((m, i) => {
                        const medQuery = m.drugName.toLowerCase();
                        const medSuggestions = medQuery.length >= 1
                          ? allKnownMeds.filter((med) => med.drugName.toLowerCase().includes(medQuery)).slice(0, 8)
                          : [];
                        return (
                        <div key={i} className="rounded-xl border border-[var(--color-border)] p-3 flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <input
                                value={m.drugName}
                                onChange={(e) => { setPresetMeds((p) => p.map((r, idx) => idx === i ? { ...r, drugName: e.target.value } : r)); setMedDropdownOpen(i); }}
                                onFocus={() => setMedDropdownOpen(i)}
                                onBlur={() => setTimeout(() => setMedDropdownOpen((v) => v === i ? -1 : v), 150)}
                                placeholder="Drug name *"
                                autoComplete="off"
                                className="w-full rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                              />
                              {medDropdownOpen === i && medSuggestions.length > 0 && (
                                <ul className="absolute z-30 left-0 right-0 mt-1 rounded-xl border border-[var(--color-border)] bg-white shadow-xl overflow-hidden max-h-52 overflow-y-auto">
                                  {medSuggestions.map((med, mi) => (
                                    <li key={mi}>
                                      <button
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          setPresetMeds((p) => p.map((r, idx) => idx === i ? {
                                            drugName:     med.drugName,
                                            dosage:       med.dosage       ?? "",
                                            frequency:    med.frequency    ?? "",
                                            duration:     med.duration     ?? "",
                                            instructions: med.instructions ?? "",
                                          } : r));
                                          setMedDropdownOpen(-1);
                                        }}
                                        className="w-full text-left px-3.5 py-2 hover:bg-[var(--color-surface-sunken)] transition-colors"
                                      >
                                        <p className="text-xs font-medium text-[var(--color-ink-800)] truncate">{med.drugName}</p>
                                        {(med.dosage || med.frequency || med.duration) && (
                                          <p className="text-[11px] text-[var(--color-ink-400)] mt-0.5 truncate">
                                            {[med.dosage, med.frequency, med.duration].filter(Boolean).join(" · ")}
                                          </p>
                                        )}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            {presetMeds.length > 1 && (
                              <button type="button" onClick={() => setPresetMeds((p) => p.filter((_, idx) => idx !== i))}
                                className="text-[var(--color-ink-400)] hover:text-[var(--color-danger-600)] transition-colors flex-shrink-0">
                                <X size={14} />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {(["dosage", "frequency", "duration"] as const).map((field) => (
                              <input key={field}
                                value={m[field]}
                                onChange={(e) => setPresetMeds((p) => p.map((r, idx) => idx === i ? { ...r, [field]: e.target.value } : r))}
                                placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                                className="rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                              />
                            ))}
                          </div>
                          <input
                            value={m.instructions}
                            onChange={(e) => setPresetMeds((p) => p.map((r, idx) => idx === i ? { ...r, instructions: e.target.value } : r))}
                            placeholder="Instructions (optional)"
                            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                          />
                        </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1.5">
                        Follow-up <span className="text-[var(--color-ink-300)] font-normal">(days)</span>
                      </label>
                      <input
                        type="number" min="1" max="365"
                        value={presetFollowUpDays}
                        onChange={(e) => setPresetFollowUpDays(e.target.value)}
                        placeholder="e.g. 7"
                        className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1.5">
                        Investigations <span className="text-[var(--color-ink-300)] font-normal">(one per line)</span>
                      </label>
                      <textarea rows={2}
                        value={presetInvestigations}
                        onChange={(e) => setPresetInvestigations(e.target.value)}
                        placeholder={"Visual Acuity\nIOP measurement"}
                        className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1.5">
                      Advice <span className="text-[var(--color-ink-300)] font-normal">(optional)</span>
                    </label>
                    <textarea rows={2}
                      value={presetAdvice}
                      onChange={(e) => setPresetAdvice(e.target.value)}
                      placeholder="Patient advice to include in the plan..."
                      className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                    />
                  </div>
                </div>
                <div className="px-5 py-4 border-t border-[var(--color-border)] flex items-center justify-between gap-2">
                  <button type="button" onClick={() => setCustomModal(null)}
                    className="text-xs text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] transition-colors">
                    Skip for now
                  </button>
                  <div className="flex items-center gap-2">
                    <button type="button"
                      disabled={!presetMeds.some((m) => m.drugName.trim())}
                      onClick={handleSavePreset}
                      className="px-5 py-2 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0D6862] transition-colors disabled:opacity-40">
                      Save Preset &amp; Apply to Plan
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {confirmProvGroup && (
        <ConfirmDialog
          title="Load Previous Record?"
          message="Loading this history will add any missing provisional diagnoses. Do you want to continue?"
          onConfirm={() => { loadProvGroup(confirmProvGroup); setConfirmProvGroup(null); }}
          onCancel={() => setConfirmProvGroup(null)}
        />
      )}
      {confirmDxGroup && (
        <ConfirmDialog
          title="Load Previous Record?"
          message="Loading this history will replace the current unsaved values. Do you want to continue?"
          onConfirm={() => { loadDxGroup(confirmDxGroup); setConfirmDxGroup(null); }}
          onCancel={() => setConfirmDxGroup(null)}
        />
      )}
      {provDxToast && (
        <Toast message="Previous provisional diagnoses loaded." onDone={() => setProvDxToast(false)} />
      )}
      {dxToast && (
        <Toast message="Previous record loaded successfully." onDone={() => setDxToast(false)} />
      )}
      {presetToast.length > 0 && (
        <Toast
          message={`✨ Plan updated: ${presetToast.join(", ")}`}
          onDone={() => setPresetToast([])}
        />
      )}
    </>
  );
}
