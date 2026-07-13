"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Search, Pencil, Trash2, X, Check, Stethoscope,
  LayoutGrid, List, ChevronLeft, ChevronRight, Plus,
  Phone, MapPin, KeyRound, Users, Activity,
} from "lucide-react";

type HospitalInfo = {
  id: string; name: string; shortCode: string; contact: string | null; address?: string | null;
  username: string | null;
  active: boolean | null; // null = hospital has no login account
  doctors: { name: string; username: string; specialty: string | null }[];
};

/* ── Helpers ──────────────────────────────────────────────────────────── */
const AVATAR_GRADIENTS = [
  ["#2563EB", "#06B6D4"],
  ["#10B981", "#14B8A6"],
  ["#8B5CF6", "#6366F1"],
  ["#F59E0B", "#F97316"],
  ["#EC4899", "#F43F5E"],
  ["#06B6D4", "#14B8A6"],
];
function avatarGradient(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const [a, b] = AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function useCountUp(target: number, duration = 800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target <= 0) { setVal(0); return; }
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

const rise = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };

/* ── Chips ────────────────────────────────────────────────────────────── */
function StatusChip({ active, onToggle }: { active: boolean | null; onToggle: () => void }) {
  if (active === null) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
        <KeyRound size={11} />
        No Login
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      title={active ? "Click to deactivate — blocks login" : "Click to activate — allows login"}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all hover:scale-[1.04] ${
        active
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-red-50 text-red-600 border-red-200"
      }`}
      style={!active ? { boxShadow: "0 0 12px rgba(239,68,68,0.25)" } : {}}
    >
      <span className="relative flex w-2 h-2">
        {active && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />}
        <span className={`relative inline-flex w-2 h-2 rounded-full ${active ? "bg-emerald-500" : "bg-red-500"}`} />
      </span>
      {active ? "Active" : "Inactive"}
    </button>
  );
}

function DoctorCountChip({ count }: { count: number }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
      count > 0
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : "bg-slate-100 text-slate-500 border-slate-200"
    }`}>
      <Stethoscope size={11} />
      {count} {count === 1 ? "Doctor" : "Doctors"}
    </span>
  );
}

/* ── Doctor avatar stack ──────────────────────────────────────────────── */
function DoctorStack({ doctors }: { doctors: HospitalInfo["doctors"] }) {
  if (doctors.length === 0) {
    return <p className="text-xs text-slate-300 italic">No doctors linked yet.</p>;
  }
  const shown = doctors.slice(0, 3);
  const extra = doctors.length - shown.length;
  return (
    <div className="flex flex-col gap-2">
      {shown.map((d, i) => (
        <div key={i} className="flex items-center gap-2.5 min-w-0" title={`@${d.username}${d.specialty ? " · " + d.specialty : ""}`}>
          <div
            className="rounded-lg flex items-center justify-center text-white font-bold text-[10px] shrink-0"
            style={{ width: 26, height: 26, background: avatarGradient(d.name) }}
          >
            {initials(d.name)}
          </div>
          <p className="text-xs font-medium text-slate-600 truncate">{d.name}</p>
          {d.specialty && <p className="text-[10px] text-slate-300 truncate hidden sm:block">{d.specialty}</p>}
        </div>
      ))}
      {extra > 0 && (
        <p className="text-[11px] font-semibold text-blue-600 pl-9" title={doctors.slice(3).map((d) => d.name).join(", ")}>
          +{extra} more
        </p>
      )}
    </div>
  );
}

/* ── Icon action button ───────────────────────────────────────────────── */
function IconBtn({ title, onClick, tone, children }: {
  title: string; onClick?: () => void;
  tone: "blue" | "red";
  children: React.ReactNode;
}) {
  const tones = {
    blue: "text-slate-400 hover:text-blue-600 hover:bg-blue-50",
    red:  "text-slate-400 hover:text-red-500 hover:bg-red-50",
  };
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-110 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

/* ── Stat card ────────────────────────────────────────────────────────── */
function StatCard({ icon, value, label, sub, tint }: {
  icon: React.ReactNode; value: number; label: string; sub: string; tint: string;
}) {
  const counted = useCountUp(value);
  return (
    <motion.div
      variants={rise}
      whileHover={{ y: -4 }}
      className="rounded-2xl bg-white border border-slate-200/80 px-5 py-4"
      style={{ boxShadow: "0 10px 30px rgba(15,23,42,0.06)" }}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: tint + "1a", color: tint }}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[26px] leading-8 font-bold text-slate-900 tabular-nums">{counted}</p>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">{label}</p>
        </div>
      </div>
      <p className="text-[11px] text-slate-400 mt-2">{sub}</p>
    </motion.div>
  );
}

/* ── Modal ────────────────────────────────────────────────────────────── */
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md rounded-3xl bg-white p-6"
        style={{ boxShadow: "0 25px 60px rgba(15,23,42,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-[14px] focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-500 transition-all placeholder:text-slate-300";

/* ── Main view ────────────────────────────────────────────────────────── */
export function HospitalManagementView({ onAddHospital }: { onAddHospital: () => void }) {
  const [hospitals, setHospitals] = useState<HospitalInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "no-login">("all");
  const [sort, setSort] = useState<"name-asc" | "name-desc" | "doctors">("name-asc");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<HospitalInfo | null>(null);
  const [deleting, setDeleting] = useState<HospitalInfo | null>(null);
  const [editForm, setEditForm] = useState({ name: "", shortCode: "", contact: "", address: "" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch("/api/setup/hospitals-with-doctors")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setHospitals(d); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const startEdit = (h: HospitalInfo) => {
    setEditing(h);
    setEditForm({ name: h.name, shortCode: h.shortCode, contact: h.contact || "", address: h.address || "" });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    await fetch(`/api/setup/hospitals/${editing.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setSaving(false);
    setEditing(null);
    load();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    await fetch(`/api/setup/hospitals/${deleting.id}`, { method: "DELETE" });
    setHospitals((prev) => prev.filter((h) => h.id !== deleting.id));
    setDeleting(null);
  };

  const toggleActive = async (h: HospitalInfo) => {
    if (h.active === null) return;
    setHospitals((prev) => prev.map((x) => x.id === h.id ? { ...x, active: !h.active } : x));
    await fetch(`/api/setup/hospitals/${h.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !h.active }),
    }).catch(() => load());
  };

  /* Derived */
  const stats = useMemo(() => {
    const total = hospitals.length;
    const doctors = hospitals.reduce((sum, h) => sum + h.doctors.length, 0);
    const active = hospitals.filter((h) => h.active === true).length;
    const noLogin = hospitals.filter((h) => h.active === null).length;
    return { total, doctors, active, noLogin };
  }, [hospitals]);

  const filtered = useMemo(() => {
    let list = hospitals;
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((h) =>
        h.name.toLowerCase().includes(needle) ||
        h.shortCode.toLowerCase().includes(needle) ||
        (h.username ?? "").toLowerCase().includes(needle) ||
        (h.address ?? "").toLowerCase().includes(needle) ||
        h.doctors.some((d) => d.name.toLowerCase().includes(needle))
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((h) =>
        statusFilter === "active" ? h.active === true
        : statusFilter === "inactive" ? h.active === false
        : h.active === null
      );
    }
    const sorted = [...list];
    if (sort === "name-asc")  sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "name-desc") sorted.sort((a, b) => b.name.localeCompare(a.name));
    if (sort === "doctors")   sorted.sort((a, b) => b.doctors.length - a.doctors.length);
    return sorted;
  }, [hospitals, q, statusFilter, sort]);

  const PAGE_SIZE = layout === "grid" ? 9 : 8;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [q, statusFilter, layout]);

  const selectCls = "px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-xl bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all cursor-pointer";

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="max-w-[1200px] flex flex-col gap-5">
      {/* ── Hero ── */}
      <motion.div
        variants={rise}
        className="relative overflow-hidden rounded-3xl px-6 md:px-8 py-7 text-white"
        style={{
          background: "linear-gradient(130deg, #1D4ED8 0%, #2563EB 35%, #06B6D4 100%)",
          boxShadow: "0 20px 50px -12px rgba(37,99,235,0.4)",
        }}
      >
        <div className="absolute -top-14 -right-10 w-48 h-48 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 right-32 w-40 h-40 rounded-full bg-white/[0.07]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[26px] md:text-[32px] font-bold tracking-tight leading-tight">
              🏥 Hospital Management
            </h1>
            <p className="text-sm text-white/80 mt-1.5 max-w-md">
              Manage hospitals, linked doctors and system access.
            </p>
          </div>
          <button
            onClick={onAddHospital}
            className="group inline-flex items-center gap-2 rounded-2xl bg-white text-blue-700 text-sm font-bold px-5 py-3 transition-all hover:scale-[1.03] active:scale-[0.98]"
            style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}
          >
            <Plus size={15} />
            Add Hospital
          </button>
        </div>
      </motion.div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Building2 size={18} />} value={stats.total} label="Hospitals" sub="All registered facilities" tint="#2563EB" />
        <StatCard icon={<Stethoscope size={18} />} value={stats.doctors} label="Doctors" sub="Across all hospitals" tint="#06B6D4" />
        <StatCard icon={<Activity size={18} />} value={stats.active} label="Active"
          sub={stats.total ? `${Math.round((stats.active / stats.total) * 100)}% with live login` : "—"} tint="#10B981" />
        <StatCard icon={<KeyRound size={18} />} value={stats.noLogin} label="No Login"
          sub={stats.noLogin > 0 ? "Awaiting account setup" : "All have accounts"} tint="#F59E0B" />
      </div>

      {/* ── Filter bar ── */}
      <motion.div
        variants={rise}
        className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 px-3 py-2.5"
        style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", boxShadow: "0 10px 30px rgba(15,23,42,0.06)" }}
      >
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search hospitals, codes, doctors…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all placeholder:text-slate-300"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className={selectCls}>
          <option value="all">Status: All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="no-login">No Login</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as any)} className={selectCls}>
          <option value="name-asc">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
          <option value="doctors">Most doctors</option>
        </select>
        <div className="flex rounded-xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => setLayout("grid")}
            title="Grid view"
            className={`px-2.5 py-2 transition-colors ${layout === "grid" ? "bg-blue-600 text-white" : "bg-white text-slate-400 hover:text-slate-600"}`}
          >
            <LayoutGrid size={14} />
          </button>
          <button
            onClick={() => setLayout("list")}
            title="List view"
            className={`px-2.5 py-2 transition-colors ${layout === "list" ? "bg-blue-600 text-white" : "bg-white text-slate-400 hover:text-slate-600"}`}
          >
            <List size={14} />
          </button>
        </div>
      </motion.div>

      {/* ── Content ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-3xl bg-white border border-slate-200 p-5 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100" />
                <div className="flex-1">
                  <div className="h-3.5 bg-slate-100 rounded w-2/3" />
                  <div className="h-2.5 bg-slate-100 rounded w-1/3 mt-2" />
                </div>
              </div>
              <div className="h-2.5 bg-slate-100 rounded w-full mt-5" />
              <div className="h-2.5 bg-slate-100 rounded w-4/5 mt-2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div variants={rise} className="rounded-3xl bg-white border border-slate-200 py-16 flex flex-col items-center text-center"
          style={{ boxShadow: "0 10px 30px rgba(15,23,42,0.06)" }}>
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="w-20 h-20 rounded-3xl flex items-center justify-center text-white mb-5"
            style={{ background: "linear-gradient(135deg,#2563EB,#06B6D4)", boxShadow: "0 15px 35px -8px rgba(37,99,235,0.5)" }}
          >
            <Building2 size={32} />
          </motion.div>
          <p className="text-lg font-bold text-slate-900">No Hospitals Found</p>
          <p className="text-sm text-slate-400 mt-1 max-w-xs">
            {hospitals.length === 0 ? "Start by creating your first hospital." : "No hospitals match the current filters."}
          </p>
          {hospitals.length === 0 && (
            <button
              onClick={onAddHospital}
              className="mt-5 inline-flex items-center gap-2 rounded-2xl text-white text-sm font-semibold px-5 py-2.5 transition-all hover:scale-[1.03]"
              style={{ background: "linear-gradient(135deg,#2563EB,#06B6D4)", boxShadow: "0 8px 24px -6px rgba(37,99,235,0.45)" }}
            >
              <Plus size={14} /> Add Hospital
            </button>
          )}
        </motion.div>
      ) : layout === "grid" ? (
        /* ── Grid cards ── */
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {pageItems.map((h) => (
            <motion.div
              key={h.id}
              variants={rise}
              whileHover={{ y: -8 }}
              className="group relative flex flex-col rounded-3xl bg-white border border-slate-200 p-5 transition-all duration-250 hover:border-cyan-300"
              style={{ boxShadow: "0 10px 30px rgba(15,23,42,0.06)" }}
            >
              <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ boxShadow: "0 20px 45px rgba(15,23,42,0.15), inset 0 0 0 1px rgba(6,182,212,0.2)" }} />

              {/* header */}
              <div className="relative flex items-start gap-3.5">
                <motion.div
                  whileHover={{ rotate: 6, scale: 1.08 }}
                  className="rounded-2xl flex items-center justify-center text-white font-bold text-base shrink-0"
                  style={{ width: 52, height: 52, background: avatarGradient(h.name) }}
                >
                  {initials(h.name)}
                </motion.div>
                <div className="flex-1 min-w-0">
                  <p className="text-[17px] font-bold text-slate-900 leading-tight truncate">{h.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Code: <span className="font-mono text-slate-600">{h.shortCode}</span>
                  </p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                    {h.username ? `@${h.username}` : "no login account"}
                  </p>
                </div>
              </div>

              {/* chips */}
              <div className="relative flex flex-wrap items-center gap-2 mt-4">
                <StatusChip active={h.active} onToggle={() => toggleActive(h)} />
                <DoctorCountChip count={h.doctors.length} />
              </div>

              {/* contact / address */}
              {(h.contact || h.address) && (
                <div className="relative flex flex-col gap-1.5 mt-3">
                  {h.contact && (
                    <p className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Phone size={11} className="shrink-0" /> {h.contact}
                    </p>
                  )}
                  {h.address && (
                    <p className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
                      <MapPin size={11} className="shrink-0" /> <span className="truncate">{h.address}</span>
                    </p>
                  )}
                </div>
              )}

              <div className="relative w-full h-px bg-slate-100 my-4" />

              {/* linked doctors */}
              <div className="relative flex-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                  <Users size={11} /> Linked Doctors
                </p>
                <DoctorStack doctors={h.doctors} />
              </div>

              <div className="relative w-full h-px bg-slate-100 my-4" />

              {/* actions */}
              <div className="relative flex items-center gap-1">
                <IconBtn title="Edit hospital" tone="blue" onClick={() => startEdit(h)}>
                  <Pencil size={14} />
                </IconBtn>
                <IconBtn title="Delete hospital" tone="red" onClick={() => setDeleting(h)}>
                  <Trash2 size={14} />
                </IconBtn>
              </div>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        /* ── List rows ── */
        <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-2.5">
          {pageItems.map((h) => (
            <motion.div
              key={h.id}
              variants={rise}
              whileHover={{ y: -2 }}
              className="group flex flex-wrap items-center gap-3 md:gap-4 rounded-2xl bg-white border border-slate-200 px-4 py-3.5 transition-all duration-200 hover:border-cyan-300"
              style={{ boxShadow: "0 6px 20px rgba(15,23,42,0.05)" }}
            >
              <div
                className="rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ width: 42, height: 42, background: avatarGradient(h.name) }}
              >
                {initials(h.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{h.name}</p>
                <p className="text-xs text-slate-400 font-mono truncate">
                  {h.shortCode}{h.username ? ` · @${h.username}` : ""}{h.contact ? ` · ${h.contact}` : ""}
                </p>
              </div>
              <StatusChip active={h.active} onToggle={() => toggleActive(h)} />
              <DoctorCountChip count={h.doctors.length} />
              <div className="flex items-center gap-1">
                <IconBtn title="Edit hospital" tone="blue" onClick={() => startEdit(h)}>
                  <Pencil size={14} />
                </IconBtn>
                <IconBtn title="Delete hospital" tone="red" onClick={() => setDeleting(h)}>
                  <Trash2 size={14} />
                </IconBtn>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ── Pagination ── */}
      {!loading && filtered.length > 0 && pageCount > 1 && (
        <motion.div variants={rise} className="flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-xs text-slate-400">
            Showing <span className="font-semibold text-slate-600">{(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}</span> of{" "}
            <span className="font-semibold text-slate-600">{filtered.length} Hospitals</span>
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="w-8 h-8 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 disabled:opacity-40 hover:border-blue-300 hover:text-blue-600 transition-all"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: pageCount }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={`w-8 h-8 rounded-xl text-xs font-semibold transition-all ${
                  safePage === i + 1
                    ? "text-white"
                    : "border border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-blue-600"
                }`}
                style={safePage === i + 1 ? { background: "linear-gradient(135deg,#2563EB,#06B6D4)", boxShadow: "0 4px 12px rgba(37,99,235,0.35)" } : {}}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={safePage === pageCount}
              className="w-8 h-8 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 disabled:opacity-40 hover:border-blue-300 hover:text-blue-600 transition-all"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Edit modal ── */}
      <AnimatePresence>
        {editing && (
          <Modal onClose={() => setEditing(null)}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="rounded-xl flex items-center justify-center text-white font-bold text-sm"
                  style={{ width: 40, height: 40, background: avatarGradient(editing.name) }}>
                  {initials(editing.name)}
                </div>
                <div>
                  <p className="text-base font-bold text-slate-900">Edit Hospital</p>
                  <p className="text-xs text-slate-400 font-mono">{editing.shortCode}</p>
                </div>
              </div>
              <button onClick={() => setEditing(null)} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Hospital Name</label>
                <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Short Code</label>
                  <input value={editForm.shortCode} onChange={(e) => setEditForm((f) => ({ ...f, shortCode: e.target.value }))} className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Contact</label>
                  <input value={editForm.contact} onChange={(e) => setEditForm((f) => ({ ...f, contact: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Address</label>
                <input value={editForm.address} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditing(null)}
                className="px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
                Cancel
              </button>
              <button onClick={saveEdit} disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-60 transition-all hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg,#2563EB,#06B6D4)", boxShadow: "0 6px 18px -4px rgba(37,99,235,0.45)" }}>
                <Check size={14} />
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── Delete modal ── */}
      <AnimatePresence>
        {deleting && (
          <Modal onClose={() => setDeleting(null)}>
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 mb-4">
                <Trash2 size={22} />
              </div>
              <p className="text-base font-bold text-slate-900">Delete {deleting.name}?</p>
              <p className="text-sm text-slate-400 mt-1.5 max-w-xs">
                All doctor links will be removed. This cannot be undone.
              </p>
              <div className="flex gap-2 mt-6 w-full">
                <button onClick={() => setDeleting(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
                  Cancel
                </button>
                <button onClick={confirmDelete}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-all"
                  style={{ boxShadow: "0 6px 18px -4px rgba(239,68,68,0.45)" }}>
                  Delete
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
