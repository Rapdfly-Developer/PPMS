"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createUser, validateUserFields } from "../actions";
import { saveRolePermissions, createRole } from "@/app/(app)/settings/roles/actions";
import { PERMISSION_GROUPS } from "@/app/(app)/settings/roles/permission-groups";
import { Check, AlertTriangle, RefreshCw } from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = [
  { n: 1 as const, label: "User Details" },
  { n: 2 as const, label: "Hospital & Role" },
  { n: 3 as const, label: "Permissions" },
];

const SYSTEM_ROLES = new Set(["DOCTOR", "HOSPITAL"]);

const DEFAULT_PERMS: Record<string, string[]> = {
  HOSPITAL: [
    "dashboard.view",
    "appointments.view", "appointments.create", "appointments.edit", "appointments.cancel",
    "patients.view", "patients.create", "patients.edit",
    "emr.view", "refraction.view",
    "investigations.view", "investigations.create", "investigations.edit",
    "billing.view", "billing.create", "billing.edit", "billing.print",
    "reports.view", "reports.export",
    "settings.view", "settings.manage",
  ],
  RECEPTIONIST: [
    "dashboard.view",
    "appointments.view", "appointments.create", "appointments.edit",
    "patients.view", "patients.create",
  ],
};

const F = "w-full rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] bg-white placeholder:text-[var(--color-ink-400)]";
const LBL = "block text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wide mb-1";

// ── Component ─────────────────────────────────────────────────────────────────

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

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [done, setDone] = useState(false);
  const [creating, setCreating] = useState(false);
  const [validatingStep1, setValidatingStep1] = useState(false);
  const [createError, setCreateError] = useState("");
  // Server-side field errors keyed by field name
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});

  // Step 1 — User details
  const [name, setName]               = useState("");
  const [username, setUsername]       = useState("");
  const [mobile, setMobile]           = useState("");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [confirmPw, setConfirmPw]     = useState("");
  const [status, setStatus]           = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [touched1, setTouched1]       = useState<Record<string, boolean>>({});

  // Step 2 — Hospital & Role
  const [hospitalId, setHospitalId]   = useState("");
  const [role, setRole]               = useState(assignableRoles[0]?.name ?? "HOSPITAL");
  const [touched2, setTouched2]       = useState<Record<string, boolean>>({});

  // Step 3 — Permissions
  const [permsMap, setPermsMap] = useState<Record<string, string[]>>({});
  const getRolePerms = (r: string) => permsMap[r] ?? DEFAULT_PERMS[r] ?? [];
  const togglePerm = (r: string, key: string) => {
    const cur = getRolePerms(r);
    setPermsMap((p) => ({ ...p, [r]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] }));
  };
  const toggleGroupAll = (r: string, keys: string[]) => {
    const cur = getRolePerms(r);
    const allOn = keys.every((k) => cur.includes(k));
    setPermsMap((p) => ({ ...p, [r]: allOn ? cur.filter((k) => !keys.includes(k)) : [...new Set([...cur, ...keys])] }));
  };

  const existingRoleNames = useMemo(() => new Set(assignableRoles.map((r) => r.name)), [assignableRoles]);

  // ── Validation ──────────────────────────────────────────────────────────────

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const step1Errors: Record<string, string | undefined> = {
    name:      !name.trim() ? "Name is required." : undefined,
    username:  !username.trim() ? "Username is required." : !/^[a-z0-9._-]{3,}$/.test(username.trim()) ? "Lowercase letters only (a–z, 0–9, . _ -). No uppercase or spaces." : serverFieldErrors.username,
    mobile:    mobile.trim() && !/^\d{10}$/.test(mobile.trim()) ? "Must be exactly 10 digits." : serverFieldErrors.mobile,
    email:     email.trim() && !emailRe.test(email.trim()) ? "Enter a valid email." : serverFieldErrors.email,
    password:  password.length < 6 ? "Min 6 characters." : undefined,
    confirmPw: password !== confirmPw ? "Passwords do not match." : undefined,
  };
  const step1Valid = Object.values(step1Errors).every((e) => !e);

  const step2Errors: Record<string, string | undefined> = {
    hospitalId: !hospitalId ? "Please select a hospital." : serverFieldErrors.hospitalId,
    role:       !role.trim() ? "Role is required." : undefined,
  };
  const step2Valid = Object.values(step2Errors).every((e) => !e);

  // ── Step 1 → Step 2 with server-side uniqueness check ───────────────────────

  async function handleNextFromStep1() {
    const allTouched = { name: true, username: true, mobile: true, email: true, password: true, confirmPw: true };
    setTouched1(allTouched);

    // Local validation first (format checks)
    const localErrors = {
      name:      !name.trim(),
      username:  !username.trim() || !/^[a-z0-9._-]{3,}$/.test(username.trim()),
      mobile:    !!(mobile.trim() && !/^\d{10}$/.test(mobile.trim())),
      email:     !!(email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())),
      password:  password.length < 6,
      confirmPw: password !== confirmPw,
    };
    if (Object.values(localErrors).some(Boolean)) return;

    // Server-side uniqueness check before advancing
    setValidatingStep1(true);
    const { errors } = await validateUserFields({
      username: username.trim().toLowerCase(),
      email:    email.trim() || undefined,
      mobile:   mobile.trim() || undefined,
    });
    setValidatingStep1(false);

    if (Object.keys(errors).length > 0) {
      setServerFieldErrors(errors);
      return;
    }

    setServerFieldErrors({});
    setStep(2);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleCreate() {
    setCreating(true);
    setCreateError("");

    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("username", username.trim().toLowerCase());
    fd.set("password", password);
    fd.set("mobile", mobile.trim());
    fd.set("email", email.trim());
    fd.set("userType", role.trim().toUpperCase());
    fd.set("hospitalId", hospitalId);
    fd.set("active", status === "ACTIVE" ? "true" : "false");
    if (doctorId) fd.set("doctorId", doctorId);

    const res = await createUser(fd);
    if (res.error) {
      setCreating(false);
      const msg = res.error;
      // Route the error back to the step that owns the field
      if (/mobile/i.test(msg)) {
        setServerFieldErrors({ mobile: msg });
        setTouched1((t) => ({ ...t, mobile: true }));
        setStep(1);
      } else if (/email/i.test(msg)) {
        setServerFieldErrors({ email: msg });
        setTouched1((t) => ({ ...t, email: true }));
        setStep(1);
      } else if (/username/i.test(msg)) {
        setServerFieldErrors({ username: msg });
        setTouched1((t) => ({ ...t, username: true }));
        setStep(1);
      } else if (/hospital/i.test(msg)) {
        setServerFieldErrors({ hospitalId: msg });
        setTouched2((t) => ({ ...t, hospitalId: true }));
        setStep(2);
      } else {
        setCreateError(msg);
      }
      return;
    }

    // Create custom role in DB if new
    const normalizedRole = role.trim().toUpperCase();
    if (!SYSTEM_ROLES.has(normalizedRole) && !existingRoleNames.has(normalizedRole)) {
      const label = normalizedRole.charAt(0) + normalizedRole.slice(1).toLowerCase().replace(/_/g, " ");
      await createRole({ name: normalizedRole, label, color: "#6366f1" });
    }

    await saveRolePermissions(normalizedRole, getRolePerms(normalizedRole));

    setCreating(false);
    setDone(true);
  }

  // ── Success screen ──────────────────────────────────────────────────────────

  if (done) {
    const hospitalName = hospitals.find((h) => h.id === hospitalId)?.name ?? "";
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-white p-12 flex flex-col items-center gap-3 text-center shadow-sm">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <Check size={32} className="text-emerald-600" />
        </div>
        <p className="text-base font-semibold text-[var(--color-ink-900)]">User created successfully!</p>
        <p className="text-sm text-[var(--color-ink-500)]">
          <span className="font-medium">@{username}</span> has been added
          {hospitalName ? ` to ${hospitalName}` : ""} with the <span className="font-medium">{role}</span> role.
        </p>
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => { setDone(false); setStep(1); setName(""); setUsername(""); setMobile(""); setEmail(""); setPassword(""); setConfirmPw(""); setHospitalId(""); setRole(assignableRoles[0]?.name ?? "HOSPITAL"); setPermsMap({}); setCreateError(""); }}
            className="rounded-xl border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
          >
            Add Another User
          </button>
          <button
            onClick={() => router.push(returnTo)}
            className="rounded-xl bg-[var(--color-primary-600)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // ── Stepper ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Stepper */}
      <div className="flex items-center mb-6">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === s.n ? "bg-[var(--color-primary-600)] text-white shadow-sm"
                : step > s.n ? "bg-emerald-500 text-white"
                : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-400)] border border-[var(--color-border)]"
              }`}>
                {step > s.n ? <Check size={13} /> : s.n}
              </div>
              <span className={`text-[10px] font-semibold mt-1 whitespace-nowrap ${
                step === s.n ? "text-[var(--color-primary-700)]"
                : step > s.n ? "text-emerald-600"
                : "text-[var(--color-ink-400)]"
              }`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-2 mb-3 transition-colors ${step > s.n ? "bg-emerald-400" : "bg-[var(--color-border)]"}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: User Details ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-[var(--color-ink-900)] mb-4">User Details</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="sm:col-span-2">
                <label className={LBL}>Full Name *</label>
                <input
                  value={name} onChange={(e) => setName(e.target.value)}
                  onBlur={() => setTouched1((t) => ({ ...t, name: true }))}
                  placeholder="e.g. Priya Sharma"
                  className={`${F} ${touched1.name && step1Errors.name ? "border-red-400 focus:ring-red-400" : ""}`}
                />
                {touched1.name && step1Errors.name && <p className="text-xs text-red-600 mt-1">{step1Errors.name}</p>}
              </div>

              {/* Username */}
              <div className="sm:col-span-2">
                <label className={LBL}>Username *</label>
                <input
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setServerFieldErrors((s) => ({ ...s, username: "" })); }}
                  onBlur={() => setTouched1((t) => ({ ...t, username: true }))}
                  placeholder="e.g. priya.sharma"
                  autoComplete="off"
                  className={`${F} ${touched1.username && step1Errors.username ? "border-red-400 focus:ring-red-400" : ""}`}
                />
                {touched1.username && step1Errors.username && <p className="text-xs text-red-600 mt-1">{step1Errors.username}</p>}
              </div>

              {/* Mobile */}
              <div>
                <label className={LBL}>Mobile Number</label>
                <input
                  value={mobile}
                  onChange={(e) => { setMobile(e.target.value); setServerFieldErrors((s) => ({ ...s, mobile: "" })); }}
                  onBlur={() => setTouched1((t) => ({ ...t, mobile: true }))}
                  placeholder="10-digit number" maxLength={10}
                  className={`${F} ${touched1.mobile && step1Errors.mobile ? "border-red-400 focus:ring-red-400" : ""}`}
                />
                {touched1.mobile && step1Errors.mobile && <p className="text-xs text-red-600 mt-1">{step1Errors.mobile}</p>}
              </div>

              {/* Email */}
              <div>
                <label className={LBL}>Email Address</label>
                <input
                  type="email" value={email}
                  onChange={(e) => { setEmail(e.target.value); setServerFieldErrors((s) => ({ ...s, email: "" })); }}
                  onBlur={() => setTouched1((t) => ({ ...t, email: true }))}
                  placeholder="priya@hospital.com"
                  className={`${F} ${touched1.email && step1Errors.email ? "border-red-400 focus:ring-red-400" : ""}`}
                />
                {touched1.email && step1Errors.email && <p className="text-xs text-red-600 mt-1">{step1Errors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <label className={LBL}>Password * <span className="normal-case font-normal text-[var(--color-ink-400)]">(min 6 chars)</span></label>
                <input
                  type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setTouched1((t) => ({ ...t, password: true }))}
                  placeholder="••••••••" autoComplete="new-password"
                  className={`${F} ${touched1.password && step1Errors.password ? "border-red-400 focus:ring-red-400" : ""}`}
                />
                {touched1.password && step1Errors.password && <p className="text-xs text-red-600 mt-1">{step1Errors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div>
                <label className={LBL}>Confirm Password *</label>
                <input
                  type="password" value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  onBlur={() => setTouched1((t) => ({ ...t, confirmPw: true }))}
                  placeholder="Re-enter password"
                  className={`${F} ${touched1.confirmPw && step1Errors.confirmPw ? "border-red-400 focus:ring-red-400" : ""}`}
                />
                {touched1.confirmPw && step1Errors.confirmPw && <p className="text-xs text-red-600 mt-1">{step1Errors.confirmPw}</p>}
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-[var(--color-ink-900)] mb-3">Account Status</p>
            <div className="flex gap-3">
              {(["ACTIVE", "INACTIVE"] as const).map((s) => (
                <button
                  key={s} type="button" onClick={() => setStatus(s)}
                  className={`flex items-center gap-2 flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                    status === s
                      ? s === "ACTIVE" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-red-400 bg-red-50 text-red-700"
                      : "border-[var(--color-border)] text-[var(--color-ink-500)] hover:border-[var(--color-primary-300)]"
                  }`}
                >
                  <span className={`size-2 rounded-full ${s === "ACTIVE" ? "bg-emerald-500" : "bg-red-400"}`} />
                  {s === "ACTIVE" ? "Active" : "Inactive"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleNextFromStep1}
              disabled={validatingStep1}
              className="flex items-center gap-2 rounded-xl bg-[var(--color-primary-600)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-60 transition-colors"
            >
              {validatingStep1
                ? <><RefreshCw size={14} className="animate-spin" /> Checking…</>
                : "Next: Hospital & Role →"}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Hospital & Role ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-[var(--color-ink-900)] mb-1">Hospital & Role</p>
            <p className="text-xs text-[var(--color-ink-400)] mb-5">Choose which hospital this user belongs to and what role they will have.</p>

            <div className="space-y-4">
              {/* Hospital */}
              <div>
                <label className={LBL}>Hospital *</label>
                <select
                  value={hospitalId}
                  onChange={(e) => setHospitalId(e.target.value)}
                  onBlur={() => setTouched2((t) => ({ ...t, hospitalId: true }))}
                  className={`${F} ${touched2.hospitalId && step2Errors.hospitalId ? "border-red-400 focus:ring-red-400" : ""}`}
                >
                  <option value="">Select hospital…</option>
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
                {touched2.hospitalId && step2Errors.hospitalId && <p className="text-xs text-red-600 mt-1">{step2Errors.hospitalId}</p>}
              </div>

              {/* Role */}
              <div>
                <label className={LBL}>Role *</label>
                <input
                  list="new-user-role-list"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  onBlur={() => setTouched2((t) => ({ ...t, role: true }))}
                  placeholder="e.g. HOSPITAL"
                  className={`${F} ${touched2.role && step2Errors.role ? "border-red-400 focus:ring-red-400" : ""}`}
                />
                <datalist id="new-user-role-list">
                  {assignableRoles.map((r) => (
                    <option key={r.name} value={r.name}>{r.label}</option>
                  ))}
                </datalist>
                {touched2.role && step2Errors.role && <p className="text-xs text-red-600 mt-1">{step2Errors.role}</p>}
              </div>

              {/* Role preview cards */}
              {assignableRoles.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                  {assignableRoles.map((r) => (
                    <button
                      key={r.name}
                      type="button"
                      onClick={() => setRole(r.name)}
                      className={`rounded-xl border-2 px-3 py-2.5 text-left transition-all ${
                        role === r.name
                          ? "border-[var(--color-primary-500)] bg-[var(--color-primary-50)]"
                          : "border-[var(--color-border)] hover:border-[var(--color-primary-300)] hover:bg-[var(--color-primary-50)]"
                      }`}
                    >
                      <p className={`text-xs font-bold ${role === r.name ? "text-[var(--color-primary-700)]" : "text-[var(--color-ink-800)]"}`}>{r.label}</p>
                      <p className="text-[10px] text-[var(--color-ink-400)] mt-0.5">{r.name}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Summary of user */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-5 py-4">
            <p className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wide mb-3">Summary</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)] text-sm font-bold flex items-center justify-center shrink-0">
                {name.trim() ? name.trim()[0].toUpperCase() : "?"}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-ink-900)]">{name || "—"}</p>
                <p className="text-xs text-[var(--color-ink-400)]">@{username || "—"} · {role || "No role"}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="rounded-xl border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors">
              ← Back
            </button>
            <button
              onClick={() => {
                setTouched2({ hospitalId: true, role: true });
                if (step2Valid) setStep(3);
              }}
              className="rounded-xl bg-[var(--color-primary-600)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] transition-colors"
            >
              Next: Set Permissions →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Permissions ── */}
      {step === 3 && (
        <div className="space-y-4">
          {createError && (
            <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
              <AlertTriangle size={14} className="shrink-0" /> {createError}
            </div>
          )}

          <p className="text-xs text-[var(--color-ink-500)] bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
            These permissions apply <strong>system-wide</strong> to the <strong>{role}</strong> role — not just for this user. Adjust carefully.
          </p>

          {/* Permission toggles */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-[var(--color-surface-sunken)] border-b border-[var(--color-border)] flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-[var(--color-ink-900)]">{role}</p>
                <p className="text-xs text-[var(--color-ink-400)] mt-0.5">
                  <span className="font-medium text-[var(--color-primary-600)]">{getRolePerms(role).length} permissions</span> enabled
                </p>
              </div>
            </div>

            <div className="divide-y divide-[var(--color-border)]">
              {PERMISSION_GROUPS.map((group) => {
                const groupKeys = group.permissions.map((p) => p.key);
                const rolePerms = getRolePerms(role);
                const allOn = groupKeys.every((k) => rolePerms.includes(k));
                return (
                  <div key={group.category} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-[var(--color-ink-500)] uppercase tracking-wider">{group.category}</p>
                      <button
                        onClick={() => toggleGroupAll(role, groupKeys)}
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border transition-colors ${
                          allOn
                            ? "bg-[var(--color-primary-100)] text-[var(--color-primary-700)] border-[var(--color-primary-200)]"
                            : "bg-white text-[var(--color-ink-400)] border-[var(--color-border)] hover:border-[var(--color-primary-300)]"
                        }`}
                      >{allOn ? "All On" : "All Off"}</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.permissions.map((p) => {
                        const on = rolePerms.includes(p.key);
                        return (
                          <button
                            key={p.key}
                            onClick={() => togglePerm(role, p.key)}
                            className={`flex items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-all text-xs border ${
                              on
                                ? "bg-[var(--color-primary-50)] border-[var(--color-primary-200)]"
                                : "bg-white border-[var(--color-border)] hover:border-[var(--color-primary-300)]"
                            }`}
                          >
                            <div className={`mt-0.5 shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${on ? "bg-[var(--color-primary-600)] border-[var(--color-primary-600)]" : "border-[var(--color-border)]"}`}>
                              {on && <Check size={10} className="text-white" />}
                            </div>
                            <div>
                              <p className={`font-semibold leading-tight ${on ? "text-[var(--color-primary-800)]" : "text-[var(--color-ink-700)]"}`}>{p.label}</p>
                              <p className="text-[var(--color-ink-400)] text-[10px] mt-0.5 leading-snug">{p.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="rounded-xl border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors">
              ← Back
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 rounded-xl bg-[var(--color-primary-600)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors"
            >
              {creating
                ? <><RefreshCw size={14} className="animate-spin" /> Creating…</>
                : <><Check size={14} /> Create User</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
