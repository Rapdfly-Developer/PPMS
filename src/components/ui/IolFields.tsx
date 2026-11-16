"use client";

// Manufacturer, Model and A-constant for an IOL, shared by the Counselling sheet
// and the IPD Implant form. Manufacturer and Model are type-ahead lists with
// "+ Save as a keyword" for your own; the models listed are the chosen
// manufacturer's, and picking a model fills its A-constant.

import { useMemo, useState } from "react";
import { useSuggest } from "./Suggest";
import { TypeSelect } from "./TypeSelect";
import {
  addCustomManufacturer, allManufacturers, findModel, isCustomModel, modelsOf, rememberModel,
} from "@/lib/iol-catalog";

export interface IolValue { manufacturer: string; model: string; aConstant: string }

/* ── IOL power: +/- switch and dioptre list, like the refraction readings ── */
const IOL_POWER_MAGS = ["", ...Array.from({ length: 81 }, (_, i) => (i * 0.5).toFixed(2))];

function parseSigned(v: string): { sign: "+" | "-"; mag: string } {
  if (!v || v === "+") return { sign: "+", mag: "" };
  if (v === "-") return { sign: "-", mag: "" };
  return v.startsWith("-") ? { sign: "-", mag: v.slice(1) } : { sign: "+", mag: v.replace(/^\+/, "") };
}

export function IolPowerInput({ value, onChange, disabled, className }: {
  value: string; onChange: (v: string) => void; disabled?: boolean; className: string;
}) {
  const { sign, mag } = parseSigned(value);
  return (
    <div className="flex flex-1 min-w-0 items-center gap-1.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { const ns = sign === "+" ? "-" : "+"; onChange(mag ? `${ns}${mag}` : ns); }}
        title="Switch + / -"
        className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-sm font-bold border transition-colors disabled:opacity-40"
        style={sign === "-"
          ? { background: "var(--color-primary-600)", color: "#fff", borderColor: "var(--color-primary-600)" }
          : { background: "#fff", color: "var(--color-ink-600)", borderColor: "var(--color-border)" }}
      >
        {sign}
      </button>
      <div className="flex-1 min-w-0">
        <TypeSelect
          disabled={disabled}
          value={mag}
          options={IOL_POWER_MAGS}
          onChange={(m) => onChange(m ? `${sign}${m}` : "")}
          onSign={(ns) => { if (ns !== sign) onChange(mag ? `${ns}${mag}` : ns); }}
          className={className}
        />
      </div>
    </div>
  );
}

function Combo({ value, onChange, options, ns, onAdd, disabled, placeholder, className }: {
  value: string; onChange: (v: string) => void; options: string[]; ns: string; onAdd: (v: string) => void;
  disabled?: boolean; placeholder?: string; className: string;
}) {
  const { inputProps, menu } = useSuggest({ term: value, options, ns, onPick: onChange, onAddNew: onAdd, openOnFocus: true });
  return (
    <div className="relative flex-1 min-w-0">
      <input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder={disabled ? "-" : placeholder} className={className} {...inputProps} />
      {!disabled && menu}
    </div>
  );
}

/**
 * Render each field through `row(label, control)`, so every page keeps its own
 * label layout. `inputClass` is the page's input style.
 */
export function IolFields({ value, onChange, disabled, inputClass, row }: {
  value: IolValue;
  onChange: (patch: Partial<IolValue>) => void;
  disabled?: boolean;
  inputClass: string;
  row: (key: keyof IolValue, label: string, control: React.ReactNode) => React.ReactNode;
}) {
  // Bumped after a custom entry is saved, so the lists re-read it
  const [rev, setRev] = useState(0);
  const makers = useMemo(() => allManufacturers(), [rev]); // eslint-disable-line react-hooks/exhaustive-deps
  const models = useMemo(() => modelsOf(value.manufacturer), [value.manufacturer, rev]); // eslint-disable-line react-hooks/exhaustive-deps

  const setManufacturer = (m: string) => {
    // A model of another manufacturer no longer applies
    const keep = value.model && findModel(m, value.model);
    onChange(keep ? { manufacturer: m } : { manufacturer: m, model: "", aConstant: value.model ? "" : value.aConstant });
  };
  const setModel = (model: string) => {
    const hit = findModel(value.manufacturer, model);
    onChange(hit
      ? { model: hit.model, manufacturer: value.manufacturer || hit.manufacturer, aConstant: hit.aConstant }
      : { model });
  };
  const setAConstant = (a: string) => {
    onChange({ aConstant: a });
    // A custom model remembers its A-constant for next time
    if (value.manufacturer && value.model && isCustomModel(value.manufacturer, value.model)) rememberModel(value.manufacturer, value.model, a);
  };

  return (
    <>
      {row("manufacturer", "Manufacturer",
        <Combo value={value.manufacturer} onChange={setManufacturer} options={makers} ns="iol_manufacturer" disabled={disabled}
          placeholder="e.g. Alcon" className={inputClass}
          onAdd={(m) => { addCustomManufacturer(m); setRev((r) => r + 1); setManufacturer(m); }} />)}
      {row("model", "Model",
        <Combo value={value.model} onChange={setModel} options={models.map((m) => m.model)} ns="iol_model" disabled={disabled}
          placeholder={value.manufacturer ? `${value.manufacturer} models` : "e.g. AcrySof IQ SN60WF"} className={inputClass}
          onAdd={(model) => {
            rememberModel(value.manufacturer || "Other", model, value.aConstant);
            if (!value.manufacturer) addCustomManufacturer("Other");
            setRev((r) => r + 1);
            onChange({ model, manufacturer: value.manufacturer || "Other" });
          }} />)}
      {row("aConstant", "A-constant",
        <input value={value.aConstant} disabled={disabled} onChange={(e) => setAConstant(e.target.value)} inputMode="decimal"
          placeholder={disabled ? "-" : "Fills from the model"} className={inputClass} />)}
    </>
  );
}
