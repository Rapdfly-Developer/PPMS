"use client";

import { useState, useTransition, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { SingleChipSelect } from "@/components/ui/Chip";
import { ORDER_PRIORITIES, LATERALITY } from "@/lib/constants";
import { addInvestigationOrder, updateInvestigationStatus, attachResult } from "./actions";
import { format } from "date-fns";
import { Paperclip, ExternalLink, Upload } from "lucide-react";
import clsx from "clsx";

const STATUS_FLOW = ["ORDERED", "IN_PROGRESS", "RESULT_AVAILABLE", "REVIEWED"];

// Investigation catalog with prices (INR) and category sub-tabs matching reference UI
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

export function InvestigationsTab({ visit, udid, readOnly }: { visit: any; udid: string; readOnly: boolean }) {
  const [activeCategory, setActiveCategory] = useState(Object.keys(INV_CATALOG)[0]);
  const [selected, setSelected] = useState<string[]>([]);
  const [priority, setPriority] = useState("ROUTINE");
  const [laterality, setLaterality] = useState("OU");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const orders: any[] = visit.investigationOrders ?? [];

  const toggleTest = (name: string) => {
    setSelected((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]);
  };

  const placeOrders = () => {
    if (selected.length === 0) return;
    startTransition(async () => {
      for (const testName of selected) {
        const cat = Object.entries(INV_CATALOG).find(([, items]) => items.some((i) => i.name === testName))?.[0] ?? "Imaging";
        await addInvestigationOrder(visit.id, udid, { category: cat, testName, priority, laterality, notes });
      }
      setSelected([]);
      setNotes("");
    });
  };

  const categories = Object.keys(INV_CATALOG);
  const currentItems = INV_CATALOG[activeCategory] ?? [];

  return (
    <div className="flex flex-col gap-5">
      {!readOnly && (
        <Card className="p-0 overflow-hidden">
          {/* Priority row */}
          <div className="px-4 pt-4 pb-3 flex flex-wrap items-center gap-4 border-b border-[var(--color-border)]">
            <div>
              <p className="text-xs font-semibold tracking-widest text-[var(--color-ink-500)] uppercase mb-1.5">Priority</p>
              <SingleChipSelect options={ORDER_PRIORITIES} value={priority} onChange={setPriority} />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-widest text-[var(--color-ink-500)] uppercase mb-1.5">Laterality</p>
              <SingleChipSelect options={LATERALITY} value={laterality} onChange={setLaterality} />
            </div>
          </div>

          {/* Category sub-tabs */}
          <div className="flex overflow-x-auto scrollbar-thin border-b border-[var(--color-border)]">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={clsx(
                  "px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2",
                  activeCategory === cat
                    ? "border-[var(--color-primary-600)] text-[var(--color-primary-700)]"
                    : "border-transparent text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)]"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Test checkboxes with prices */}
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
                  <span className="text-xs font-medium text-[var(--color-ink-400)] shrink-0 ml-2">
                    ₹{item.price.toLocaleString("en-IN")}
                  </span>
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
                {selected.length > 0 && (
                  <span className="ml-2">
                    · Est. ₹{
                      Object.values(INV_CATALOG).flat()
                        .filter((i) => selected.includes(i.name))
                        .reduce((sum, i) => sum + i.price, 0)
                        .toLocaleString("en-IN")
                    }
                  </span>
                )}
              </span>
              <button
                disabled={pending || selected.length === 0}
                onClick={placeOrders}
                className="rounded-xl bg-[var(--color-primary-600)] text-white text-sm font-medium px-5 py-2 hover:bg-[var(--color-primary-700)] disabled:opacity-50"
              >
                Place Order{selected.length > 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Order history */}
      <Card>
        <p className="text-xs font-semibold tracking-widest text-[var(--color-ink-500)] uppercase mb-3">Order History</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--color-ink-400)] uppercase border-b border-[var(--color-border)]">
              <th className="py-1.5 pr-3">Test</th>
              <th className="pr-3">Priority</th>
              <th className="pr-3">Lat.</th>
              <th className="pr-3">Status</th>
              <th className="pr-3">Result</th>
              <th>Ordered</th>
              {!readOnly && <th></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="py-2 pr-3 font-medium text-[var(--color-ink-900)]">{o.testName}</td>
                <td className="pr-3"><PriorityPill priority={o.priority} /></td>
                <td className="pr-3 text-[var(--color-ink-500)] text-xs">{o.laterality ?? "—"}</td>
                <td className="pr-3"><StatusPill status={o.status} /></td>
                <td className="pr-3"><ResultCell order={o} udid={udid} readOnly={readOnly} /></td>
                <td className="text-[var(--color-ink-400)] text-xs">{format(new Date(o.createdAt), "dd MMM, h:mm a")}</td>
                {!readOnly && (
                  <td>
                    {o.status !== "REVIEWED" && (
                      <button
                        onClick={() => updateInvestigationStatus(o.id, udid, STATUS_FLOW[STATUS_FLOW.indexOf(o.status) + 1])}
                        className="text-xs font-medium text-[var(--color-primary-600)] hover:underline"
                      >
                        Advance →
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-[var(--color-ink-400)]">No investigations ordered for this visit.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ResultCell({ order, udid, readOnly }: { order: any; udid: string; readOnly: boolean }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

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
        const result = await attachResult(order.id, udid, json.url);
        if (result?.error) setError(result.error);
      });
    } catch (err: any) {
      setError(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (order.resultRef) {
    return (
      <a href={order.resultRef} target="_blank" rel="noreferrer"
        className="flex items-center gap-1 text-xs text-[var(--color-primary-600)] hover:underline">
        <ExternalLink size={11} /> View
      </a>
    );
  }

  if (readOnly || order.status === "REVIEWED") return null;

  return (
    <div className="flex flex-col gap-0.5">
      <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden" onChange={handleFile} />
      <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1 text-xs text-[var(--color-ink-400)] hover:text-[var(--color-primary-600)] disabled:opacity-50 transition-colors">
        {uploading ? <Upload size={11} className="animate-pulse" /> : <Paperclip size={11} />}
        {uploading ? "Uploading…" : "Attach"}
      </button>
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}

function PriorityPill({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    ROUTINE: "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]",
    URGENT: "bg-[var(--color-accent-100)] text-[var(--color-accent-600)]",
    STAT: "bg-[var(--color-danger-100)] text-[var(--color-danger-600)]",
  };
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${map[priority]}`}>{priority}</span>;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    ORDERED: "bg-[var(--color-info-100)] text-[var(--color-info-600)]",
    IN_PROGRESS: "bg-[var(--color-accent-100)] text-[var(--color-accent-600)]",
    RESULT_AVAILABLE: "bg-[var(--color-success-100)] text-[var(--color-success-600)]",
    REVIEWED: "bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]",
  };
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${map[status]}`}>{status.replace(/_/g, " ")}</span>;
}
