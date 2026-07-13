"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createUser } from "../actions";
import { Card } from "@/components/ui/Card";
import { Check } from "lucide-react";

const INPUT =
  "mt-1 w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]";
const LABEL = "block text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wide";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className={LABEL}>
        {label}
        {required && <span className="text-[var(--color-danger-500)] ml-0.5 normal-case font-normal"> *</span>}
      </label>
      {children}
    </div>
  );
}

export function NewUserForm({
  doctorId,
  hospitals,
  assignableRoles,
  returnTo,
}: {
  doctorId: string;
  hospitals: { id: string; name: string }[];
  assignableRoles: { name: string; label: string }[];
  returnTo: string;
}) {
  const router = useRouter();
  const [userType, setUserType] = useState(assignableRoles[0]?.name ?? "HOSPITAL");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMismatch, setPwMismatch] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => router.push(returnTo), 1200);
      return () => clearTimeout(t);
    }
  }, [success, router, returnTo]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password !== confirmPassword) { setPwMismatch(true); return; }
    setPwMismatch(false);
    setPending(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    fd.set("userType", userType);
    fd.set("active", status === "ACTIVE" ? "true" : "false");
    if (doctorId) fd.set("doctorId", doctorId);

    const res = await createUser(fd);
    setPending(false);
    if (res.error) { setError(res.error); return; }
    setSuccess(true);
  }

  if (success) {
    return (
      <Card lifted>
        <div className="py-16 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
            <Check size={28} className="text-emerald-600" />
          </div>
          <p className="text-sm font-semibold text-[var(--color-ink-800)]">User created successfully!</p>
          <p className="text-xs text-[var(--color-ink-400)]">Redirecting…</p>
        </div>
      </Card>
    );
  }

  return (
    <Card lifted>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <input type="hidden" name="doctorId" value={doctorId} />

        {/* Role */}
        <Field label="Role" required>
          <input
            list="role-options"
            name="userTypeDisplay"
            value={userType}
            onChange={(e) => setUserType(e.target.value.toUpperCase().replace(/\s+/g, "_"))}
            required
            placeholder="e.g. HOSPITAL"
            className={INPUT}
          />
          <datalist id="role-options">
            {assignableRoles.map((r) => (
              <option key={r.name} value={r.name}>{r.label}</option>
            ))}
          </datalist>
        </Field>

        {/* Hospital */}
        <Field label="Hospital" required>
          <select name="hospitalId" required className={INPUT}>
            <option value="">Select hospital…</option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </Field>

        {/* Full Name + Username */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Full Name" required>
              <input name="name" required placeholder="e.g. Priya Sharma" className={INPUT} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Username" required>
              <input
                name="username"
                required
                autoComplete="off"
                placeholder="e.g. priya.sharma"
                className={INPUT}
              />
            </Field>
          </div>
        </div>

        {/* Mobile + Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Mobile Number">
            <input name="mobile" type="tel" maxLength={10} placeholder="10-digit number" className={INPUT} />
          </Field>
          <Field label="Email Address">
            <input name="email" type="email" placeholder="priya@hospital.com" className={INPUT} />
          </Field>
        </div>

        {/* Password + Confirm */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Password" required>
            <input
              name="password"
              type="password"
              required
              placeholder="Min 6 chars"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPwMismatch(false); }}
              className={`${INPUT} ${pwMismatch ? "border-red-400 focus:ring-red-400" : ""}`}
            />
          </Field>
          <Field label="Confirm Password" required>
            <input
              type="password"
              required
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setPwMismatch(false); }}
              className={`${INPUT} ${pwMismatch ? "border-red-400 focus:ring-red-400" : ""}`}
            />
          </Field>
          {pwMismatch && (
            <p className="sm:col-span-2 text-xs text-red-600 -mt-2">Passwords do not match.</p>
          )}
        </div>

        {/* Status */}
        <Field label="Status">
          <div className="mt-2 flex gap-3">
            {(["ACTIVE", "INACTIVE"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`flex items-center gap-2 flex-1 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-all ${
                  status === s
                    ? s === "ACTIVE"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-red-400 bg-red-50 text-red-700"
                    : "border-[var(--color-border)] text-[var(--color-ink-500)] hover:border-[var(--color-primary-300)]"
                }`}
              >
                <span className={`size-2 rounded-full ${s === "ACTIVE" ? "bg-emerald-500" : "bg-red-400"}`} />
                {s === "ACTIVE" ? "Active" : "Inactive"}
              </button>
            ))}
          </div>
        </Field>

        {error && (
          <p className="text-sm text-[var(--color-danger-600)] bg-[var(--color-danger-50)] border border-[var(--color-danger-200)] rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <a
            href={returnTo}
            className="flex-1 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors text-center"
          >
            Cancel
          </a>
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-xl bg-[var(--color-primary-600)] text-white font-semibold py-2.5 px-5 hover:bg-[var(--color-primary-700)] transition-colors disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create User"}
          </button>
        </div>
      </form>
    </Card>
  );
}
