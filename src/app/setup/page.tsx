"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Building2, Eye, CheckCircle2, AlertCircle,
  User, Lock, Phone, Hash, MapPin, Briefcase, ArrowRight, ShieldCheck,
  Stethoscope, LayoutDashboard, ArrowLeft, KeyRound, UserCheck,
  Pencil, Trash2, X, Check,
} from "lucide-react";
import { createDoctor, createHospital } from "./actions";
import Link from "next/link";

type View = "dashboard" | "doctor" | "hospital" | "doctor-logins" | "hospital-logins";

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

// ── Dashboard View ─────────────────────────────────────────────────────────
function DashboardView({ onGo }: { onGo: (v: View) => void }) {
  return (
    <div className="flex flex-col gap-8 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome to Setup</h1>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          Use this wizard to configure doctors and hospitals before the system goes live.
          Follow the steps below to get started.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Step 1 */}
        <button
          onClick={() => onGo("hospital")}
          className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-slate-200 bg-white/70 hover:border-teal-400 hover:bg-teal-50/40 transition-all group text-left"
        >
          <div className="w-11 h-11 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0">
            <Building2 size={20} className="text-blue-700" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800">1. Create a Hospital</p>
            <p className="text-xs text-slate-500 mt-0.5">Register your clinic or hospital first.</p>
          </div>
          <ArrowRight size={15} className="text-slate-300 group-hover:text-teal-600 transition-colors" />
        </button>

        {/* Step 2 */}
        <button
          onClick={() => onGo("doctor")}
          className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-slate-200 bg-white/70 hover:border-teal-400 hover:bg-teal-50/40 transition-all group text-left"
        >
          <div className="w-11 h-11 rounded-2xl bg-teal-100 flex items-center justify-center shrink-0">
            <Stethoscope size={20} className="text-teal-700" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800">2. Create a Doctor</p>
            <p className="text-xs text-slate-500 mt-0.5">Add a doctor account and link them to a hospital.</p>
          </div>
          <ArrowRight size={15} className="text-slate-300 group-hover:text-teal-600 transition-colors" />
        </button>
      </div>

      <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-amber-50 border border-amber-200">
        <ShieldCheck size={15} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          Create hospitals before doctors so you can link them during doctor setup.
        </p>
      </div>
    </div>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <IconField label="Specialty" name="specialty" placeholder="Ophthalmology" icon={Briefcase} />
          <IconField label="Short Code" name="shortCode" placeholder="e.g. ARK"
            hint="2–8 chars. Patient UHID prefix." icon={Hash} />
        </div>
        <IconField label="Contact" name="contact" placeholder="Phone number" icon={Phone} />

        <SubmitBtn pending={pending} label="Create Doctor Account" loadingLabel="Creating…" />
      </form>
    </div>
  );
}

// ── Hospital Form ──────────────────────────────────────────────────────────
function HospitalView({ onCreated }: { onCreated: () => void }) {
  const [state, action, pending] = useActionState(createHospital, INIT);
  useEffect(() => { if (state.success) onCreated(); }, [state.success]);

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
        <IconField label="Hospital Name" name="name" required placeholder="e.g. City Eye Hospital" icon={Building2} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <IconField label="Short Code" name="shortCode" required placeholder="e.g. CEH"
            hint="2–8 chars. Used in UHID prefix." icon={Hash} />
          <IconField label="Contact" name="contact" placeholder="Phone number" icon={Phone} />
        </div>
        <IconField label="Address" name="address" placeholder="Full hospital address" icon={MapPin} />
        <SubmitBtn pending={pending} label="Create Hospital" loadingLabel="Creating…" />
      </form>
    </div>
  );
}

// ── Doctor Logins View ────────────────────────────────────────────────────
type DoctorInfo = {
  id: string; name: string; username: string;
  specialty: string | null; contact: string | null; shortCode: string | null;
  license: { hasKey: boolean; active: boolean; daysRemaining: number };
};

function DoctorLoginsView() {
  const [doctors, setDoctors] = useState<DoctorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", specialty: "", contact: "", shortCode: "", password: "" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch("/api/setup/doctors")
      .then((r) => r.json())
      .then((d) => { setDoctors(d); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const startEdit = (d: DoctorInfo) => {
    setDeletingId(null);
    setEditingId(d.id);
    setEditForm({ name: d.name, specialty: d.specialty || "", contact: d.contact || "", shortCode: d.shortCode || "", password: "" });
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    await fetch(`/api/setup/doctors/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setSaving(false);
    setEditingId(null);
    load();
  };

  const confirmDelete = async (id: string) => {
    await fetch(`/api/setup/doctors/${id}`, { method: "DELETE" });
    setDeletingId(null);
    setDoctors((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Doctor's Login</h1>
        <p className="text-sm text-slate-500 mt-1.5">All registered doctor accounts and their login credentials.</p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : doctors.length === 0 ? (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-amber-50 border border-amber-200">
          <Stethoscope size={16} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">No doctors created yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {doctors.map((d, i) => (
            <div key={d.id} className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
              {/* Row */}
              <div className="flex flex-wrap items-center gap-3 md:gap-4 px-4 md:px-5 py-4">
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center shrink-0 text-sm font-bold text-teal-700">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{d.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Username: <span className="font-mono text-slate-600">{d.username}</span></p>
                </div>
                {/* License status badge */}
                <div className="shrink-0">
                  {d.license.active ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      Active · {d.license.daysRemaining}d
                    </span>
                  ) : d.license.hasKey ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                      Expired
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                      No License
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => editingId === d.id ? setEditingId(null) : startEdit(d)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                               border-slate-200 text-slate-600 hover:border-teal-400 hover:text-teal-700 hover:bg-teal-50"
                  >
                    {editingId === d.id ? <X size={12} /> : <Pencil size={12} />}
                    {editingId === d.id ? "Cancel" : "Edit"}
                  </button>
                  <button
                    onClick={() => { setEditingId(null); setDeletingId(deletingId === d.id ? null : d.id); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                               border-slate-200 text-slate-600 hover:border-red-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              </div>

              {/* Edit form */}
              {editingId === d.id && (
                <div className="px-5 pb-5 pt-1 border-t border-slate-100 flex flex-col gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Name</label>
                      <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-500" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Specialty</label>
                      <input value={editForm.specialty} onChange={(e) => setEditForm((f) => ({ ...f, specialty: e.target.value }))}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-500" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Contact</label>
                      <input value={editForm.contact} onChange={(e) => setEditForm((f) => ({ ...f, contact: e.target.value }))}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-500" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">New Password <span className="normal-case">(optional)</span></label>
                      <input type="password" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                        placeholder="Leave blank to keep" className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-500 placeholder:text-slate-300" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button onClick={() => setEditingId(null)}
                      className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
                      Cancel
                    </button>
                    <button onClick={() => saveEdit(d.id)} disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white rounded-xl disabled:opacity-60 transition-all"
                      style={{ background: "linear-gradient(135deg,#0f766e,#14b8a6)" }}>
                      <Check size={12} />
                      {saving ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                </div>
              )}

              {/* Delete confirmation */}
              {deletingId === d.id && (
                <div className="flex items-center gap-3 px-5 py-3 border-t border-red-100 bg-red-50">
                  <Trash2 size={13} className="text-red-500 shrink-0" />
                  <p className="text-xs text-red-700 flex-1">Delete <strong>{d.name}</strong>? This cannot be undone.</p>
                  <button onClick={() => setDeletingId(null)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-white transition-all">
                    Cancel
                  </button>
                  <button onClick={() => confirmDelete(d.id)}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-all">
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Hospital Logins View ──────────────────────────────────────────────────
type HospitalInfo = {
  id: string; name: string; shortCode: string; contact: string | null; address?: string | null;
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
                    Code: <span className="font-mono text-slate-600">{h.shortCode}</span>
                    {h.contact && <span className="ml-3">{h.contact}</span>}
                  </p>
                </div>
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
];

function Sidebar({ active, onNav }: { active: View; onNav: (v: View) => void }) {
  return (
    <aside
      className="flex flex-col w-full lg:w-56 shrink-0 lg:min-h-full"
      style={{
        background: "linear-gradient(180deg, #0f172a 0%, #0f1a2e 100%)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 lg:py-6 border-b border-white/10">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #0f766e, #14b8a6)" }}
        >
          <Eye size={18} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-white text-sm leading-none">PPMS</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Setup</p>
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left whitespace-nowrap shrink-0 lg:w-full ${
                isActive
                  ? "text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
              style={isActive ? {
                background: "rgba(20,184,166,0.15)",
                boxShadow: "inset 2px 0 0 #14b8a6",
              } : {}}
            >
              <Icon size={16} className={isActive ? "text-teal-400" : ""} />
              {label}
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-400" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Back to Login */}
      <div className="px-3 pb-4 lg:pb-6">
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
      style={{ background: "linear-gradient(135deg, #f0fdfa 0%, #e6fffa 30%, #f8fafc 70%, #ffffff 100%)" }}
    >
      {/* Sidebar */}
      <Sidebar active={view} onNav={setView} />

      {/* Content */}
      <main className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center px-4 md:px-8 py-4 border-b border-slate-200/60 bg-white/40 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-semibold text-slate-600">
              {view === "dashboard" ? "Dashboard"
                : view === "doctor" ? "Doctor"
                : view === "hospital" ? "Hospital"
                : view === "doctor-logins" ? "Doctor's Login"
                : "Hospital's Login"}
            </span>
          </div>
        </div>

        {/* Page body */}
        <div className="flex-1 px-4 py-6 md:px-8 md:py-8 overflow-y-auto">
          {view === "dashboard" && (
            <DashboardView onGo={setView} />
          )}
          {view === "doctor" && (
            <DoctorView onCreated={() => {}} />
          )}
          {view === "hospital" && (
            <HospitalView onCreated={() => {}} />
          )}
          {view === "doctor-logins" && (
            <DoctorLoginsView />
          )}
          {view === "hospital-logins" && (
            <HospitalLoginsView />
          )}
        </div>
      </main>
    </div>
  );
}
