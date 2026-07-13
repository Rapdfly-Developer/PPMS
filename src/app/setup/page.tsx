"use client";

import { useActionState, useEffect, useState, useMemo } from "react";
import {
  Building2, Eye, CheckCircle2, AlertCircle,
  User, Lock, Phone, Hash, MapPin, Briefcase, ArrowRight,
  Stethoscope, LayoutDashboard, ArrowLeft, KeyRound, UserCheck,
  Pencil, Trash2, X, Check, Key, ShieldCheck,
} from "lucide-react";
import { createDoctor, createHospital } from "./actions";
import Link from "next/link";
import { LicenseManagementView } from "./LicenseManagementView";
import { SetupDashboard } from "./SetupDashboard";
import { DoctorManagementView } from "./DoctorManagementView";

type View = "dashboard" | "doctor" | "hospital" | "doctor-logins" | "hospital-logins" | "license";

const INIT = { success: undefined, error: undefined };

// ── Alert ─────────────────────────────────────────────────────────────────
function Alert({ result }: { result: { success?: string; error?: string } }) {
  if (!result.success && !result.error) return null;
  return (
    <div className={`flex items-start gap-2.5 px-4 py-3 rounded-2xl text-sm ${
      result.success
        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
        : "bg-red-50 text-red-800 border border-red-200"
    }`}>
      {result.success
        ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
        : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
      <span>{result.success ?? result.error}</span>
    </div>
  );
}

// ── Icon Input Field ───────────────────────────────────────────────────────
function IconField({ label, name, type = "text", placeholder, required, hint, icon: Icon }: {
  label: string; name: string; type?: string;
  placeholder?: string; required?: boolean; hint?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-teal-600">
          <Icon size={15} />
        </div>
        <input
          name={name} type={type} placeholder={placeholder} required={required}
          className="w-full pl-9 pr-3.5 py-3 text-sm border border-slate-200 rounded-[14px] bg-white/80
                     focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-500
                     transition-all duration-200 placeholder:text-slate-300"
        />
      </div>
      {hint && <p className="text-[11px] text-slate-400 pl-1">{hint}</p>}
    </div>
  );
}

// ── Submit Button ──────────────────────────────────────────────────────────
function SubmitBtn({ pending, label, loadingLabel }: { pending: boolean; label: string; loadingLabel: string }) {
  return (
    <button
      type="submit" disabled={pending}
      className="w-full flex items-center justify-center gap-2 rounded-2xl text-white text-sm font-semibold
                 disabled:opacity-60 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
      style={{
        height: "52px",
        background: pending
          ? "#0f766e"
          : "linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #14b8a6 100%)",
        boxShadow: pending ? "none" : "0 8px 24px -4px rgba(15,118,110,0.4)",
      }}
    >
      {pending ? (
        <>
          <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          {loadingLabel}
        </>
      ) : (
        <>
          <ArrowRight size={16} />
          {label}
        </>
      )}
    </button>
  );
}

// ── Doctor Form ────────────────────────────────────────────────────────────
function DoctorView({ onCreated }: { onCreated: () => void }) {
  const [state, action, pending] = useActionState(createDoctor, INIT);

  useEffect(() => { if (state.success) onCreated(); }, [state.success]);

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Create a Doctor</h1>
        <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
          Set up a doctor account with login credentials and specialty details.
        </p>
      </div>

      <form action={action} className="flex flex-col gap-4">
        <Alert result={state} />

        <IconField label="Full Name" name="name" required placeholder="e.g. Dr. Arun Kumar" icon={User} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <IconField label="Username" name="username" required placeholder="e.g. dr.arun"
            hint="Lowercase, numbers, dots, dashes." icon={Hash} />
          <IconField label="Password" name="password" type="password" required placeholder="Min. 8 characters" icon={Lock} />
        </div>
        <IconField label="Specialty" name="specialty" placeholder="Ophthalmology" icon={Briefcase} />
        <IconField label="Contact" name="contact" placeholder="Phone number" icon={Phone} />

        <SubmitBtn pending={pending} label="Create Doctor Account" loadingLabel="Creating…" />
      </form>
    </div>
  );
}

// ── Hospital short code preview (mirrors server logic) ────────────────────
function hospitalShortCodePreview(name: string): string {
  const words = name.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 4);
  const initials = words.map((w) => w[0]).join("");
  return initials.length >= 2 ? initials.slice(0, 4) : words[0].slice(0, 4);
}

// ── Hospital Form ──────────────────────────────────────────────────────────
function HospitalView({ onCreated }: { onCreated: () => void }) {
  const [state, action, pending] = useActionState(createHospital, INIT);
  const [hospitalName, setHospitalName] = useState("");
  const shortCodePreview = useMemo(() => hospitalShortCodePreview(hospitalName), [hospitalName]);

  useEffect(() => { if (state.success) { onCreated(); setHospitalName(""); } }, [state.success]);

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Create a Hospital</h1>
        <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
          Register a hospital or clinic. Doctors can then be linked to it.
        </p>
      </div>

      <form action={action} className="flex flex-col gap-4">
        <Alert result={state} />

        {/* Hospital Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
            Hospital Name <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-teal-600">
              <Building2 size={15} />
            </div>
            <input
              name="name" required placeholder="e.g. City Eye Hospital"
              value={hospitalName} onChange={(e) => setHospitalName(e.target.value)}
              className="w-full pl-9 pr-3.5 py-3 text-sm border border-slate-200 rounded-[14px] bg-white/80
                         focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-500
                         transition-all duration-200 placeholder:text-slate-300"
            />
          </div>
        </div>

        {/* Short Code (auto-generated, read-only) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
            Short Code
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-teal-600">
              <Hash size={15} />
            </div>
            <div className="w-full pl-9 pr-3.5 py-3 text-sm border border-slate-200 rounded-[14px] bg-slate-50
                            text-slate-500 font-mono select-none">
              {shortCodePreview || <span className="text-slate-300">Auto-generated from name</span>}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 pl-1">Auto-generated from hospital name. Used as UHID prefix.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <IconField label="Contact" name="contact" placeholder="Phone number" icon={Phone} />
          <IconField label="Address" name="address" placeholder="Full hospital address" icon={MapPin} />
        </div>

        <SubmitBtn pending={pending} label="Create Hospital" loadingLabel="Creating…" />
      </form>
    </div>
  );
}

// Shared Active/Inactive pill — click to flip whether the account can log in.
function ActiveToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={active ? "Click to deactivate — blocks login" : "Click to activate — allows login"}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
        active
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
          : "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${active ? "bg-emerald-500" : "bg-red-500"}`} />
      {active ? "Active" : "Inactive"}
    </button>
  );
}

// ── Hospital Logins View ──────────────────────────────────────────────────
type HospitalInfo = {
  id: string; name: string; shortCode: string; contact: string | null; address?: string | null;
  username: string | null;
  active: boolean | null; // null = hospital has no login account
  doctors: { name: string; username: string; specialty: string | null }[];
};

function HospitalLoginsView() {
  const [hospitals, setHospitals] = useState<HospitalInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", shortCode: "", contact: "", address: "" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch("/api/setup/hospitals-with-doctors")
      .then((r) => r.json())
      .then((d) => { setHospitals(d); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const startEdit = (h: HospitalInfo) => {
    setDeletingId(null);
    setEditingId(h.id);
    setEditForm({ name: h.name, shortCode: h.shortCode, contact: h.contact || "", address: h.address || "" });
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    await fetch(`/api/setup/hospitals/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setSaving(false);
    setEditingId(null);
    load();
  };

  const confirmDelete = async (id: string) => {
    await fetch(`/api/setup/hospitals/${id}`, { method: "DELETE" });
    setDeletingId(null);
    setHospitals((prev) => prev.filter((h) => h.id !== id));
  };

  const toggleActive = async (h: HospitalInfo) => {
    setHospitals((prev) => prev.map((x) => x.id === h.id ? { ...x, active: !h.active } : x));
    await fetch(`/api/setup/hospitals/${h.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !h.active }),
    }).catch(() => load());
  };

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Hospital's Login</h1>
        <p className="text-sm text-slate-500 mt-1.5">All registered hospitals and the doctors linked to each.</p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : hospitals.length === 0 ? (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-amber-50 border border-amber-200">
          <Building2 size={16} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">No hospitals created yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {hospitals.map((h, i) => (
            <div key={h.id} className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
              {/* Hospital header */}
              <div className="flex flex-wrap items-center gap-3 md:gap-4 px-4 md:px-5 py-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-sm font-bold text-blue-700">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{h.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Username: <span className="font-mono text-slate-600">{h.username ?? "—"}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Code: <span className="font-mono text-slate-600">{h.shortCode}</span>
                    {h.contact && <span className="ml-3">{h.contact}</span>}
                  </p>
                </div>
                {/* Active / Inactive login toggle — only when a login account exists */}
                {h.active !== null && (
                  <ActiveToggle active={h.active} onToggle={() => toggleActive(h)} />
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => editingId === h.id ? setEditingId(null) : startEdit(h)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                               border-slate-200 text-slate-600 hover:border-teal-400 hover:text-teal-700 hover:bg-teal-50"
                  >
                    {editingId === h.id ? <X size={12} /> : <Pencil size={12} />}
                    {editingId === h.id ? "Cancel" : "Edit"}
                  </button>
                  <button
                    onClick={() => { setEditingId(null); setDeletingId(deletingId === h.id ? null : h.id); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                               border-slate-200 text-slate-600 hover:border-red-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              </div>

              {/* Edit form */}
              {editingId === h.id && (
                <div className="px-5 pb-5 pt-3 border-b border-slate-100 flex flex-col gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2 flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Hospital Name</label>
                      <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-500" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Short Code</label>
                      <input value={editForm.shortCode} onChange={(e) => setEditForm((f) => ({ ...f, shortCode: e.target.value }))}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-500" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Contact</label>
                      <input value={editForm.contact} onChange={(e) => setEditForm((f) => ({ ...f, contact: e.target.value }))}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-500" />
                    </div>
                    <div className="sm:col-span-2 flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Address</label>
                      <input value={editForm.address} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-500" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button onClick={() => setEditingId(null)}
                      className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
                      Cancel
                    </button>
                    <button onClick={() => saveEdit(h.id)} disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white rounded-xl disabled:opacity-60 transition-all"
                      style={{ background: "linear-gradient(135deg,#0f766e,#14b8a6)" }}>
                      <Check size={12} />
                      {saving ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                </div>
              )}

              {/* Delete confirmation */}
              {deletingId === h.id && (
                <div className="flex items-center gap-3 px-5 py-3 border-b border-red-100 bg-red-50">
                  <Trash2 size={13} className="text-red-500 shrink-0" />
                  <p className="text-xs text-red-700 flex-1">Delete <strong>{h.name}</strong>? All doctor links will be removed.</p>
                  <button onClick={() => setDeletingId(null)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-white transition-all">
                    Cancel
                  </button>
                  <button onClick={() => confirmDelete(h.id)}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-all">
                    Delete
                  </button>
                </div>
              )}

              {/* Linked doctors */}
              {h.doctors.length === 0 ? (
                <div className="px-5 py-3">
                  <p className="text-xs text-slate-400 italic">No doctors linked yet.</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-slate-100">
                  {h.doctors.map((d, j) => (
                    <div key={j} className="flex items-center gap-3 px-5 py-3">
                      <UserCheck size={14} className="text-teal-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-slate-700 font-medium">{d.name}</span>
                        <span className="text-xs text-slate-400 ml-2">@{d.username}</span>
                      </div>
                      {d.specialty && <span className="text-[11px] text-slate-400">{d.specialty}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────
const NAV = [
  { key: "dashboard"      as View, label: "Dashboard",       icon: LayoutDashboard },
  { key: "doctor"         as View, label: "Doctor",          icon: Stethoscope     },
  { key: "hospital"       as View, label: "Hospital",        icon: Building2       },
  { key: "doctor-logins"  as View, label: "Doctor's Login",  icon: KeyRound        },
  { key: "hospital-logins"as View, label: "Hospital's Login",icon: Building2       },
  { key: "license"        as View, label: "License",         icon: Key             },
];

function Sidebar({ active, onNav }: { active: View; onNav: (v: View) => void }) {
  return (
    <aside
      className="flex flex-col w-full lg:w-60 shrink-0 lg:min-h-full backdrop-blur-md"
      style={{
        background: "linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(15,26,46,0.98) 100%)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 lg:py-6 border-b border-white/10">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: "linear-gradient(135deg, #2563EB, #06B6D4)",
            boxShadow: "0 4px 14px rgba(37,99,235,0.4)",
          }}
        >
          <Eye size={18} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-white text-sm leading-none">PPMS</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Setup Console</p>
        </div>
      </div>

      {/* Nav — horizontal scroll strip on mobile, vertical column on desktop */}
      <nav className="flex lg:flex-col gap-1 px-3 py-3 lg:pt-4 flex-1 overflow-x-auto lg:overflow-x-visible">
        {NAV.map(({ key, label, icon: Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => onNav(key)}
              className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-left whitespace-nowrap shrink-0 lg:w-full ${
                isActive
                  ? "text-white"
                  : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.06]"
              }`}
              style={isActive ? {
                background: "linear-gradient(90deg, rgba(37,99,235,0.25), rgba(6,182,212,0.12))",
                boxShadow: "inset 2px 0 0 #06B6D4, 0 0 20px rgba(6,182,212,0.15)",
              } : {}}
            >
              <Icon
                size={16}
                className={`transition-transform duration-200 group-hover:scale-110 ${isActive ? "text-cyan-400" : ""}`}
              />
              <span className="transition-transform duration-200 group-hover:translate-x-0.5">{label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400" style={{ boxShadow: "0 0 8px #06B6D4" }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Profile + Back to Login */}
      <div className="px-3 pb-4 lg:pb-5 flex flex-col gap-2">
        <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}
          >
            <ShieldCheck size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white leading-tight">Super Admin</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Administrator</p>
          </div>
        </div>
        <Link
          href="/login"
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
        >
          <ArrowLeft size={13} />
          Back to Login
        </Link>
      </div>
    </aside>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function SetupPage() {
  const [view, setView] = useState<View>("dashboard");

  return (
    <div
      className="min-h-screen flex flex-col lg:flex-row"
      style={{
        background:
          "radial-gradient(ellipse 60% 40% at 80% 0%, rgba(6,182,212,0.08), transparent), " +
          "radial-gradient(ellipse 50% 40% at 10% 90%, rgba(37,99,235,0.06), transparent), " +
          "#F8FAFC",
      }}
    >
      {/* Sidebar */}
      <Sidebar active={view} onNav={setView} />

      {/* Content */}
      <main className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center px-4 md:px-8 py-4 border-b border-slate-200/60 bg-white/40 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-semibold text-slate-600">
              {view === "dashboard"       ? "Dashboard"
                : view === "doctor"         ? "Doctor"
                : view === "hospital"       ? "Hospital"
                : view === "doctor-logins"  ? "Doctor's Login"
                : view === "hospital-logins"? "Hospital's Login"
                : "License Management"}
            </span>
          </div>
        </div>

        {/* Page body */}
        <div className={`flex-1 py-6 md:py-8 overflow-y-auto ${view === "license" ? "px-4 md:px-6" : "px-4 md:px-8"}`}>
          {view === "dashboard" && (
            <SetupDashboard onGo={setView} />
          )}
          {view === "doctor" && (
            <DoctorView onCreated={() => {}} />
          )}
          {view === "hospital" && (
            <HospitalView onCreated={() => {}} />
          )}
          {view === "doctor-logins" && (
            <DoctorManagementView onAddDoctor={() => setView("doctor")} />
          )}
          {view === "hospital-logins" && (
            <HospitalLoginsView />
          )}
          {view === "license" && (
            <LicenseManagementView />
          )}
        </div>
      </main>
    </div>
  );
}
