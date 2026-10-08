"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Pencil, X, AlertCircle, Loader2 } from "lucide-react";
import { updatePatientDetails } from "./actions";

const SEX_OPTIONS = ["MALE", "FEMALE", "OTHER"] as const;
const CATEGORY_OPTIONS = ["GENERAL", "BPL", "SUBSIDISED", "ECHS", "INSURANCE"] as const;

type DefaultValues = {
  name: string;
  age: number;
  sex: string;
  mobile: string;
  category: string;
  occupation: string | null;
  notes: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
};

export function EditPatientButton({
  patientId,
  className,
  defaultValues,
}: {
  patientId: string;
  className?: string;
  defaultValues: DefaultValues;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [form, setForm] = useState({
    name: "",
    age: "",
    sex: "MALE",
    mobile: "",
    category: "GENERAL",
    occupation: "",
    notes: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
  });

  function openModal() {
    setForm({
      name: defaultValues.name,
      age: String(defaultValues.age),
      sex: defaultValues.sex,
      mobile: defaultValues.mobile,
      category: defaultValues.category,
      occupation: defaultValues.occupation ?? "",
      notes: defaultValues.notes ?? "",
      address: defaultValues.address ?? "",
      city: defaultValues.city ?? "",
      state: defaultValues.state ?? "",
      pincode: defaultValues.pincode ?? "",
    });
    setError(null);
    setOpen(true);
  }

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));
  }

  function close() {
    if (pending) return;
    setOpen(false);
    setError(null);
  }

  function submit() {
    if (!form.name.trim() || !form.age || !form.mobile.trim()) {
      setError("Name, age, and mobile are required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await updatePatientDetails(patientId, {
          name: form.name.trim(),
          age: parseInt(form.age, 10),
          sex: form.sex,
          mobile: form.mobile.trim(),
          category: form.category,
          occupation: form.occupation.trim() || null,
          notes: form.notes.trim() || null,
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          pincode: form.pincode.trim() || null,
        });
        router.refresh();
        close();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to update patient.");
      }
    });
  }

  const inputCls =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-teal-500 bg-white";
  const labelCls = "block text-xs font-semibold text-gray-600 mb-1";

  const modal = open ? (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget && !pending) close(); }}
    >
      <div className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <h2 className="text-base font-bold text-gray-800">Edit Patient Info</h2>
          <button onClick={close} disabled={pending} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className={labelCls}>Full Name <span className="text-red-500">*</span></label>
            <input value={form.name} onChange={set("name")} className={inputCls} placeholder="Patient full name" />
          </div>

          {/* Age + Sex */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Age <span className="text-red-500">*</span></label>
              <input type="number" min={0} max={150} value={form.age} onChange={set("age")} className={inputCls} placeholder="e.g. 35" />
            </div>
            <div>
              <label className={labelCls}>Sex</label>
              <select value={form.sex} onChange={set("sex")} className={inputCls}>
                {SEX_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mobile */}
          <div>
            <label className={labelCls}>Mobile <span className="text-red-500">*</span></label>
            <input value={form.mobile} onChange={set("mobile")} className={inputCls} placeholder="10-digit mobile number" />
          </div>

          {/* Category */}
          <div>
            <label className={labelCls}>Category</label>
            <select value={form.category} onChange={set("category")} className={inputCls}>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>

          {/* Occupation */}
          <div>
            <label className={labelCls}>Occupation</label>
            <input value={form.occupation} onChange={set("occupation")} className={inputCls} placeholder="Optional" />
          </div>

          {/* Address */}
          <div>
            <label className={labelCls}>Address</label>
            <input value={form.address} onChange={set("address")} className={inputCls} placeholder="Street address" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>City</label>
              <input value={form.city} onChange={set("city")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>State</label>
              <input value={form.state} onChange={set("state")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Pincode</label>
              <input value={form.pincode} onChange={set("pincode")} className={inputCls} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              value={form.notes}
              onChange={set("notes")}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-teal-500 resize-none"
              placeholder="Optional notes"
            />
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle size={12} className="shrink-0" /> {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={close}
            disabled={pending}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="flex-1 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            {pending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button onClick={openModal} title="Edit patient info" className={className}>
        <Pencil size={15} />
      </button>
      {typeof document !== "undefined" && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
