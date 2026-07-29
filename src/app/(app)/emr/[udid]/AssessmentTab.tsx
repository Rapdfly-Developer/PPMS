"use client";

import { useState, useTransition, useRef, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { SingleChipSelect } from "@/components/ui/Chip";
import { ICD10_OPHTHALMOLOGY, DIAGNOSIS_STATUSES, LATERALITY } from "@/lib/constants";
import { saveProvisionalDiagnosis, addDiagnosis, updateDiagnosisStatus, removeDiagnosis, addMedication, saveFollowUp } from "./actions";
import { useAutoSave, SaveIndicator } from "@/lib/useAutoSave";
import { X, History, ChevronDown, Search, PenLine, Plus } from "lucide-react";
import {
  getTreatmentPresets, matchPresets, mergeMeds,
  getApplied, setApplied,
  getDismissedPresets,
  type AppliedPreset,
} from "./treatmentPresets";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast } from "@/components/ui/Toast";
import { format } from "date-fns";
import { getCustomDiagnoses, saveCustomDiagnosis, isDuplicateDescription, type CustomDx } from "@/lib/customDiagnoses";

type DiagnosisItem = { code: string; description: string; custom: boolean; category?: string };

type CustomModalState = {
  name: string;
  code: string;
  category: string;
  notes: string;
  target: "icd" | "provisional";
  error: string;
};

export function AssessmentTab({ visit, udid, priorVisits = [] }: { visit: any; udid: string; priorVisits?: any[] }) {
  const [provisionalDx, setProvisionalDx] = useState(visit.generalExam?.provisionalDx ?? "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState("");
  const [laterality, setLaterality] = useState("OU");
  const [pending, startTransition] = useTransition();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [provHistoryOpen, setProvHistoryOpen] = useState(false);
  const [showProvManual, setShowProvManual] = useState(false);
  const [provManualText, setProvManualText] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [manualText, setManualText] = useState("");
  const [confirmDxGroup, setConfirmDxGroup] = useState<any[] | null>(null);
  const [dxToast, setDxToast] = useState(false);
  const [presetToast, setPresetToast] = useState<string[]>([]);
  const [customDxList, setCustomDxList] = useState<CustomDx[]>([]);
  const [customModal, setCustomModal] = useState<CustomModalState | null>(null);

  const diagnoses: any[] = visit.diagnoses ?? [];

  useEffect(() => {
    setCustomDxList(getCustomDiagnoses());
  }, []);

  // Merged ICD-10 + custom diagnoses for search
  const allDiagnoses = useMemo<DiagnosisItem[]>(() => [
    ...ICD10_OPHTHALMOLOGY.map((d) => ({ ...d, custom: false })),
    ...customDxList.map((d) => ({ code: d.code, description: d.description, custom: true, category: d.category })),
  ], [customDxList]);

  const priorDxGroups = priorVisits
    .filter((v) => v.diagnoses?.length > 0)
    .map((v) => ({ date: v.date, diagnoses: v.diagnoses as any[] }));

  const state = useAutoSave(provisionalDx, async (text) => {
    await saveProvisionalDiagnosis(visit.id, udid, text);
  });

  const existingCodes = new Set(diagnoses.map((d: any) => d.icd10Code));

  const provisionalSuggestions = useMemo(() =>
    provisionalDx.length >= 2
      ? allDiagnoses
          .filter(
            (d) =>
              d.description.toLowerCase().includes(provisionalDx.toLowerCase()) ||
              d.code.toLowerCase().includes(provisionalDx.toLowerCase()),
          )
          .sort((a, b) => {
            const q = provisionalDx.toLowerCase();
            return (a.description.toLowerCase().startsWith(q) ? -1 : 0) -
                   (b.description.toLowerCase().startsWith(q) ? -1 : 0);
          })
          .slice(0, 8)
      : [],
  [provisionalDx, allDiagnoses]);

  const icdMatches = useMemo(() =>
    query.length > 0
      ? allDiagnoses
          .filter(
            (d) =>
              d.code.toLowerCase().includes(query.toLowerCase()) ||
              d.description.toLowerCase().includes(query.toLowerCase()),
          )
          .slice(0, 6)
      : [],
  [query, allDiagnoses]);

  const selectSuggestion = (item: DiagnosisItem) => {
    setProvisionalDx(item.description);
    setShowSuggestions(false);
    setSuggestionIndex(-1);
    // Auto-apply presets the same way ICD-10 diagnosis selection does
    startTransition(async () => {
      await autoApplyPresets([{ icd10Code: item.code ?? "", description: item.description }]);
    });
  };

  const handleProvisionalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || provisionalSuggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSuggestionIndex((i) => Math.min(i + 1, provisionalSuggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSuggestionIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && suggestionIndex >= 0) {
      e.preventDefault();
      selectSuggestion(provisionalSuggestions[suggestionIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setSuggestionIndex(-1);
    }
  };

  const openCustomModal = (target: "icd" | "provisional") => {
    const prefill = target === "icd" ? query.trim() : provisionalDx.trim();
    setCustomModal({ name: prefill, code: "", category: "", notes: "", target, error: "" });
    if (target === "icd") setQuery("");
    setShowSuggestions(false);
  };

  const handleSaveCustomDx = () => {
    if (!customModal) return;
    const name = customModal.name.trim();
    if (!name) {
      setCustomModal({ ...customModal, error: "Diagnosis name is required." });
      return;
    }
    if (isDuplicateDescription(name, ICD10_OPHTHALMOLOGY)) {
      setCustomModal({ ...customModal, error: "A diagnosis with this name already exists." });
      return;
    }
    const saved = saveCustomDiagnosis({
      code: customModal.code.trim(),
      description: name,
      category: customModal.category.trim(),
      notes: customModal.notes.trim(),
    });
    setCustomDxList((prev) => [...prev, saved]);

    if (customModal.target === "icd") {
      add(saved.code, saved.description);
    } else {
      setProvisionalDx(saved.description);
    }
    setCustomModal(null);
  };

  // After adding one or more diagnoses, auto-apply matching treatment presets to Plan
  const autoApplyPresets = async (newDiagnoses: { icd10Code: string; description: string }[]) => {
    const allPresets   = getTreatmentPresets();
    const allDx = [
      ...diagnoses.map((d: any) => ({ icd10Code: d.icd10Code, description: d.description })),
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
    for (const med of newMeds) {
      await addMedication(visit.id, udid, med);
    }

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

  const add = (code: string, description: string) => {
    startTransition(async () => {
      await addDiagnosis(visit.id, udid, { icd10Code: code, description, laterality });
      setQuery("");
      await autoApplyPresets([{ icd10Code: code, description }]);
    });
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

  const handleDxGroupDoubleClick = (dxList: any[]) => {
    if (diagnoses.length > 0) {
      setConfirmDxGroup(dxList);
    } else {
      loadDxGroup(dxList);
    }
  };

  const isCustomDiagnosis = (d: any) =>
    !d.icd10Code || customDxList.some((c) => c.description.toLowerCase() === d.description.toLowerCase());

  return (
    <>
    <div className="flex flex-col gap-5">
      <Card>
        {/* Header — identical structure to Diagnosis (ICD-10) */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-[var(--color-ink-700)]">Provisional Diagnosis</p>
          <div className="flex items-center gap-2">
            <SaveIndicator state={state} />
            <button
              type="button"
              onClick={() => setProvHistoryOpen((v) => !v)}
              className="flex items-center gap-1 text-xs text-[#0F766E] bg-[#EEF8F7] hover:bg-[#DCF3F1] font-medium px-2.5 py-0.5 rounded-full border border-[#B2DEDA] transition-colors"
            >
              <History size={11} />
              History {priorVisits.filter((v) => v.generalExam?.provisionalDx).length > 0 && `(${priorVisits.filter((v) => v.generalExam?.provisionalDx).length})`}
              <ChevronDown size={11} className={provHistoryOpen ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
          </div>
        </div>

        {/* History panel — identical structure to ICD-10 */}
        {provHistoryOpen && (
          <div className="mb-4 rounded-xl border border-[#B2DEDA] bg-[#EEF8F7] p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#0F766E]">Previous Provisional Diagnoses</p>
              <p className="text-[10px] text-[#0D9488]">Double-click to load</p>
            </div>
            {priorVisits.filter((v) => v.generalExam?.provisionalDx).length === 0 ? (
              <p className="text-xs text-[var(--color-ink-400)] py-2 text-center">No previous records found.</p>
            ) : (
              <div className="space-y-3 max-h-56 overflow-y-auto scrollbar-thin">
                {priorVisits
                  .filter((v) => v.generalExam?.provisionalDx)
                  .map((v, i) => (
                    <div
                      key={i}
                      onDoubleClick={() => { setProvisionalDx(v.generalExam.provisionalDx); setProvHistoryOpen(false); }}
                      title="Double-click to load"
                      className="cursor-pointer rounded-lg p-1.5 -mx-1.5 hover:bg-[#DCF3F1] transition-colors select-none"
                    >
                      <p className="text-[10px] font-semibold text-[var(--color-ink-400)] mb-0.5">{format(new Date(v.date), "d MMM yyyy")}</p>
                      <p className="text-xs text-[var(--color-ink-700)]">{v.generalExam.provisionalDx}</p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Controls row — identical to ICD-10 */}
        <div className="flex items-end gap-3 flex-wrap mb-2">
          <div>
            <p className="text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Laterality</p>
            <SingleChipSelect options={LATERALITY} value={laterality} onChange={setLaterality} />
          </div>
          <div className="relative flex-1 min-w-[240px]">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
            <input
              value={provisionalDx}
              onChange={(e) => { setProvisionalDx(e.target.value); setShowSuggestions(true); setSuggestionIndex(-1); }}
              onFocus={() => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current); setShowSuggestions(true); }}
              onBlur={() => { blurTimerRef.current = setTimeout(() => setShowSuggestions(false), 150); }}
              onKeyDown={handleProvisionalKeyDown}
              placeholder="Search ICD-10 code or description..."
              className="w-full rounded-xl border border-[var(--color-border)] pl-9 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
            />
            {provisionalDx && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); setProvisionalDx(""); setShowSuggestions(false); setSuggestionIndex(-1); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] transition-colors"
              >
                <X size={14} />
              </button>
            )}
            {showSuggestions && provisionalDx.length >= 2 && (
              <ul className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-[var(--color-border)] bg-white shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                {provisionalSuggestions.length === 0 ? (
                  <li>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); openCustomModal("provisional"); }}
                      className="w-full text-left px-3.5 py-3.5 text-sm flex items-center gap-2.5 text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] transition-colors"
                    >
                      <Plus size={15} className="shrink-0 text-[var(--color-primary-500)]" />
                      <span>No diagnosis found. Add <span className="font-semibold">&ldquo;{provisionalDx.trim()}&rdquo;</span> as Custom Diagnosis</span>
                    </button>
                  </li>
                ) : (
                  <>
                    {provisionalSuggestions.map((s, i) => (
                      <li key={s.code || s.description}>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
                          className={`w-full text-left px-3.5 py-2.5 text-sm text-[var(--color-ink-800)] hover:bg-[var(--color-surface-sunken)] flex items-center justify-between gap-4 transition-colors ${
                            i === suggestionIndex ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]" : ""
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
                        <span>Add &ldquo;<span className="font-medium">{provisionalDx.trim()}</span>&rdquo; as Custom Diagnosis</span>
                      </button>
                    </li>
                  </>
                )}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setShowProvManual((v) => !v); setProvManualText(""); setShowSuggestions(false); }}
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

        {/* Manual entry — identical to ICD-10 */}
        {showProvManual && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl border border-[var(--color-primary-200)] bg-[var(--color-primary-50)]">
            <input
              autoFocus
              value={provManualText}
              onChange={(e) => setProvManualText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && provManualText.trim()) {
                  setProvisionalDx(provManualText.trim());
                  setProvManualText("");
                  setShowProvManual(false);
                } else if (e.key === "Escape") {
                  setShowProvManual(false);
                }
              }}
              placeholder="Type diagnosis name..."
              className="flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
            />
            <button
              disabled={!provManualText.trim()}
              onClick={() => { setProvisionalDx(provManualText.trim()); setProvManualText(""); setShowProvManual(false); }}
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

        {/* Current value display — mirrors ICD-10 empty/filled state */}
        {!provisionalDx ? (
          <p className="text-sm text-[var(--color-ink-400)] py-4 text-center">No provisional diagnosis entered. Search above to begin.</p>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] px-3.5 py-2.5">
            <div>
              <p className="text-sm font-medium text-[var(--color-ink-900)]">{provisionalDx}</p>
              <p className="text-xs text-[var(--color-ink-400)]">{laterality} · Provisional</p>
            </div>
            <button
              type="button"
              onClick={() => { setProvisionalDx(""); }}
              className="text-[var(--color-ink-400)] hover:text-[var(--color-danger-600)]"
            >
              <X size={15} />
            </button>
          </div>
        )}
      </Card>

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
                if (e.key === "Enter" && query.trim() && icdMatches.length === 0) {
                  openCustomModal("icd");
                }
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
                          onClick={() => { add(m.code, m.description); setQuery(""); }}
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
          {/* Manual entry button */}
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

        {/* Manual entry inline form */}
        {showManual && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl border border-[var(--color-primary-200)] bg-[var(--color-primary-50)]">
            <input
              autoFocus
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && manualText.trim()) {
                  add("", manualText.trim());
                  setManualText("");
                  setShowManual(false);
                } else if (e.key === "Escape") {
                  setShowManual(false);
                }
              }}
              placeholder="Type diagnosis name..."
              className="flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
            />
            <button
              disabled={!manualText.trim() || pending}
              onClick={() => { add("", manualText.trim()); setManualText(""); setShowManual(false); }}
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
                  <button onClick={() => removeDiagnosis(d.id, udid)} className="text-[var(--color-ink-400)] hover:text-[var(--color-danger-600)]">
                    <X size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>

      {/* Custom Diagnosis Modal */}
      {customModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setCustomModal(null)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--color-border)]"
              style={{ background: "linear-gradient(135deg, #0F766E 0%, #0D9488 100%)" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                  <Plus size={15} className="text-white" />
                </div>
                <p className="text-sm font-semibold text-white">Add Custom Diagnosis</p>
              </div>
              <button type="button" onClick={() => setCustomModal(null)} className="text-white/60 hover:text-white p-1 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 flex flex-col gap-4">
              {customModal.error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{customModal.error}</p>
              )}

              {/* Diagnosis Name */}
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
                {/* ICD Code */}
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

                {/* Category */}
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

              {/* Description / Notes */}
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
                This diagnosis will be saved to your custom library and appear in future searches with a <span className="font-semibold text-amber-700">Custom</span> badge.
              </p>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[var(--color-border)] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCustomModal(null)}
                className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm font-medium text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!customModal.name.trim()}
                onClick={handleSaveCustomDx}
                className="px-5 py-2 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0D6862] transition-colors disabled:opacity-40"
              >
                Save &amp; Add
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDxGroup && (
        <ConfirmDialog
          title="Load Previous Record?"
          message="Loading this history will replace the current unsaved values. Do you want to continue?"
          onConfirm={() => { loadDxGroup(confirmDxGroup); setConfirmDxGroup(null); }}
          onCancel={() => setConfirmDxGroup(null)}
        />
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
