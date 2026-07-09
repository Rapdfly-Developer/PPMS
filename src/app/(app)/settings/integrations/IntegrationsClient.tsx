"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Plug, CheckCircle2, XCircle, Clock, RefreshCw, Settings2,
  Zap, ZapOff, X, AlertCircle, Eye, Download, Loader2, Network,
} from "lucide-react";
import {
  saveIntegration, toggleSyncEnabled, testHospitalConnection, retryIntegrationLog,
  type IntegrationFormData,
} from "./actions";

/* ── Types ──────────────────────────────────────────────────────────────────── */
type HospitalRow = {
  id: string;
  name: string;
  shortCode: string;
  integration: {
    integrationType: string;
    apiEndpoint: string | null;
    authType: string;
    oauthTokenUrl: string | null;
    fieldMappingJson: string | null;
    transformationRules: string | null;
    maxRetries: number;
    syncEnabled: boolean;
    hasCredentials: boolean;
    updatedAt: string;
  } | null;
};

type LogRow = {
  id: string;
  hospitalName: string;
  patientName: string | null;
  patientUdid: string | null;
  visitId: string | null;
  status: string;
  triggeredBy: string | null;
  retryCount: number;
  errorMessage: string | null;
  requestPayload: string | null;
  responsePayload: string | null;
  createdAt: string;
  updatedAt: string;
};

const TYPE_BADGE: Record<string, string> = {
  FHIR: "bg-violet-50 text-violet-700 border-violet-200",
  HL7:  "bg-blue-50 text-blue-700 border-blue-200",
  REST: "bg-teal-50 text-teal-700 border-teal-200",
  CSV:  "bg-amber-50 text-amber-700 border-amber-200",
};

/* ── Status badge ───────────────────────────────────────────────────────────── */
function LogStatusBadge({ status }: { status: string }) {
  if (status === "SUCCESS")
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 size={10} /> Success</span>;
  if (status === "FAILED")
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700"><XCircle size={10} /> Failed</span>;
  return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><Clock size={10} /> Pending</span>;
}

/* ── Config modal ───────────────────────────────────────────────────────────── */
function ConfigModal({ hospital, onClose }: { hospital: HospitalRow; onClose: () => void }) {
  const router = useRouter();
  const existing = hospital.integration;
  const [form, setForm] = useState<IntegrationFormData>({
    integrationType: existing?.integrationType ?? "REST",
    apiEndpoint: existing?.apiEndpoint ?? "",
    authType: existing?.authType ?? "NONE",
    credentials: "",
    oauthTokenUrl: existing?.oauthTokenUrl ?? "",
    fieldMappingJson: existing?.fieldMappingJson ?? "",
    transformationRules: existing?.transformationRules ?? "",
    maxRetries: existing?.maxRetries ?? 3,
    syncEnabled: existing?.syncEnabled ?? false,
  });
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; detail: string } | null>(null);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();

  const set = (patch: Partial<IntegrationFormData>) => setForm((f) => ({ ...f, ...patch }));

  const handleSave = () => {
    setError(null);
    startSave(async () => {
      const res = await saveIntegration(hospital.id, form);
      if (res.error) { setError(res.error); return; }
      router.refresh();
      onClose();
    });
  };

  const handleTest = () => {
    setError(null);
    setTestResult(null);
    startTest(async () => {
      // Save first so the test uses what's on screen
      const res = await saveIntegration(hospital.id, form);
      if (res.error) { setError(res.error); return; }
      const test = await testHospitalConnection(hospital.id);
      setTestResult(test);
      router.refresh();
    });
  };

  const inputCls = "w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--color-primary-500)] bg-white";
  const labelCls = "block text-xs font-semibold text-[var(--color-ink-600)] mb-1 mt-3";

  const credentialPlaceholder =
    form.authType === "API_KEY" ? "API key" :
    form.authType === "BEARER" ? "Bearer token" :
    form.authType === "BASIC" ? "username:password" :
    form.authType === "OAUTH2" ? '{"clientId":"…","clientSecret":"…"}' : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget && !saving && !testing) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 my-8 text-[var(--color-ink-900)]">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-[var(--color-ink-800)]">Integration — {hospital.name}</h2>
          <button onClick={onClose} className="text-[var(--color-ink-400)] hover:text-[var(--color-ink-800)]"><X size={18} /></button>
        </div>
        <p className="text-xs text-[var(--color-ink-400)] mb-3">
          PPMS converts each finalized visit to a standard clinical record, then this adapter translates and transmits it.
        </p>

        <label className={labelCls}>Integration Type</label>
        <select value={form.integrationType} onChange={(e) => set({ integrationType: e.target.value })} className={`${inputCls} cursor-pointer`}>
          <option value="FHIR">FHIR R4 (modern healthcare systems)</option>
          <option value="HL7">HL7 v2.5 over HTTPS (enterprise HIS)</option>
          <option value="REST">REST JSON (custom HMIS API)</option>
          <option value="CSV">CSV (file export / legacy)</option>
        </select>

        <label className={labelCls}>API Endpoint {form.integrationType === "CSV" && <span className="font-normal text-[var(--color-ink-400)]">(optional — blank = file export)</span>}</label>
        <input value={form.apiEndpoint} onChange={(e) => set({ apiEndpoint: e.target.value })} placeholder="https://his.hospital.example/api/visits" className={inputCls} />

        <label className={labelCls}>Authentication</label>
        <select value={form.authType} onChange={(e) => set({ authType: e.target.value })} className={`${inputCls} cursor-pointer`}>
          <option value="NONE">None</option>
          <option value="API_KEY">API Key (X-API-Key header)</option>
          <option value="BEARER">Bearer Token</option>
          <option value="BASIC">Basic Auth</option>
          <option value="OAUTH2">OAuth2 (client credentials)</option>
        </select>

        {form.authType !== "NONE" && (
          <>
            <label className={labelCls}>
              Credentials{" "}
              {existing?.hasCredentials && <span className="font-normal text-[var(--color-ink-400)]">(stored — leave blank to keep)</span>}
            </label>
            <input
              type="password"
              value={form.credentials}
              onChange={(e) => set({ credentials: e.target.value })}
              placeholder={credentialPlaceholder}
              className={inputCls}
              autoComplete="off"
            />
            <p className="text-[10px] text-[var(--color-ink-400)] mt-1">Encrypted at rest (AES-256-GCM). Never shown again after saving.</p>
          </>
        )}

        {form.authType === "OAUTH2" && (
          <>
            <label className={labelCls}>OAuth2 Token URL</label>
            <input value={form.oauthTokenUrl} onChange={(e) => set({ oauthTokenUrl: e.target.value })} placeholder="https://auth.hospital.example/oauth/token" className={inputCls} />
          </>
        )}

        <label className={labelCls}>Field Mapping <span className="font-normal text-[var(--color-ink-400)]">(JSON, optional — REST/CSV)</span></label>
        <textarea
          value={form.fieldMappingJson}
          onChange={(e) => set({ fieldMappingJson: e.target.value })}
          placeholder='{"patient_name": "PatientFullName", "visit_date": "EncounterDate"}'
          rows={2}
          className={`${inputCls} font-mono text-xs resize-y`}
        />

        <label className={labelCls}>Transformation Rules <span className="font-normal text-[var(--color-ink-400)]">(JSON, optional)</span></label>
        <textarea
          value={form.transformationRules}
          onChange={(e) => set({ transformationRules: e.target.value })}
          placeholder='{"patient_sex": {"MALE": "M", "FEMALE": "F"}}'
          rows={2}
          className={`${inputCls} font-mono text-xs resize-y`}
        />

        <div className="flex items-center gap-4 mt-3">
          <div className="flex-1">
            <label className={labelCls} style={{ marginTop: 0 }}>Max Retries</label>
            <input
              type="number" min={1} max={10}
              value={form.maxRetries}
              onChange={(e) => set({ maxRetries: parseInt(e.target.value, 10) || 3 })}
              className={inputCls}
            />
          </div>
          <label className="flex items-center gap-2 mt-5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.syncEnabled}
              onChange={(e) => set({ syncEnabled: e.target.checked })}
              className="w-4 h-4 accent-[var(--color-primary-600)]"
            />
            <span className="text-sm font-medium text-[var(--color-ink-700)]">Auto-sync on finalize</span>
          </label>
        </div>

        {error && (
          <p className="text-xs text-red-600 mt-3 flex items-center gap-1.5"><AlertCircle size={12} className="shrink-0" /> {error}</p>
        )}
        {testResult && (
          <p className={`text-xs mt-3 flex items-start gap-1.5 ${testResult.ok ? "text-emerald-700" : "text-red-600"}`}>
            {testResult.ok ? <CheckCircle2 size={12} className="shrink-0 mt-0.5" /> : <XCircle size={12} className="shrink-0 mt-0.5" />}
            {testResult.detail}
          </p>
        )}

        <div className="flex gap-2 mt-5">
          <button
            onClick={handleTest}
            disabled={saving || testing}
            className="flex-1 py-2 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Network size={14} />}
            Test Connection
          </button>
          <button
            onClick={handleSave}
            disabled={saving || testing}
            className="flex-1 py-2 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-semibold hover:bg-[var(--color-primary-700)] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Payload viewer ─────────────────────────────────────────────────────────── */
function PayloadModal({ log, onClose }: { log: LogRow; onClose: () => void }) {
  const download = () => {
    const blob = new Blob([log.requestPayload ?? ""], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `integration-${log.id}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-5 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[var(--color-ink-800)]">Sync Payload — {log.hospitalName}</h2>
          <div className="flex items-center gap-2">
            {log.requestPayload && (
              <button onClick={download} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors flex items-center gap-1.5">
                <Download size={12} /> Download
              </button>
            )}
            <button onClick={onClose} className="text-[var(--color-ink-400)] hover:text-[var(--color-ink-800)]"><X size={18} /></button>
          </div>
        </div>
        <div className="overflow-y-auto space-y-3 text-xs">
          <div>
            <p className="font-semibold text-[var(--color-ink-500)] mb-1">Request payload</p>
            <pre className="bg-[var(--color-surface-sunken)] rounded-lg p-3 whitespace-pre-wrap break-all font-mono text-[11px] text-[var(--color-ink-700)]">
              {log.requestPayload ?? "— not recorded —"}
            </pre>
          </div>
          <div>
            <p className="font-semibold text-[var(--color-ink-500)] mb-1">Response / acknowledgment</p>
            <pre className="bg-[var(--color-surface-sunken)] rounded-lg p-3 whitespace-pre-wrap break-all font-mono text-[11px] text-[var(--color-ink-700)]">
              {log.responsePayload ?? log.errorMessage ?? "— not recorded —"}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────────── */
export function IntegrationsClient({
  hospitals,
  logs,
  counts,
}: {
  hospitals: HospitalRow[];
  logs: LogRow[];
  counts: { SUCCESS: number; FAILED: number; PENDING: number };
}) {
  const router = useRouter();
  const [configFor, setConfigFor] = useState<HospitalRow | null>(null);
  const [payloadLog, setPayloadLog] = useState<LogRow | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [toggleErr, setToggleErr] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const connected = hospitals.filter((h) => h.integration).length;

  const handleToggle = (h: HospitalRow) => {
    if (!h.integration) { setConfigFor(h); return; }
    setToggleErr(null);
    startTransition(async () => {
      const res = await toggleSyncEnabled(h.id, !h.integration!.syncEnabled);
      if (res.error) setToggleErr(res.error);
      router.refresh();
    });
  };

  const handleRetry = (logId: string) => {
    setRetryingId(logId);
    startTransition(async () => {
      await retryIntegrationLog(logId);
      setRetryingId(null);
      router.refresh();
    });
  };

  return (
    <div className="fade-in pb-12">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] mb-4 transition-colors"
      >
        <ArrowLeft size={14} /> Settings
      </Link>

      <div className="flex items-center gap-3 mb-1">
        <div className="rounded-xl bg-[var(--color-primary-50)] p-2">
          <Plug size={18} className="text-[var(--color-primary-600)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--color-ink-900)]">Hospital Integrations</h1>
          <p className="text-sm text-[var(--color-ink-400)]">
            Finalized visits are converted to a standard clinical record and pushed to each hospital&apos;s system via its adapter.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
        {[
          { label: "Connected Hospitals", value: connected, cls: "text-[var(--color-primary-700)]" },
          { label: "Successful Syncs", value: counts.SUCCESS, cls: "text-emerald-600" },
          { label: "Failed", value: counts.FAILED, cls: "text-red-600" },
          { label: "Pending", value: counts.PENDING, cls: "text-amber-600" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-[var(--color-border)] bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {toggleErr && (
        <p className="text-xs text-red-600 mt-3 flex items-center gap-1.5"><AlertCircle size={12} /> {toggleErr}</p>
      )}

      {/* Hospital cards */}
      <h2 className="text-sm font-bold text-[var(--color-ink-800)] mt-7 mb-3">Hospitals</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {hospitals.map((h) => (
          <div key={h.id} className="rounded-xl border border-[var(--color-border)] bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-ink-800)] truncate">{h.name}</p>
                <p className="text-[10px] font-mono text-[var(--color-ink-400)]">{h.shortCode}</p>
              </div>
              {h.integration ? (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${TYPE_BADGE[h.integration.integrationType] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                  {h.integration.integrationType}
                </span>
              ) : (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-500">Not configured</span>
              )}
            </div>

            {h.integration?.apiEndpoint && (
              <p className="text-[11px] font-mono text-[var(--color-ink-400)] mt-2 truncate" title={h.integration.apiEndpoint}>
                {h.integration.apiEndpoint}
              </p>
            )}

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => handleToggle(h)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  h.integration?.syncEnabled
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                    : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)] border border-[var(--color-border)] hover:bg-slate-100"
                }`}
              >
                {h.integration?.syncEnabled ? <Zap size={12} /> : <ZapOff size={12} />}
                {h.integration?.syncEnabled ? "Sync On" : "Sync Off"}
              </button>
              <button
                onClick={() => setConfigFor(h)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] transition-colors"
              >
                <Settings2 size={12} /> Configure
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Sync log */}
      <h2 className="text-sm font-bold text-[var(--color-ink-800)] mt-8 mb-3">Sync History</h2>
      <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
        {logs.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-ink-400)]">
            <Plug size={28} className="mx-auto mb-2 text-[var(--color-ink-300)]" />
            <p className="text-sm">No sync activity yet.</p>
            <p className="text-xs mt-1">Records appear here when visits are finalized at a hospital with sync enabled.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {logs.map((log) => (
              <li key={log.id} className="px-4 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[var(--color-ink-800)]">{log.hospitalName}</span>
                    <LogStatusBadge status={log.status} />
                    {log.triggeredBy && (
                      <span className="text-[10px] text-[var(--color-ink-400)] font-medium">{log.triggeredBy}</span>
                    )}
                    {log.retryCount > 0 && (
                      <span className="text-[10px] text-[var(--color-ink-400)]">retries: {log.retryCount}</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-ink-400)] mt-0.5">
                    {log.patientName ? `${log.patientName}${log.patientUdid ? ` (${log.patientUdid})` : ""} · ` : ""}
                    {format(new Date(log.createdAt), "dd MMM yyyy, h:mm a")}
                  </p>
                  {log.errorMessage && (
                    <p className="text-xs text-red-600 mt-1 break-words">{log.errorMessage}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {(log.requestPayload || log.responsePayload) && (
                    <button
                      onClick={() => setPayloadLog(log)}
                      title="View payload"
                      className="p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] transition-colors"
                    >
                      <Eye size={13} />
                    </button>
                  )}
                  {log.status === "FAILED" && log.visitId && (
                    <button
                      onClick={() => handleRetry(log.id)}
                      disabled={retryingId === log.id}
                      title="Retry sync"
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] disabled:opacity-40 transition-colors"
                    >
                      <RefreshCw size={12} className={retryingId === log.id ? "animate-spin" : ""} />
                      Retry
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {configFor && <ConfigModal hospital={configFor} onClose={() => setConfigFor(null)} />}
      {payloadLog && <PayloadModal log={payloadLog} onClose={() => setPayloadLog(null)} />}
    </div>
  );
}
