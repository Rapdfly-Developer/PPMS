"use client";

import React, { useState, useTransition } from "react";
import {
  Building2, Layers, Users, Calendar, Bell,
  Database, ClipboardList, CreditCard,
  Save, CheckCircle2, ChevronRight, Upload, Plus, X,
  Crown, Check, Minus, Eye,
  Phone, MapPin, Mail, Globe, Clock,
  Download, RefreshCw,
} from "lucide-react";
import { updateHospitalSettings, saveHospitalLogo } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────
type Section =
  | "hospital" | "departments" | "users"
  | "appointments" | "notifications" | "backup" | "audit";

type Hospital = {
  id: string; name: string; shortCode: string;
  address: string | null; contact: string | null; retentionYears: number;
  logoUrl?: string | null;
};

// ── Sidebar nav ───────────────────────────────────────────────────────────────
const NAV: { key: Section; label: string; icon: React.ReactNode; badge?: string }[] = [
  { key: "hospital",      label: "Hospital Info",   icon: <Building2 size={15} />    },
  { key: "departments",   label: "Departments",     icon: <Layers size={15} />       },
  { key: "users",         label: "Users & Roles",   icon: <Users size={15} />        },
  { key: "appointments",  label: "Appointments",    icon: <Calendar size={15} />     },
  { key: "notifications", label: "Notifications",   icon: <Bell size={15} />         },
  { key: "backup",        label: "Data & Backup",   icon: <Database size={15} />     },
  { key: "audit",         label: "Audit Logs",      icon: <ClipboardList size={15} />},
];
// divider after index 3, 6, 9
const DIVIDERS = new Set([4, 7, 10]);

// ── Shared UI pieces ──────────────────────────────────────────────────────────
function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold text-[var(--color-ink-900)]">{title}</h2>
      <p className="text-sm text-[var(--color-ink-500)] mt-0.5">{desc}</p>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-[var(--color-border)] shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function FieldRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-4 border-b border-[var(--color-border)] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-ink-800)]">{label}</p>
        {desc && <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{desc}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:ring-offset-2 ${
        checked ? "bg-[var(--color-primary-600)]" : "bg-slate-200"
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
        checked ? "translate-x-6" : "translate-x-1"
      }`} />
    </button>
  );
}

function SoonBadge() {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
      Soon
    </span>
  );
}

function SaveRow({ onSave, pending }: { onSave: () => void; pending: boolean }) {
  return (
    <div className="flex justify-end mt-2">
      <button
        onClick={onSave}
        disabled={pending}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-medium hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors"
      >
        <Save size={14} />{pending ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}

const SEL = "rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-ink-700)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] bg-white";
const INP = "w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] bg-white";
const LBL = "block text-xs font-medium text-[var(--color-ink-500)] mb-1.5";
const SEC = "text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] mb-4";

// ── Section: General ──────────────────────────────────────────────────────────
function GeneralSection() {
  const [tz, setTz]     = useState("Asia/Kolkata");
  const [lang, setLang] = useState("en");
  const [fmt, setFmt]   = useState("dd MMM yyyy");
  const [theme, setTheme] = useState("light");

  return (
    <>
      <SectionHeader title="General Settings" desc="System-wide preferences and display configuration." />
      <Card>
        <div className="p-5">
          <FieldRow label="Language" desc="Interface display language">
            <select value={lang} onChange={e => setLang(e.target.value)} className={SEL}>
              <option value="en">English</option>
              <option value="ta">Tamil</option>
              <option value="hi">Hindi</option>
            </select>
          </FieldRow>
          <FieldRow label="Timezone" desc="All appointment times use this timezone">
            <select value={tz} onChange={e => setTz(e.target.value)} className={SEL}>
              <option value="Asia/Kolkata">IST — UTC+5:30</option>
              <option value="UTC">UTC</option>
              <option value="Asia/Dubai">GST — UTC+4</option>
            </select>
          </FieldRow>
          <FieldRow label="Date Format" desc="How dates are shown across the system">
            <select value={fmt} onChange={e => setFmt(e.target.value)} className={SEL}>
              <option value="dd MMM yyyy">26 Jun 2026</option>
              <option value="dd/MM/yyyy">26/06/2026</option>
              <option value="yyyy-MM-dd">2026-06-26</option>
            </select>
          </FieldRow>
          <FieldRow label="Theme" desc="UI colour theme">
            <div className="flex gap-1.5">
              {(["light", "dark", "system"] as const).map(t => (
                <button key={t} onClick={() => setTheme(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-colors ${
                    theme === t
                      ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]"
                      : "bg-white text-[var(--color-ink-600)] border-[var(--color-border)] hover:bg-[var(--color-ink-50)]"
                  }`}>{t}</button>
              ))}
            </div>
          </FieldRow>
        </div>
      </Card>
    </>
  );
}

// ── Section: Hospital Information ─────────────────────────────────────────────
function HospitalInfoSection({ hospital, onSaved }: { hospital: Hospital; onSaved: () => void }) {
  const [contact, setContact] = useState(hospital.contact ?? "");
  const [address, setAddress] = useState(hospital.address ?? "");
  const [website, setWebsite] = useState("");
  const [email,   setEmail]   = useState("");
  const [error,   setError]   = useState("");
  const [pending, startTransition] = useTransition();
  const [logoPreview, setLogoPreview] = useState<string | null>(hospital.logoUrl ?? null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoMsg, setLogoMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setLogoMsg({ type: "err", text: "File too large — max 2 MB." });
      return;
    }
    setLogoUploading(true);
    setLogoMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      const result = await saveHospitalLogo(hospital.id, url);
      if (result.error) {
        setLogoMsg({ type: "err", text: result.error });
      } else {
        setLogoPreview(url);
        setLogoMsg({ type: "ok", text: "Logo updated." });
      }
    } catch {
      setLogoMsg({ type: "err", text: "Upload failed. Please try again." });
    } finally {
      setLogoUploading(false);
    }
  }

  const save = () => {
    setError("");
    startTransition(async () => {
      const res = await updateHospitalSettings(hospital.id, { contact, address });
      if (res?.error) { setError(res.error); return; }
      onSaved();
    });
  };

  return (
    <>
      <SectionHeader title="Hospital Information" desc="Core hospital profile, contact details, and branding." />

      {/* Logo */}
      <Card className="mb-4 p-5">
        <p className="text-sm font-semibold text-[var(--color-ink-900)] mb-3">Hospital Logo</p>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-sunken)] flex items-center justify-center overflow-hidden shrink-0">
            {logoPreview
              ? <img src={logoPreview} alt="Hospital logo" className="w-full h-full object-cover" />
              : <Building2 size={28} className="text-[var(--color-ink-300)]" />}
          </div>
          <div>
            <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] bg-white text-sm font-medium text-[var(--color-ink-700)] cursor-pointer hover:bg-[var(--color-ink-50)] transition-colors ${logoUploading ? "opacity-50 pointer-events-none" : ""}`}>
              <Upload size={14} /> {logoUploading ? "Uploading…" : "Upload Logo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="sr-only"
                onChange={handleLogoUpload}
                disabled={logoUploading}
              />
            </label>
            <p className="text-xs text-[var(--color-ink-400)] mt-1.5">PNG or SVG · max 2 MB · 200×200 px recommended</p>
            {logoMsg && (
              <p className={`text-xs mt-1 ${logoMsg.type === "ok" ? "text-emerald-600" : "text-red-500"}`}>
                {logoMsg.text}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Identity */}
      <Card className="mb-4 p-5">
        <p className="text-sm font-semibold text-[var(--color-ink-900)] mb-4">Identity</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LBL}>Hospital Name</label>
            <input value={hospital.name} disabled className={`${INP} opacity-50 cursor-not-allowed`} />
            <p className="text-[10px] text-[var(--color-ink-400)] mt-1">Contact support to change.</p>
          </div>
          <div>
            <label className={LBL}>Short Code</label>
            <input value={hospital.shortCode} disabled className={`${INP} font-mono opacity-50 cursor-not-allowed`} />
          </div>
          <div>
            <label className={LBL}><Phone size={11} className="inline mr-1" />Phone</label>
            <input value={contact} onChange={e => setContact(e.target.value)} placeholder="+91 98765 43210" className={INP} />
          </div>
          <div>
            <label className={LBL}><Mail size={11} className="inline mr-1" />Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="hospital@example.com" className={INP} />
          </div>
          <div>
            <label className={LBL}><Globe size={11} className="inline mr-1" />Website</label>
            <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://hospital.com" className={INP} />
          </div>
          <div className="sm:col-span-2">
            <label className={LBL}><MapPin size={11} className="inline mr-1" />Address</label>
            <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} placeholder="Street, City, State, PIN" className={`${INP} resize-none`} />
          </div>
        </div>
      </Card>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <SaveRow onSave={save} pending={pending} />
    </>
  );
}

// ── Section: Departments ──────────────────────────────────────────────────────
const DEFAULT_DEPTS = [
  "General OPD","Ophthalmology","ENT","Orthopedics","Cardiology",
  "Dermatology","Neurology","Pediatrics","Gynecology","Radiology",
];

function DepartmentsSection() {
  const [depts, setDepts] = useState(DEFAULT_DEPTS);
  const [newDept, setNewDept] = useState("");

  const add = () => {
    const v = newDept.trim();
    if (v && !depts.includes(v)) { setDepts([...depts, v]); setNewDept(""); }
  };

  return (
    <>
      <SectionHeader title="Departments" desc="Manage hospital departments used to categorise doctors and appointments." />
      <Card className="p-5">
        <div className="flex gap-2 mb-5">
          <input value={newDept} onChange={e => setNewDept(e.target.value)} onKeyDown={e => e.key === "Enter" && add()}
            placeholder="Add new department…" className={`${INP} flex-1`} />
          <button onClick={add}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-medium hover:bg-[var(--color-primary-700)] transition-colors">
            <Plus size={14} /> Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {depts.map(d => (
            <span key={d} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-sm font-medium text-[var(--color-ink-700)]">
              {d}
              <button onClick={() => setDepts(depts.filter(x => x !== d))} className="text-[var(--color-ink-400)] hover:text-red-600 transition-colors">
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
        <p className="text-xs text-[var(--color-ink-400)] mt-4">{depts.length} departments configured</p>
      </Card>
    </>
  );
}

// ── Section: Users & Roles ────────────────────────────────────────────────────
const PERM_MATRIX = [
  { cat: "Appointments", perms: [
    { label: "View Appointments",    desc: "See the full appointment list",             roles: ["DOCTOR","HOSPITAL","REFRACTIONIST"] },
    { label: "Book Appointments",    desc: "Schedule new appointments",                 roles: ["DOCTOR","HOSPITAL"] },
    { label: "Confirm Appointments", desc: "Move appointment Requested → Confirmed",    roles: ["DOCTOR","HOSPITAL"] },
    { label: "Cancel Appointments",  desc: "Cancel an existing appointment",            roles: ["DOCTOR","HOSPITAL"] },
  ]},
  { cat: "Patients", perms: [
    { label: "View Patients",     desc: "Browse and search patient directory",          roles: ["DOCTOR","HOSPITAL"] },
    { label: "Register Patients", desc: "Create new patient records",                  roles: ["DOCTOR","HOSPITAL"] },
    { label: "Edit Patient Info", desc: "Update demographics and contact details",      roles: ["DOCTOR","HOSPITAL"] },
  ]},
  { cat: "EMR / Clinical", perms: [
    { label: "View EMR",             desc: "Read visit history and clinical notes",     roles: ["DOCTOR","HOSPITAL","REFRACTIONIST"] },
    { label: "Write Clinical Notes", desc: "Add or edit doctor examination notes",      roles: ["DOCTOR"] },
    { label: "Record Refraction",    desc: "Enter VA, IOP and refraction results",      roles: ["DOCTOR","REFRACTIONIST"] },
  ]},
  { cat: "Administration", perms: [
    { label: "Hospital Settings", desc: "Edit hospital profile and configuration",      roles: ["DOCTOR","HOSPITAL"] },
    { label: "View Audit Trail",  desc: "See a full log of all system actions",        roles: ["DOCTOR"] },
    { label: "Manage Chip Options","desc":"Configure pre-set tags for notes",           roles: ["DOCTOR"] },
  ]},
];

const ROLES_DEF = [
  { key: "DOCTOR",        label: "Doctor",       short: "Dr",  bg: "bg-[var(--color-primary-600)]" },
  { key: "HOSPITAL",      label: "Hospital Staff",short: "HS", bg: "bg-emerald-600" },
  { key: "REFRACTIONIST", label: "Refractionist", short: "Rf", bg: "bg-amber-500" },
];

function UsersRolesSection() {
  const totalPerms = PERM_MATRIX.reduce((a, g) => a + g.perms.length, 0);
  return (
    <>
      <SectionHeader title="Users & Roles" desc="Role-based access control matrix for all staff types." />

      {/* Role summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {ROLES_DEF.map(role => {
          const count = role.key === "DOCTOR"
            ? totalPerms
            : PERM_MATRIX.reduce((a, g) => a + g.perms.filter(p => p.roles.includes(role.key)).length, 0);
          return (
            <Card key={role.key} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold ${role.bg}`}>
                  {role.short}
                </span>
                <div>
                  <p className="text-xs font-semibold text-[var(--color-ink-900)] leading-tight">{role.label}</p>
                  <p className="text-[10px] text-[var(--color-ink-400)]">{count}/{totalPerms} permissions</p>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--color-surface-sunken)]">
                <div className={`h-1.5 rounded-full ${role.bg}`} style={{ width: `${(count / totalPerms) * 100}%` }} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Permission matrix */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] w-[52%]">Permission</th>
                {ROLES_DEF.map(r => (
                  <th key={r.key} className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-white text-[10px] font-bold ${r.bg}`}>{r.short}</span>
                    <span className="block mt-1 text-[9px] whitespace-nowrap">{r.label.split(" ")[0]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERM_MATRIX.map(group => (
                <React.Fragment key={group.cat}>
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] bg-[var(--color-surface-sunken)]/50">
                      {group.cat}
                    </td>
                  </tr>
                  {group.perms.map(perm => (
                    <tr key={perm.label} className="border-t border-[var(--color-border)] hover:bg-[var(--color-ink-50)] transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="text-xs font-medium text-[var(--color-ink-800)]">{perm.label}</p>
                        <p className="text-[10px] text-[var(--color-ink-400)]">{perm.desc}</p>
                      </td>
                      {ROLES_DEF.map(role => {
                        const isAdmin  = role.key === "DOCTOR";
                        const allowed  = isAdmin || perm.roles.includes(role.key);
                        return (
                          <td key={role.key} className="px-3 py-2.5 text-center">
                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${
                              isAdmin  ? "bg-[var(--color-primary-100)]" :
                              allowed  ? "bg-emerald-100" : "bg-[var(--color-surface-sunken)]"
                            }`}>
                              {isAdmin ? <Crown size={10} className="text-[var(--color-primary-600)]" /> :
                               allowed ? <Check size={10} className="text-emerald-600" strokeWidth={2.5} /> :
                                         <Minus size={10} className="text-[var(--color-ink-300)]" />}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-[var(--color-border)] bg-[var(--color-surface-sunken)] flex gap-4 text-[10px] text-[var(--color-ink-400)]">
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-[var(--color-primary-100)] inline-flex items-center justify-center"><Crown size={8} className="text-[var(--color-primary-600)]" /></span> Super Admin</span>
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-emerald-100 inline-flex items-center justify-center"><Check size={8} className="text-emerald-600" strokeWidth={2.5} /></span> Allowed</span>
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-[var(--color-surface-sunken)] inline-flex items-center justify-center"><Minus size={8} className="text-[var(--color-ink-300)]" /></span> Restricted</span>
        </div>
      </Card>
    </>
  );
}

// ── Section: Appointments ─────────────────────────────────────────────────────
function AppointmentsSection() {
  const [slotMins,    setSlotMins]    = useState(15);
  const [maxPerDay,   setMaxPerDay]   = useState(50);
  const [advanceDays, setAdvanceDays] = useState(30);
  const [cancelHrs,   setCancelHrs]   = useState(2);
  const [online,      setOnline]      = useState(true);
  const [walkIn,      setWalkIn]      = useState(true);
  const [autoConfirm, setAutoConfirm] = useState(false);

  return (
    <>
      <SectionHeader title="Appointment Settings" desc="Configure booking rules, slot durations, and availability policies." />
      <Card className="mb-4 p-5">
        <p className={SEC}>Scheduling</p>
        <FieldRow label="Default Slot Duration" desc="Minutes per appointment slot">
          <div className="flex gap-1.5 flex-wrap">
            {[10,15,20,30,45,60].map(m => (
              <button key={m} onClick={() => setSlotMins(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  slotMins === m ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]"
                                 : "bg-white text-[var(--color-ink-600)] border-[var(--color-border)] hover:bg-[var(--color-ink-50)]"
                }`}>{m}m</button>
            ))}
          </div>
        </FieldRow>
        <FieldRow label="Max Appointments / Day" desc="Hard limit on daily slots">
          <div className="flex items-center gap-2">
            <input type="number" value={maxPerDay} onChange={e => setMaxPerDay(Number(e.target.value))} min={1} max={500}
              className="w-20 rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]" />
            <span className="text-xs text-[var(--color-ink-400)]">appts</span>
          </div>
        </FieldRow>
        <FieldRow label="Advance Booking Window" desc="How far ahead patients can book">
          <select value={advanceDays} onChange={e => setAdvanceDays(Number(e.target.value))} className={SEL}>
            {[1,3,7,14,30,60,90].map(d => <option key={d} value={d}>{d} day{d !== 1 ? "s" : ""}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Cancellation Notice" desc="Minimum notice required to cancel">
          <select value={cancelHrs} onChange={e => setCancelHrs(Number(e.target.value))} className={SEL}>
            {[1,2,4,6,12,24,48].map(h => <option key={h} value={h}>{h} hr{h !== 1 ? "s" : ""}</option>)}
          </select>
        </FieldRow>
      </Card>
      <Card className="p-5">
        <p className={SEC}>Features</p>
        <FieldRow label="Online Booking"          desc="Allow patients to book via the portal"><Toggle checked={online}      onChange={setOnline}      /></FieldRow>
        <FieldRow label="Walk-in Appointments"     desc="Allow walk-ins at the front desk">    <Toggle checked={walkIn}      onChange={setWalkIn}      /></FieldRow>
        <FieldRow label="Auto-confirm Bookings"    desc="Confirm new bookings automatically">  <Toggle checked={autoConfirm} onChange={setAutoConfirm} /></FieldRow>
      </Card>
    </>
  );
}

// ── Section: Notifications ────────────────────────────────────────────────────
const NOTIF_EVENTS = [
  { label: "Appointment Confirmed",  desc: "When a booking is confirmed",         email: true,  sms: true  },
  { label: "Appointment Cancelled",  desc: "When a booking is cancelled",         email: true,  sms: false },
  { label: "Appointment Reminder",   desc: "24 hours before the appointment",     email: true,  sms: true  },
  { label: "New Patient Registered", desc: "When a new patient record is created",email: true,  sms: false },
  { label: "Pending Request Alert",  desc: "When a new booking request arrives",  email: false, sms: false },
  { label: "Daily Summary Report",   desc: "End-of-day appointments summary",     email: true,  sms: false },
];

function NotificationsSection() {
  const [prefs, setPrefs] = useState(NOTIF_EVENTS.map(e => ({ email: e.email, sms: e.sms })));
  const toggle = (i: number, ch: "email" | "sms") => {
    const next = [...prefs]; next[i] = { ...next[i], [ch]: !next[i][ch] }; setPrefs(next);
  };
  return (
    <>
      <SectionHeader title="Notification Preferences" desc="Control when and how the hospital receives system notifications." />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] w-[60%]">Event</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">Email</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">SMS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {NOTIF_EVENTS.map((ev, i) => (
                <tr key={ev.label} className="hover:bg-[var(--color-ink-50)] transition-colors">
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-medium text-[var(--color-ink-800)]">{ev.label}</p>
                    <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{ev.desc}</p>
                  </td>
                  <td className="px-4 py-3.5 text-center"><Toggle checked={prefs[i].email} onChange={() => toggle(i, "email")} /></td>
                  <td className="px-4 py-3.5 text-center"><Toggle checked={prefs[i].sms}   onChange={() => toggle(i, "sms")}   /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

// ── Section: Billing ──────────────────────────────────────────────────────────
function BillingSection() {
  return (
    <>
      <SectionHeader title="Billing & Payments" desc="Fee structures, payment methods, and invoice configuration." />
      <Card className="p-12 text-center">
        <CreditCard size={36} className="mx-auto text-[var(--color-ink-300)] mb-3" />
        <p className="text-base font-semibold text-[var(--color-ink-700)]">Billing module coming soon</p>
        <p className="text-sm text-[var(--color-ink-400)] mt-1 max-w-xs mx-auto">
          Fee collection, invoicing, payment gateway integration, and revenue analytics will be available in a future release.
        </p>
      </Card>
    </>
  );
}

// ── Section: Security ─────────────────────────────────────────────────────────
function SecuritySection() {
  const [sessionMins, setSessionMins] = useState(60);
  const [minPwd,      setMinPwd]      = useState(8);
  const [maxAttempts, setMaxAttempts] = useState(5);
  const [req2fa,      setReq2fa]      = useState(false);
  const [ipAllow,     setIpAllow]     = useState(false);

  return (
    <>
      <SectionHeader title="Security Settings" desc="Authentication, session management, and access security configuration." />
      <Card className="mb-4 p-5">
        <p className={SEC}>Session & Authentication</p>
        <FieldRow label="Session Timeout" desc="Auto-logout after inactivity">
          <select value={sessionMins} onChange={e => setSessionMins(Number(e.target.value))} className={SEL}>
            {[15,30,60,120,240,480].map(m => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m/60} hr`}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Failed Login Lockout" desc="Lock account after N failed attempts">
          <div className="flex gap-1.5">
            {[3,5,10,20].map(n => (
              <button key={n} onClick={() => setMaxAttempts(n)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  maxAttempts === n ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]"
                                   : "bg-white text-[var(--color-ink-600)] border-[var(--color-border)] hover:bg-[var(--color-ink-50)]"
                }`}>{n}×</button>
            ))}
          </div>
        </FieldRow>
      </Card>
      <Card className="mb-4 p-5">
        <p className={SEC}>Password Policy</p>
        <FieldRow label="Minimum Password Length" desc="Characters required for all accounts">
          <div className="flex items-center gap-2">
            <input type="number" value={minPwd} onChange={e => setMinPwd(Number(e.target.value))} min={6} max={32}
              className="w-16 rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]" />
            <span className="text-xs text-[var(--color-ink-400)]">characters</span>
          </div>
        </FieldRow>
      </Card>
      <Card className="p-5">
        <p className={SEC}>Advanced</p>
        <FieldRow label="Two-Factor Authentication" desc="Require 2FA for all staff logins">
          <div className="flex items-center gap-2"><Toggle checked={req2fa} onChange={setReq2fa} /><SoonBadge /></div>
        </FieldRow>
        <FieldRow label="IP Allowlist" desc="Restrict logins to specific IP addresses">
          <div className="flex items-center gap-2"><Toggle checked={ipAllow} onChange={setIpAllow} /><SoonBadge /></div>
        </FieldRow>
      </Card>
    </>
  );
}

// ── Section: Integrations ─────────────────────────────────────────────────────
const INTEGRATIONS = [
  { name: "WhatsApp Business",  desc: "Send appointment reminders via WhatsApp",  icon: "💬" },
  { name: "SMS Gateway",        desc: "Twilio / Fast2SMS for SMS notifications",   icon: "📱" },
  { name: "Email (SMTP)",       desc: "Custom SMTP for transactional emails",      icon: "✉️"  },
  { name: "HL7 / FHIR",        desc: "Interoperability with other HIS systems",   icon: "🏥" },
  { name: "Aadhaar e-KYC",     desc: "Verify patient identity via Aadhaar",       icon: "🆔" },
  { name: "Insurance Portal",   desc: "Direct insurance claim submission",         icon: "🛡️" },
];

function IntegrationsSection() {
  return (
    <>
      <SectionHeader title="Integrations" desc="Connect external services and third-party systems." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {INTEGRATIONS.map(int => (
          <Card key={int.name} className="p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-sunken)] flex items-center justify-center text-xl flex-shrink-0">
              {int.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <p className="text-sm font-semibold text-[var(--color-ink-900)]">{int.name}</p>
                <SoonBadge />
              </div>
              <p className="text-xs text-[var(--color-ink-400)]">{int.desc}</p>
              <button className="mt-2 text-xs font-medium text-[var(--color-ink-300)] cursor-not-allowed">Configure →</button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

// ── Section: Data & Backup ────────────────────────────────────────────────────
const RETENTION = [1,3,5,7,10,15,20,25];

function DataBackupSection({ hospital, onSaved }: { hospital: Hospital; onSaved: () => void }) {
  const [years,   setYears]   = useState(hospital.retentionYears);
  const [error,   setError]   = useState("");
  const [pending, startTransition] = useTransition();

  const save = () => {
    setError("");
    startTransition(async () => {
      const res = await updateHospitalSettings(hospital.id, { retentionYears: years });
      if (res?.error) { setError(res.error); return; }
      onSaved();
    });
  };

  return (
    <>
      <SectionHeader title="Data & Backup" desc="Configure data retention, exports, and backup schedule." />

      {/* Retention */}
      <Card className="mb-4 p-5">
        <div className="flex items-center gap-2 mb-1">
          <Clock size={15} className="text-[var(--color-primary-600)]" />
          <p className="text-sm font-semibold text-[var(--color-ink-900)]">Data Retention Policy</p>
        </div>
        <p className="text-xs text-[var(--color-ink-400)] mb-4">Patient records are retained for this period per compliance requirements.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {RETENTION.map(y => (
            <button key={y} onClick={() => setYears(y)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                years === y ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]"
                            : "bg-white text-[var(--color-ink-600)] border-[var(--color-border)] hover:bg-[var(--color-ink-50)]"
              }`}>{y} yr{y !== 1 ? "s" : ""}</button>
          ))}
        </div>
        <p className="text-xs text-[var(--color-ink-400)]">Currently <strong>{years} years</strong>. Older records may be archived.</p>
      </Card>

      {/* Export */}
      <Card className="mb-4 p-5">
        <p className="text-sm font-semibold text-[var(--color-ink-900)] mb-3">Export Data</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Patient Records",     icon: <Users size={15} />,    desc: "All patient demographics"  },
            { label: "Appointments",        icon: <Calendar size={15} />, desc: "All appointment history"   },
            { label: "Full Backup (ZIP)",   icon: <Database size={15} />, desc: "Complete data export"      },
          ].map(ex => (
            <button key={ex.label}
              className="flex flex-col items-start gap-2 p-3.5 rounded-xl border border-[var(--color-border)] bg-white hover:bg-[var(--color-ink-50)] transition-colors text-left">
              <div className="flex items-center gap-1.5 text-[var(--color-primary-600)]">{ex.icon}<Download size={13} /></div>
              <div>
                <p className="text-xs font-semibold text-[var(--color-ink-800)]">{ex.label}</p>
                <p className="text-[10px] text-[var(--color-ink-400)]">{ex.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Backup schedule */}
      <Card className="mb-5 p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-[var(--color-ink-900)]">Automated Backup</p>
          <SoonBadge />
        </div>
        <div className="grid grid-cols-2 gap-3 opacity-40 pointer-events-none">
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-2">
            <RefreshCw size={14} className="text-emerald-600" />
            <div>
              <p className="text-xs font-semibold text-emerald-800">Daily at 2:00 AM</p>
              <p className="text-[10px] text-emerald-600">Last run: —</p>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border)] flex items-center gap-2">
            <CheckCircle2 size={14} className="text-[var(--color-ink-400)]" />
            <div>
              <p className="text-xs font-semibold text-[var(--color-ink-600)]">7-day retention</p>
              <p className="text-[10px] text-[var(--color-ink-400)]">Stored in cloud</p>
            </div>
          </div>
        </div>
      </Card>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <SaveRow onSave={save} pending={pending} />
    </>
  );
}

// ── Section: Audit Logs ───────────────────────────────────────────────────────
const MOCK_LOGS = [
  { time: "09:42 AM", user: "Sunrise Front Desk", action: "Confirmed appointment",    subject: "PPMS-SEH-0005 · Sreeni",     dot: "bg-emerald-500" },
  { time: "09:31 AM", user: "Sunrise Front Desk", action: "Registered new patient",   subject: "Fathima Beevi · SEH-0004",   dot: "bg-blue-400"    },
  { time: "09:18 AM", user: "Sunrise Front Desk", action: "Cancelled appointment",    subject: "PPMS-SEH-0003 · Suresh Babu",dot: "bg-amber-500"   },
  { time: "09:05 AM", user: "Dr. Ravi Kumar",     action: "Updated EMR notes",        subject: "Lakshmi Iyer · Visit #23",   dot: "bg-blue-400"    },
  { time: "08:57 AM", user: "Sunrise Front Desk", action: "Staff login",              subject: "hospital_a · 192.168.1.10",  dot: "bg-blue-400"    },
  { time: "08:45 AM", user: "Dr. Ravi Kumar",     action: "Updated availability",     subject: "Monday 4–7 PM slot",         dot: "bg-blue-400"    },
  { time: "08:30 AM", user: "System",             action: "Daily backup completed",   subject: "23 MB · 5 tables",           dot: "bg-emerald-500" },
  { time: "Yesterday",user: "Sunrise Front Desk", action: "Changed hospital address", subject: "Settings updated",           dot: "bg-blue-400"    },
];

function AuditLogsSection() {
  return (
    <>
      <SectionHeader title="Audit Logs" desc="A chronological record of all system actions performed by staff." />
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-[var(--color-ink-400)]">27 Jun 2026 — 8 most recent events</p>
        <button className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)] transition-colors">
          <Download size={12} /> Export Log
        </button>
      </div>
      <Card className="overflow-hidden">
        <div className="divide-y divide-[var(--color-border)]">
          {MOCK_LOGS.map((log, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--color-ink-50)] transition-colors">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${log.dot}`} />
              <div className="flex-1 min-w-0 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-[var(--color-ink-800)]">{log.action}</p>
                  <p className="text-[10px] text-[var(--color-ink-400)] mt-0.5">{log.subject}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] font-medium text-[var(--color-ink-500)]">{log.time}</p>
                  <p className="text-[10px] text-[var(--color-ink-400)] mt-0.5">{log.user}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-2.5 border-t border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-center text-xs text-[var(--color-ink-400)]">
          Full audit log persistence coming in a future release
        </div>
      </Card>
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function HospitalSettingsClient({ hospital }: { hospital: Hospital }) {
  const [section,    setSection]    = useState<Section>("hospital");
  const [savedToast, setSavedToast] = useState(false);

  function handleSaved() {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  }

  function renderSection() {
    switch (section) {
      case "hospital":      return <HospitalInfoSection hospital={hospital} onSaved={handleSaved} />;
      case "departments":   return <DepartmentsSection />;
      case "users":         return <UsersRolesSection />;
      case "appointments":  return <AppointmentsSection />;
      case "notifications": return <NotificationsSection />;
      case "backup":        return <DataBackupSection hospital={hospital} onSaved={handleSaved} />;
      case "audit":         return <AuditLogsSection />;
    }
  }

  return (
    <div className="fade-in">
      {/* Toast */}
      {savedToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow-lg animate-in slide-in-from-top-2">
          <CheckCircle2 size={15} /> Settings saved successfully
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--color-ink-900)] tracking-tight">Settings</h1>
        <p className="text-sm text-[var(--color-ink-500)] mt-0.5">{hospital.name} · Hospital Management System configuration</p>
      </div>

      {/* Mobile horizontal tabs */}
      <div className="lg:hidden overflow-x-auto mb-4 pb-1">
        <div className="flex gap-1 min-w-max">
          {NAV.map(item => (
            <button key={item.key} onClick={() => setSection(item.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                section === item.key
                  ? "bg-[var(--color-primary-600)] text-white"
                  : "bg-white border border-[var(--color-border)] text-[var(--color-ink-600)]"
              }`}>
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Layout */}
      <div className="flex gap-5 items-start">

        {/* Left sidebar */}
        <aside className="w-52 flex-shrink-0 hidden lg:block sticky top-4">
          <nav className="bg-white rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
            {NAV.map((item, idx) => {
              const active = section === item.key;
              return (
                <div key={item.key}>
                  {DIVIDERS.has(idx) && <div className="h-px bg-[var(--color-border)]" />}
                  <button
                    onClick={() => setSection(item.key)}
                    className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm font-medium transition-colors text-left ${
                      active
                        ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
                        : "text-[var(--color-ink-600)] hover:bg-[var(--color-ink-50)] hover:text-[var(--color-ink-900)]"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={active ? "text-[var(--color-primary-600)]" : "text-[var(--color-ink-400)]"}>
                        {item.icon}
                      </span>
                      {item.label}
                    </span>
                    <span className="flex items-center gap-1 flex-shrink-0">
                      {item.badge && <SoonBadge />}
                      {active && <ChevronRight size={13} className="text-[var(--color-primary-400)]" />}
                    </span>
                  </button>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          {renderSection()}
        </main>
      </div>
    </div>
  );
}
