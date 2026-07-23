"use client";

import { useState, useTransition, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { SingleChipSelect } from "@/components/ui/Chip";
import { ORDER_PRIORITIES, LATERALITY } from "@/lib/constants";
import { addInvestigationOrder, updateInvestigationStatus, attachResult } from "./actions";
import { format } from "date-fns";
import {
  Paperclip, ExternalLink, Upload, Download, Eye, Clock,
  CheckCircle2, XCircle, FlaskConical, Plus, History, Camera,
  X, Search, Star,
} from "lucide-react";

const FAVES_KEY = "ppms_inv_favorites";
import clsx from "clsx";

// ── Investigation catalog ─────────────────────────────────────────────────

const INV_CATALOG: Record<string, { name: string; price: number }[]> = {
  Imaging: [
    { name: "OCT Macula (6mm cube)", price: 1200 },
    { name: "OCT Disc/RNFL", price: 1200 },
    { name: "OCT Anterior Segment", price: 1000 },
    { name: "FFA", price: 3500 },
    { name: "ICGA", price: 4000 },
    { name: "B-scan Ultrasound", price: 800 },
    { name: "UBM", price: 1500 },
    { name: "Fundus Photography", price: 600 },
  ],
  Perimetry: [
    { name: "Humphrey VF 24-2", price: 900 },
    { name: "Humphrey VF 30-2", price: 900 },
    { name: "Goldmann Perimetry", price: 700 },
    { name: "Amsler Grid", price: 200 },
  ],
  Biometry: [
    { name: "A-scan Biometry", price: 600 },
    { name: "IOL Master", price: 1500 },
    { name: "Pentacam", price: 1800 },
    { name: "Specular Microscopy", price: 800 },
  ],
  Refraction: [
    { name: "Cycloplegic Refraction", price: 400 },
    { name: "Manifest Refraction", price: 300 },
    { name: "Keratometry", price: 300 },
    { name: "Topography", price: 1200 },
  ],
  Electrophysiology: [
    { name: "ERG", price: 2500 },
    { name: "VEP", price: 2500 },
    { name: "EOG", price: 2000 },
  ],
  "Pre-op Labs": [
    { name: "CBC", price: 400 },
    { name: "Blood Sugar (FBS/PPBS)", price: 200 },
    { name: "HbA1c", price: 450 },
    { name: "Serum Creatinine", price: 250 },
    { name: "ECG", price: 350 },
    { name: "Chest X-ray", price: 500 },
    { name: "PT/INR", price: 350 },
  ],
  Microbiology: [
    { name: "Corneal Scraping Culture", price: 800 },
    { name: "Conjunctival Swab C/S", price: 600 },
    { name: "KOH Mount", price: 300 },
    { name: "Gram Stain", price: 250 },
  ],
};

// ── Main export ───────────────────────────────────────────────────────────

export function InvestigationsTab({
  visit,
  priorVisits,
  udid,
  readOnly,
}: {
  visit: any;
  priorVisits: any[];
  udid: string;
  readOnly: boolean;
}) {
  const todayStr = format(new Date(), "yyyy-MM-dd");

  // All orders flattened, newest first
  const allOrders: any[] = [
    ...(visit.investigationOrders ?? []),
    ...priorVisits.flatMap((v: any) =>
      (v.investigationOrders ?? []).map((o: any) => ({ ...o, _visitDate: v.date, _hospital: v.hospital?.name, _doctorId: v.doctorId }))
    ),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Today's orders stay in the New Investigations tab until EOD
  const todayOrders = allOrders.filter((o) => format(new Date(o.createdAt), "yyyy-MM-dd") === todayStr);
  const previousOrders = allOrders.filter((o) => format(new Date(o.createdAt), "yyyy-MM-dd") !== todayStr);

  const [activeTab, setActiveTab] = useState<"previous" | "new">("new");

  const tabCls = (id: "previous" | "new") =>
    clsx(
      "flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl border transition-colors",
      activeTab === id
        ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]"
        : "bg-white text-[var(--color-ink-600)] border-[var(--color-border)] hover:border-[var(--color-primary-400)]"
    );

  return (
    <div className="flex flex-col gap-5">
      {/* Sub-tab toggle */}
      <div className="flex gap-3 flex-wrap">
        <button className={tabCls("previous")} onClick={() => setActiveTab("previous")}>
          <History size={15} /> Previous Investigations
          {previousOrders.length > 0 && (
            <span className={clsx("rounded-full text-[10px] font-semibold px-1.5 py-0.5",
              activeTab === "previous" ? "bg-white/20 text-white" : "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]"
            )}>
              {previousOrders.length}
            </span>
          )}
        </button>
        <button className={tabCls("new")} onClick={() => setActiveTab("new")}>
          <Plus size={15} /> New Investigations
          {todayOrders.length > 0 && (
            <span className={clsx("rounded-full text-[10px] font-semibold px-1.5 py-0.5",
              activeTab === "new" ? "bg-white/20 text-white" : "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]"
            )}>
              {todayOrders.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "previous" && (
        <PreviousInvestigations orders={previousOrders} udid={udid} readOnly={readOnly} />
      )}
      {activeTab === "new" && !readOnly && (
        <NewInvestigations visit={visit} udid={udid} todayOrders={todayOrders} onOrdered={() => {}} />
      )}
      {activeTab === "new" && readOnly && (
        <p className="text-sm text-[var(--color-ink-400)] text-center py-8">This visit is closed — no new orders can be placed.</p>
      )}
    </div>
  );
}

// ── Previous Investigations (timeline) ───────────────────────────────────

function PreviousInvestigations({ orders, udid, readOnly }: { orders: any[]; udid: string; readOnly: boolean }) {
  const [viewUrl, setViewUrl] = useState<string | null>(null);

  if (orders.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
          <FlaskConical size={36} className="text-[var(--color-ink-300)]" />
          <p className="text-sm font-medium text-[var(--color-ink-500)]">No previous investigations</p>
          <p className="text-xs text-[var(--color-ink-400)]">Switch to New Investigations to place an order.</p>
        </div>
      </Card>
    );
  }

  // Group by calendar date (dd MMM yyyy)
  const grouped: Record<string, any[]> = {};
  for (const o of orders) {
    const key = format(new Date(o.createdAt), "dd MMM yyyy");
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(o);
  }

  return (
    <>
      {/* PDF/image viewer modal */}
      {viewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setViewUrl(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <p className="text-sm font-medium text-[var(--color-ink-700)]">Result Viewer</p>
              <div className="flex items-center gap-2">
                <a href={viewUrl} download target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary-400)] text-[var(--color-ink-600)] transition-colors">
                  <Download size={13} /> Download
                </a>
                <button onClick={() => setViewUrl(null)} className="text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] text-lg font-bold px-2">×</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {viewUrl.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                <img src={viewUrl} alt="Result" className="max-w-full mx-auto rounded-lg" />
              ) : (
                <iframe src={viewUrl} className="w-full h-[75vh] rounded-lg" title="Result" />
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {Object.entries(grouped).map(([dateLabel, dayOrders]) => (
          <div key={dateLabel}>
            {/* Date header */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-semibold text-[var(--color-ink-500)] tracking-wide">{dateLabel}</span>
              <div className="flex-1 h-px bg-[var(--color-border)]" />
            </div>

            <div className="flex flex-col gap-3">
              {dayOrders.map((order) => (
                <InvestigationCard
                  key={order.id}
                  order={order}
                  udid={udid}
                  readOnly={readOnly}
                  onView={setViewUrl}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function InvestigationCard({
  order, udid, readOnly, onView,
}: {
  order: any; udid: string; readOnly: boolean; onView: (url: string) => void;
}) {
  const isImage = order.resultRef && /\.(jpg|jpeg|png|webp)$/i.test(order.resultRef);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Left: test name + meta */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--color-ink-900)]">{order.testName}</p>
            <PriorityPill priority={order.priority} />
            {order.laterality && (
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-ink-500)]">
                {order.laterality}
              </span>
            )}
            <StatusBadge status={order.status} resultRef={order.resultRef} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-ink-400)]">
            <span className="flex items-center gap-1"><Clock size={11} />{format(new Date(order.createdAt), "h:mm a")}</span>
            {order.category && <span>{order.category}</span>}
            {order._hospital && <span>· {order._hospital}</span>}
          </div>
          {order.notes && (
            <p className="text-xs text-[var(--color-ink-500)] italic mt-0.5">Note: {order.notes}</p>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          {order.resultRef ? (
            <>
              <button
                onClick={() => onView(order.resultRef)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)] transition-colors"
              >
                <Eye size={13} /> View Result
              </button>
              <a
                href={order.resultRef}
                download
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-ink-600)] hover:border-[var(--color-primary-400)] transition-colors"
              >
                <Download size={13} /> Download
              </a>
            </>
          ) : !readOnly ? (
            <UploadButton orderId={order.id} udid={udid} />
          ) : (
            <span className="text-xs text-[var(--color-ink-400)]">Result pending</span>
          )}
        </div>
      </div>

      {/* Inline result preview */}
      {order.resultRef && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
          <p className="text-[11px] font-semibold text-[var(--color-ink-400)] uppercase tracking-wide mb-2">
            {order.testName} — Result
          </p>
          {isImage ? (
            <img
              src={order.resultRef}
              alt={`${order.testName} result`}
              className="max-h-52 rounded-xl cursor-pointer object-contain border border-[var(--color-border)]"
              onClick={() => onView(order.resultRef)}
            />
          ) : (
            <button
              onClick={() => onView(order.resultRef)}
              className="flex items-center gap-2 text-xs text-[var(--color-primary-700)] bg-[var(--color-primary-50)] border border-[var(--color-primary-200)] px-3 py-2 rounded-lg hover:bg-[var(--color-primary-100)] transition-colors"
            >
              <Paperclip size={13} /> {order.testName} result file — click to view
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

function UploadButton({ orderId, udid }: { orderId: string; udid: string }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Upload failed");
      startTransition(async () => {
        const result = await attachResult(orderId, udid, json.url);
        if (result?.error) setError(result.error);
      });
    } catch (err: any) {
      setError(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      {/* Hidden inputs */}
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.docx"
        className="hidden" onChange={handleFile} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment"
        className="hidden" onChange={handleFile} />

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-dashed border-[var(--color-primary-400)] text-[var(--color-primary-600)] hover:bg-[var(--color-primary-50)] disabled:opacity-50 transition-colors"
        >
          {uploading ? <Upload size={13} className="animate-pulse" /> : <Upload size={13} />}
          {uploading ? "Uploading…" : "Add File"}
        </button>
        <button
          type="button"
          disabled={uploading}
          onClick={() => cameraRef.current?.click()}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-dashed border-[var(--color-accent-400)] text-[var(--color-accent-600)] hover:bg-[var(--color-accent-50)] disabled:opacity-50 transition-colors"
        >
          <Camera size={13} /> Camera
        </button>
      </div>
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}

// ── Add Custom Test Modal ─────────────────────────────────────────────────

const ALL_CATALOG_NAMES = Object.values(INV_CATALOG).flat().map((i) => i.name);
const CATALOG_CATEGORIES = Object.keys(INV_CATALOG);

function AddCustomTestModal({
  onAdd,
  onClose,
}: {
  onAdd: (name: string, category: string, saveAsFav: boolean) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(CATALOG_CATEGORIES[0]);
  const [saveAsFav, setSaveAsFav] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = query.length >= 2
    ? ALL_CATALOG_NAMES.filter((n) => n.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = query.trim();
    if (!name) return;
    onAdd(name, category, saveAsFav);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--color-surface)" }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #0F766E 0%, #0D9488 100%)" }}
        >
          <div className="flex items-center gap-2.5">
            <FlaskConical size={17} className="text-white/80" />
            <p className="text-sm font-semibold text-white tracking-tight">Add Test</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors p-1"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {/* Test Name with suggestions */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-widest">
              Test Name <span className="text-[var(--color-danger-500)]">*</span>
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]">
                <Search size={13} />
              </div>
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Search or type a custom test…"
                className="w-full rounded-xl border border-[var(--color-border)] pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]/40 focus:border-[#0F766E]"
              />
              {/* Dropdown suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 left-0 right-0 top-full mt-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg overflow-hidden">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={() => { setQuery(s); setShowSuggestions(false); }}
                      className="w-full text-left px-3.5 py-2 text-sm text-[var(--color-ink-700)] hover:bg-[#EEF8F7] hover:text-[#0F766E] transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-widest">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E]/40 focus:border-[#0F766E] bg-[var(--color-surface)] text-[var(--color-ink-800)]"
            >
              {CATALOG_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Save as favorite */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <div
              onClick={() => setSaveAsFav((v) => !v)}
              className={clsx(
                "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors",
                saveAsFav
                  ? "bg-[#EEF8F7] border-[#B2DEDA] text-[#0F766E]"
                  : "border-[var(--color-border)] text-[var(--color-ink-500)] hover:border-[#B2DEDA] hover:text-[#0F766E]"
              )}
            >
              <Star size={11} fill={saveAsFav ? "#0F766E" : "none"} />
              Save as favourite
            </div>
          </label>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm font-medium text-[var(--color-ink-500)] hover:bg-[var(--color-surface-sunken)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!query.trim()}
              className="px-5 py-2 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0D6862] transition-colors disabled:opacity-40"
            >
              Add Test
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── New Investigations (order form + today's orders) ─────────────────────

function NewInvestigations({
  visit, udid, todayOrders, onOrdered,
}: {
  visit: any; udid: string; todayOrders: any[]; onOrdered: () => void;
}) {
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState(Object.keys(INV_CATALOG)[0]);
  const [selected, setSelected] = useState<string[]>([]);
  const [priority, setPriority] = useState("ROUTINE");
  const [laterality, setLaterality] = useState("OU");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [showAddModal, setShowAddModal] = useState(false);

  // Custom tests: favorites from localStorage + session additions
  const [customTests, setCustomTests] = useState<{ name: string; category: string }[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(FAVES_KEY) ?? "[]"); }
    catch { return []; }
  });

  const toggleTest = (name: string) =>
    setSelected((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]);

  const handleAddCustom = (name: string, category: string, saveAsFav: boolean) => {
    // If it's already in the catalog just select it and navigate to its tab
    const catalogCat = Object.entries(INV_CATALOG).find(([, items]) => items.some((i) => i.name === name))?.[0];
    if (catalogCat) {
      setActiveCategory(catalogCat);
      setSelected((prev) => prev.includes(name) ? prev : [...prev, name]);
      return;
    }
    // New custom test — add to session list
    setCustomTests((prev) => prev.some((t) => t.name === name) ? prev : [...prev, { name, category }]);
    // Persist if save as favorite
    if (saveAsFav) {
      try {
        const stored: { name: string; category: string }[] = JSON.parse(localStorage.getItem(FAVES_KEY) ?? "[]");
        if (!stored.some((t) => t.name === name)) {
          localStorage.setItem(FAVES_KEY, JSON.stringify([...stored, { name, category }]));
        }
      } catch {}
    }
    // Auto-select and navigate to its category tab
    const targetCat = Object.keys(INV_CATALOG).includes(category) ? category : "Other";
    setActiveCategory(targetCat);
    setSelected((prev) => prev.includes(name) ? prev : [...prev, name]);
  };

  const placeOrders = () => {
    if (selected.length === 0) return;
    startTransition(async () => {
      for (const testName of selected) {
        const catFromCatalog = Object.entries(INV_CATALOG).find(([, items]) => items.some((i) => i.name === testName))?.[0];
        const catFromCustom = customTests.find((t) => t.name === testName)?.category;
        const cat = catFromCatalog ?? catFromCustom ?? "Other";
        await addInvestigationOrder(visit.id, udid, { category: cat, testName, priority, laterality, notes });
      }
      setSelected([]);
      setNotes("");
    });
  };

  // Merge catalog categories + "Other" when custom tests exist there
  const hasOtherCustom = customTests.some((t) => !Object.keys(INV_CATALOG).includes(t.category));
  const categories = [
    ...Object.keys(INV_CATALOG),
    ...(hasOtherCustom ? ["Other"] : []),
  ];

  // Items for the active tab: catalog items + custom tests in same category
  const currentItems: { name: string; price: number; isCustom?: boolean }[] = [
    ...(INV_CATALOG[activeCategory] ?? []),
    ...customTests
      .filter((t) => {
        if (activeCategory === "Other") return !Object.keys(INV_CATALOG).includes(t.category);
        return t.category === activeCategory;
      })
      .map((t) => ({ name: t.name, price: 0, isCustom: true })),
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Order form */}
      <Card className="p-0 overflow-hidden">
        {/* Priority + Laterality + Add Test */}
        <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-4 border-b border-[var(--color-border)]">
          <div className="flex flex-wrap gap-8">
            <div>
              <p className="text-xs font-semibold tracking-widest text-[var(--color-ink-400)] uppercase mb-2">Priority</p>
              <SingleChipSelect options={ORDER_PRIORITIES} value={priority} onChange={setPriority} />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-widest text-[var(--color-ink-400)] uppercase mb-2">Laterality</p>
              <SingleChipSelect options={LATERALITY} value={laterality} onChange={setLaterality} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-[#B2DEDA] bg-[#EEF8F7] text-[#0F766E] hover:bg-[#DCF3F1] transition-colors whitespace-nowrap mt-0.5"
          >
            <Plus size={13} />
            Add Test
          </button>
        </div>

        {/* Category sub-tabs */}
        <div className="flex overflow-x-auto scrollbar-thin border-b border-[var(--color-border)]">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={clsx(
                "px-4 py-2.5 text-sm whitespace-nowrap transition-colors border-b-2",
                activeCategory === cat
                  ? "border-[var(--color-primary-600)] text-[var(--color-primary-700)] font-semibold bg-[var(--color-primary-50)]"
                  : "border-transparent text-[var(--color-ink-500)] font-medium hover:text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Test checkboxes */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {currentItems.map((item) => {
            const checked = selected.includes(item.name);
            return (
              <label
                key={item.name}
                className={clsx(
                  "flex items-center justify-between px-3 py-2.5 rounded-xl border cursor-pointer transition-colors",
                  checked
                    ? "border-[var(--color-primary-400)] bg-[var(--color-primary-50)]"
                    : "border-[var(--color-border)] hover:border-[var(--color-primary-300)] hover:bg-[var(--color-surface-sunken)]"
                )}
              >
                <span className="flex items-center gap-2.5 text-sm text-[var(--color-ink-700)]">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTest(item.name)}
                    className="accent-[var(--color-primary-600)]"
                  />
                  {item.name}
                </span>
                {item.isCustom && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#EEF8F7] text-[#0F766E] border border-[#B2DEDA] ml-2 shrink-0">
                    Custom
                  </span>
                )}
              </label>
            );
          })}
        </div>

        {/* Notes + place order */}
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-[var(--color-border)] pt-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Clinical notes / special instructions..."
            rows={2}
            className="w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-ink-400)]">
              {selected.length} test{selected.length !== 1 ? "s" : ""} selected
            </span>
            <button
              disabled={pending || selected.length === 0}
              onClick={placeOrders}
              className="rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-medium px-5 py-2 hover:bg-[var(--color-primary-700)] disabled:opacity-50"
            >
              {pending ? "Placing…" : `Place Order${selected.length > 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </Card>

      {/* Today's placed orders */}
      {todayOrders.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-[var(--color-success-600)]" />
              <p className="text-sm font-semibold text-[var(--color-ink-800)]">Today&apos;s Orders</p>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)]">
                {todayOrders.length}
              </span>
            </div>
            <span className="text-xs text-[var(--color-ink-400)]">Moves to Previous at end of day</span>
          </div>
          {todayOrders.map((o) => (
            <InvestigationCard key={o.id} order={o} udid={udid} readOnly={false} onView={setViewUrl} />
          ))}
        </div>
      )}

      {/* Result viewer modal */}
      {viewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setViewUrl(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <p className="text-sm font-medium text-[var(--color-ink-700)]">Result Viewer</p>
              <div className="flex items-center gap-2">
                <a href={viewUrl} download target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary-400)] text-[var(--color-ink-600)] transition-colors">
                  <Download size={13} /> Download
                </a>
                <button onClick={() => setViewUrl(null)} className="text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] text-lg font-bold px-2">×</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {viewUrl.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                <img src={viewUrl} alt="Result" className="max-w-full mx-auto rounded-lg" />
              ) : (
                <iframe src={viewUrl} className="w-full h-[75vh] rounded-lg" title="Result" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Test modal */}
      {showAddModal && (
        <AddCustomTestModal onAdd={handleAddCustom} onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}

// ── Helper pills ──────────────────────────────────────────────────────────

function PriorityPill({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    ROUTINE: "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]",
    URGENT:  "bg-[var(--color-accent-100)] text-[var(--color-accent-600)]",
    STAT:    "bg-[var(--color-danger-100)] text-[var(--color-danger-600)]",
  };
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${map[priority] ?? map.ROUTINE}`}>
      {priority}
    </span>
  );
}

function StatusBadge({ status, resultRef }: { status: string; resultRef?: string | null }) {
  if (resultRef) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-success-100)] text-[var(--color-success-600)]">
        <CheckCircle2 size={11} /> Result Uploaded
      </span>
    );
  }
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    ORDERED:          { label: "Ordered",     cls: "bg-[var(--color-info-100)] text-[var(--color-info-600)]",       icon: <Clock size={11} /> },
    IN_PROGRESS:      { label: "In Progress", cls: "bg-[var(--color-accent-100)] text-[var(--color-accent-600)]",   icon: <Clock size={11} /> },
    RESULT_AVAILABLE: { label: "Result Ready",cls: "bg-[var(--color-success-100)] text-[var(--color-success-600)]", icon: <CheckCircle2 size={11} /> },
    REVIEWED:         { label: "Reviewed",    cls: "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]",  icon: <CheckCircle2 size={11} /> },
    CANCELLED:        { label: "Cancelled",   cls: "bg-[var(--color-danger-100)] text-[var(--color-danger-600)]",   icon: <XCircle size={11} /> },
  };
  const s = map[status] ?? map.ORDERED;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
}
