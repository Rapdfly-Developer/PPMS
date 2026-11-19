"use client";

// Auto-fill for the implant details (Counselling sheet and IPD Implant form).
// Hand `onFile` to the implant document upload; when a sticker, invoice or tissue
// label is uploaded it is read, checked, and the fields are filled. Render
// `banner` near the fields: it says what to double check and offers Undo.

import { useRef, useState } from "react";
import { extractImplant } from "@/lib/extract/client";
import type { ImplantExtraction, ImplantKey } from "@/lib/extract/implant";
import { allModels } from "@/lib/iol-catalog";
import { implantFieldsFor } from "@/lib/counselling-sheets";

type Patch = Partial<Record<ImplantKey, string>>;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Snap an IOL read to the catalogue, so the model name is spelled the way the lists spell it. */
function snapToCatalogue(values: Patch, notes: string[], verify: ImplantKey[]): Patch {
  const out: Patch = { ...values };
  if (!values.model) return out;
  const m = norm(values.model);
  const all = allModels();
  const exact = all.filter((x) => norm(x.model) === m);
  const loose = exact.length ? exact : all.filter((x) => m.length >= 5 && (norm(x.model).includes(m) || m.includes(norm(x.model))));
  const hit = loose.length === 1 ? loose[0] : undefined;
  if (!hit) return out;
  out.model = hit.model;
  out.manufacturer = hit.manufacturer;
  if (!values.aConstant) out.aConstant = hit.aConstant;
  else if (Math.abs(parseFloat(values.aConstant) - parseFloat(hit.aConstant)) > 0.05) {
    notes.push(`The A-constant on the label (${values.aConstant}) differs from the catalogue value (${hit.aConstant}). The label value was used.`);
    if (!verify.includes("aConstant")) verify.push("aConstant");
  }
  return out;
}

export function useImplantAutoFill(opts: {
  group: string;
  /** The values now in the form, for Undo. */
  current: Partial<Record<ImplantKey, string>>;
  /** Merge these into the form. */
  apply: (patch: Patch) => void;
}) {
  const live = useRef(opts);
  live.current = opts; // always the latest render, since the read finishes later
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [filled, setFilled] = useState<{ r: ImplantExtraction; notes: string[]; verify: ImplantKey[]; before: Patch } | null>(null);

  const onFile = async (file: File) => {
    if (live.current.group === "NONE") return;
    setReading(true);
    setError("");
    setFilled(null);
    const { result, error: err } = await extractImplant(file, live.current.group);
    setReading(false);
    if (err || !result) { setError(err ?? "Auto-fill failed."); return; }
    const notes = [...result.notes];
    const verify = [...result.verify];
    const values = live.current.group === "IOL" ? snapToCatalogue(result.values, notes, verify) : result.values;
    const before: Patch = {};
    for (const k of Object.keys(values) as ImplantKey[]) before[k] = live.current.current[k] ?? "";
    live.current.apply(values);
    setFilled({ r: result, notes, verify, before });
  };

  const label = (k: ImplantKey) =>
    ({ manufacturer: "Manufacturer", model: "Model", power: "IOL power", aConstant: "A-constant", lot: "Lot", serial: "Serial", expiry: "Expiry" } as Record<string, string>)[k]
    ?? implantFieldsFor(live.current.group).find((f) => f.key === k)?.label ?? k;

  const banner = (reading || error || filled) ? (
    <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="status">
      {reading && <p className="font-medium">Reading the document…</p>}
      {error && <p className="text-red-700">{error}</p>}
      {filled && (
        <>
          <p className="font-medium">Filled from the document. Please check each value against it.</p>
          {filled.verify.length > 0 && <p className="mt-0.5">Double check: {filled.verify.map(label).join(", ")}.</p>}
          {filled.notes.map((n) => <p key={n} className="mt-0.5">{n}</p>)}
          <div className="mt-1 flex gap-3">
            <button type="button" className="font-semibold underline" onClick={() => { live.current.apply(filled.before); setFilled(null); }}>Undo</button>
            <button type="button" className="font-semibold underline" onClick={() => setFilled(null)}>OK</button>
          </div>
        </>
      )}
      {error && <button type="button" className="mt-1 font-semibold underline" onClick={() => setError("")}>OK</button>}
    </div>
  ) : null;

  return { onFile, banner, reading };
}
