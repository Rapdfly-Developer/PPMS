"use client";

import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Phone,
} from "lucide-react";

type Fields = {
  fullName: string;
  email: string;
  phone: string;
  clinicName: string;
  specialization: string;
  city: string;
  preferredDate: string;
  preferredTime: string;
  message: string;
};

type Errors = Partial<Record<keyof Fields, string>>;

const TIMES = [
  "9:00 AM – 10:00 AM",
  "10:00 AM – 11:00 AM",
  "11:00 AM – 12:00 PM",
  "2:00 PM – 3:00 PM",
  "3:00 PM – 4:00 PM",
  "4:00 PM – 5:00 PM",
];

const SPECS = [
  "Ophthalmology", "General Medicine", "Orthopaedics", "Cardiology",
  "ENT", "Dermatology", "Neurology", "Paediatrics", "Gynaecology",
  "Oncology", "Urology", "Psychiatry", "Other",
];

function validate(f: Fields): Errors {
  const e: Errors = {};
  if (!f.fullName.trim())  e.fullName = "Full name is required.";
  if (!f.email.trim())     e.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = "Enter a valid email.";
  if (!f.phone.trim())     e.phone = "Phone number is required.";
  else if (!/^[0-9+\-\s()]{7,15}$/.test(f.phone)) e.phone = "Enter a valid phone number.";
  return e;
}

function Field({
  label, required = false, error, children,
}: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[12.5px] font-semibold text-slate-600 tracking-[0.01em]">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[11.5px] text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

const INPUT_CLS =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[14px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all duration-200";

export function DemoForm() {
  const [fields, setFields] = useState<Fields>({
    fullName: "", email: "", phone: "", clinicName: "",
    specialization: "", city: "", preferredDate: "", preferredTime: "", message: "",
  });
  const [errors, setErrors]   = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof Fields, boolean>>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [serverErr, setServerErr] = useState("");

  function set(k: keyof Fields, v: string) {
    setFields(f => ({ ...f, [k]: v }));
    if (touched[k]) setErrors(e => ({ ...e, [k]: validate({ ...fields, [k]: v })[k] }));
  }

  function blur(k: keyof Fields) {
    setTouched(t => ({ ...t, [k]: true }));
    setErrors(e => ({ ...e, [k]: validate(fields)[k] }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const all = validate(fields);
    setErrors(all);
    setTouched({ fullName: true, email: true, phone: true });
    if (Object.keys(all).length) return;

    setLoading(true);
    setServerErr("");
    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (data.success) { setDone(true); }
      else setServerErr(data.error ?? "Something went wrong. Please try again.");
    } catch {
      setServerErr("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-8 py-14 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 ring-8 ring-emerald-50">
          <CheckCircle2 size={32} className="text-emerald-600" strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="font-display text-[20px] font-bold text-emerald-950">
            Thank you for your interest in PPMS!
          </h3>
          <p className="mt-3 text-[14.5px] leading-relaxed text-slate-600">
            Your free demo request has been received. Our team will contact you
            shortly to confirm the demo and discuss your requirements.
          </p>
        </div>
        <a
          href="mailto:support@ppmsai.com"
          className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-300 px-6 py-2.5 text-[13.5px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
        >
          <Mail size={14} strokeWidth={1.5} />
          support@ppmsai.com
        </a>
        <button
          onClick={() => { setDone(false); setFields({ fullName: "", email: "", phone: "", clinicName: "", specialization: "", city: "", preferredDate: "", preferredTime: "", message: "" }); setTouched({}); }}
          className="text-[13px] text-slate-400 underline-offset-3 hover:underline"
        >
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {/* Row 1 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full Name" required error={touched.fullName ? errors.fullName : undefined}>
          <input
            className={INPUT_CLS}
            placeholder="Dr. Arjun Sharma"
            value={fields.fullName}
            onChange={e => set("fullName", e.target.value)}
            onBlur={() => blur("fullName")}
          />
        </Field>
        <Field label="Email Address" required error={touched.email ? errors.email : undefined}>
          <input
            className={INPUT_CLS}
            type="email"
            placeholder="dr.arjun@hospital.com"
            value={fields.email}
            onChange={e => set("email", e.target.value)}
            onBlur={() => blur("email")}
          />
        </Field>
      </div>

      {/* Row 2 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone Number" required error={touched.phone ? errors.phone : undefined}>
          <input
            className={INPUT_CLS}
            type="tel"
            placeholder="+91 98765 43210"
            value={fields.phone}
            onChange={e => set("phone", e.target.value)}
            onBlur={() => blur("phone")}
          />
        </Field>
        <Field label="Hospital / Clinic Name">
          <input
            className={INPUT_CLS}
            placeholder="Apollo Hospital, Chennai"
            value={fields.clinicName}
            onChange={e => set("clinicName", e.target.value)}
          />
        </Field>
      </div>

      {/* Row 3 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Specialization">
          <select
            className={INPUT_CLS}
            value={fields.specialization}
            onChange={e => set("specialization", e.target.value)}
          >
            <option value="">Select specialization</option>
            {SPECS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="City / Location">
          <input
            className={INPUT_CLS}
            placeholder="Chennai"
            value={fields.city}
            onChange={e => set("city", e.target.value)}
          />
        </Field>
      </div>

      {/* Row 4 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Preferred Demo Date">
          <div className="relative">
            <CalendarDays size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={`${INPUT_CLS} pl-9`}
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={fields.preferredDate}
              onChange={e => set("preferredDate", e.target.value)}
            />
          </div>
        </Field>
        <Field label="Preferred Demo Time">
          <div className="relative">
            <Clock size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              className={`${INPUT_CLS} pl-9`}
              value={fields.preferredTime}
              onChange={e => set("preferredTime", e.target.value)}
            >
              <option value="">Select time slot</option>
              {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </Field>
      </div>

      {/* Message */}
      <Field label="Message / Requirements">
        <textarea
          className={`${INPUT_CLS} resize-none`}
          rows={3}
          placeholder="Tell us about your practice, what you're looking for, or any questions…"
          value={fields.message}
          onChange={e => set("message", e.target.value)}
        />
      </Field>

      {serverErr && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
          {serverErr}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="group mt-1 flex w-full items-center justify-center gap-2.5 rounded-xl bg-emerald-950 py-4 text-[15px] font-semibold text-white shadow-[0_12px_30px_-10px_rgba(6,60,45,0.5)] transition-all duration-300 hover:shadow-[0_16px_40px_-10px_rgba(6,60,45,0.6)] hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
      >
        {loading
          ? <><Loader2 size={16} className="animate-spin" /> Sending request…</>
          : <><span>Request Free Demo</span><ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" /></>}
      </button>

      {/* Alternative CTA */}
      <div className="flex flex-col items-center gap-2 border-t border-slate-100 pt-4 text-center">
        <p className="text-[12.5px] text-slate-500">Prefer to talk to us directly?</p>
        <a
          href="tel:+919629051083"
          className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-emerald-700 underline-offset-3 hover:underline"
        >
          <Phone size={13} strokeWidth={1.5} />
          Talk to Our Team · +91 96290 51083
        </a>
      </div>
    </form>
  );
}
