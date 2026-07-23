"use client";

import { useState, useTransition, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { SingleChipSelect } from "@/components/ui/Chip";
import { ICD10_OPHTHALMOLOGY, DIAGNOSIS_STATUSES, LATERALITY } from "@/lib/constants";
import { saveProvisionalDiagnosis, addDiagnosis, updateDiagnosisStatus, removeDiagnosis } from "./actions";
import { useAutoSave, SaveIndicator } from "@/lib/useAutoSave";
import { X, History, ChevronDown, Search } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast } from "@/components/ui/Toast";
import { FieldWithHistory } from "@/components/ui/HistoryToggle";
import { format } from "date-fns";

export function AssessmentTab({ visit, udid, priorVisits = [] }: { visit: any; udid: string; priorVisits?: any[] }) {
  const [provisionalDx, setProvisionalDx] = useState(visit.generalExam?.provisionalDx ?? "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState("");
  const [laterality, setLaterality] = useState("OU");
  const [pending, startTransition] = useTransition();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmDxGroup, setConfirmDxGroup] = useState<any[] | null>(null);
  const [dxToast, setDxToast] = useState(false);
  const diagnoses: any[] = visit.diagnoses ?? [];

  const priorDxGroups = priorVisits
    .filter((v) => v.diagnoses?.length > 0)
    .map((v) => ({ date: v.date, diagnoses: v.diagnoses as any[] }));

  const state = useAutoSave(provisionalDx, async (text) => {
    await saveProvisionalDiagnosis(visit.id, udid, text);
  });

  const existingCodes = new Set(diagnoses.map((d: any) => d.icd10Code));

  const provisionalSuggestions = provisionalDx.length >= 2
    ? ICD10_OPHTHALMOLOGY.filter(
        (d) =>
          d.description.toLowerCase().includes(provisionalDx.toLowerCase()) ||
          d.code.toLowerCase().includes(provisionalDx.toLowerCase())
      )
        .sort((a, b) => {
          const q = provisionalDx.toLowerCase();
          const aStart = a.description.toLowerCase().startsWith(q) ? -1 : 0;
          const bStart = b.description.toLowerCase().startsWith(q) ? -1 : 0;
          return aStart - bStart;
        })
        .slice(0, 8)
    : [];

  const selectSuggestion = (description: string) => {
    setProvisionalDx(description);
    setShowSuggestions(false);
    setSuggestionIndex(-1);
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
      selectSuggestion(provisionalSuggestions[suggestionIndex].description);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setSuggestionIndex(-1);
    }
  };

  const matches = query.length > 0 ? ICD10_OPHTHALMOLOGY.filter(
    (d) => d.code.toLowerCase().includes(query.toLowerCase()) || d.description.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 6) : [];

  const add = (code: string, description: string) => {
    startTransition(async () => {
      await addDiagnosis(visit.id, udid, { icd10Code: code, description, laterality });
      setQuery("");
    });
  };

  const loadDxGroup = (dxList: any[]) => {
    const missing = dxList.filter((d: any) => !existingCodes.has(d.icd10Code));
    startTransition(async () => {
      for (const d of missing) {
        await addDiagnosis(visit.id, udid, { icd10Code: d.icd10Code, description: d.description, laterality: d.laterality ?? "OU" });
      }
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

  return (
    <>
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1">
            <FieldWithHistory
              label="Provisional Diagnosis"
              history={priorVisits
                .filter((v) => v.generalExam?.provisionalDx)
                .map((v) => ({ date: v.date, value: v.generalExam.provisionalDx }))}
              currentValue={provisionalDx}
              onLoad={setProvisionalDx}
            >
              <div className="flex items-end gap-3 flex-wrap mt-1">
                <div>
                  <p className="text-xs text-[var(--color-ink-400)] mb-1.5">Laterality</p>
                  <SingleChipSelect options={LATERALITY} value={laterality} onChange={setLaterality} />
                </div>
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
                  <input
                    value={provisionalDx}
                    onChange={(e) => {
                      setProvisionalDx(e.target.value);
                      setShowSuggestions(true);
                      setSuggestionIndex(-1);
                    }}
                    onFocus={() => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current); setShowSuggestions(true); }}
                    onBlur={() => { blurTimerRef.current = setTimeout(() => setShowSuggestions(false), 150); }}
                    onKeyDown={handleProvisionalKeyDown}
                    placeholder="Type to search diagnosis or enter free text..."
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
                  {showSuggestions && provisionalSuggestions.length > 0 && (
                    <ul className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-[var(--color-border)] bg-white shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                      {provisionalSuggestions.map((s, i) => (
                        <li key={s.code}>
                          <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s.description); }}
                            className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between gap-4 transition-colors ${
                              i === suggestionIndex
                                ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
                                : "hover:bg-[var(--color-surface-sunken)]"
                            }`}
                          >
                            <span className="flex-1 min-w-0 truncate">{s.description}</span>
                            <span className="text-xs font-mono text-[var(--color-ink-400)] shrink-0">{s.code}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </FieldWithHistory>
          </div>
          <SaveIndicator state={state} />
        </div>
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
                      <div key={di} className="flex items-center gap-2 text-xs text-[var(--color-ink-700)] border-l-2 border-[#0F766E]/50 pl-2 mb-0.5">
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



        <div className="flex items-end gap-3 flex-wrap mb-4">
          <div>
            <p className="text-xs font-medium text-[var(--color-ink-500)] mb-1.5">Laterality</p>
            <SingleChipSelect options={LATERALITY} value={laterality} onChange={setLaterality} />
          </div>
          <div className="relative flex-1 min-w-[240px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ICD-10 (code or description)..."
              className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm"
            />
            {matches.length > 0 && (
              <ul className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-[var(--color-border)] bg-white shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                {matches.map((m) => (
                  <li key={m.code}>
                    <button
                      onClick={() => add(m.code, m.description)}
                      className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-[var(--color-primary-50)] flex items-center justify-between"
                    >
                      <span>{m.description}</span>
                      <span className="text-xs font-mono text-[var(--color-ink-400)]">{m.code}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {diagnoses.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-400)] py-4 text-center">No diagnoses added yet. Click &apos;Add Diagnosis&apos; to begin.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {diagnoses.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-xl border border-[var(--color-border)] px-3.5 py-2.5">
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink-900)]">{d.description}</p>
                  <p className="text-xs text-[var(--color-ink-400)] font-mono">{d.icd10Code} {d.laterality ? `· ${d.laterality}` : ""}</p>
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
    </>
  );
}
