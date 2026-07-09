"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Mail, Phone, Building2, Shield, AtSign,
  Lock, ToggleLeft, ToggleRight, Trash2, Check, AlertTriangle, Eye, EyeOff,
  CalendarDays,
} from "lucide-react";
import { updateUser, deleteUser, toggleUserActive } from "../../actions";

const ROLE_LABEL: Record<string, { label: string; color: string; ring: string }> = {
  HOSPITAL:      { label: "Hospital",      color: "bg-emerald-100 text-emerald-800", ring: "ring-emerald-300" },
  REFRACTIONIST: { label: "Refractionist", color: "bg-teal-100 text-teal-800",       ring: "ring-teal-300"    },
  DOCTOR:        { label: "Doctor",        color: "bg-green-100 text-green-800",     ring: "ring-green-300"   },
};

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (name.slice(0, 2).toUpperCase() || "?");
}

function avatarColor(name: string) {
  const COLORS = [
    { bg: "#6EE7B7", text: "#065F46" },
    { bg: "#A7F3D0", text: "#047857" },
    { bg: "#BBF7D0", text: "#166534" },
    { bg: "#86EFAC", text: "#14532D" },
    { bg: "#6EE7B7", text: "#064E3B" },
    { bg: "#D1FAE5", text: "#065F46" },
  ];
  return COLORS[(name.charCodeAt(0) || 0) % COLORS.length];
}

const INPUT = "w-full rounded-xl border border-[var(--color-border)] bg-white pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition-colors placeholder:text-[var(--color-ink-300)]";

function InputIcon({ icon: Icon, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ElementType }) {
  return (
    <div className="relative">
      <Icon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
      <input className={INPUT} {...props} />
    </div>
  );
}

function ReadOnlyRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-100">
      <div className="w-8 h-8 rounded-lg bg-white border border-emerald-200 flex items-center justify-center shrink-0">
        <Icon size={14} className="text-emerald-500" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">{label}</p>
        <p className="text-sm font-medium text-[var(--color-ink-700)] truncate mt-0.5">{value || "—"}</p>
      </div>
      <span className="ml-auto text-[10px] font-medium text-emerald-500 bg-emerald-100 border border-emerald-200 rounded-md px-1.5 py-0.5 shrink-0">
        locked
      </span>
    </div>
  );
}

function Msg({ msg }: { msg: { type: "success" | "error"; text: string } }) {
  const ok = msg.type === "success";
  return (
    <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm ${ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
      {ok ? <Check size={14} /> : <AlertTriangle size={14} />}
      {msg.text}
    </div>
  );
}

export function UserProfileClient({
  userId, username, role, email, active, createdAt,
  name, mobile, hospitalId, hospitalName, hospitals,
}: {
  userId: string;
  username: string;
  role: string;
  email: string;
  active: boolean;
  createdAt: string;
  name: string;
  mobile: string;
  hospitalId: string;
  hospitalName: string;
  hospitals: { id: string; name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/settings";

  const [contactForm, setContactForm] = useState({ email, mobile });
  const [contactPending, startContactTransition] = useTransition();
  const [contactMsg, setContactMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [secPending, startSecTransition] = useTransition();
  const [secMsg, setSecMsg]     = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [isActive, setIsActive]   = useState(active);
  const [toggling, startToggleTransition] = useTransition();

  const [showDelete, setShowDelete]   = useState(false);
  const [deleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState("");

  const roleMeta = ROLE_LABEL[role] ?? { label: role, color: "bg-slate-100 text-slate-600", ring: "ring-slate-200" };
  const av = avatarColor(name);
  const joined = new Date(createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  function handleContact(e: React.FormEvent) {
    e.preventDefault();
    setContactMsg(null);
    const fd = new FormData();
    fd.set("name",       name);
    fd.set("email",      contactForm.email);
    fd.set("mobile",     contactForm.mobile);
    fd.set("hospitalId", hospitalId);
    fd.set("active",     String(isActive));
    startContactTransition(async () => {
      const res = await updateUser(userId, fd);
      if (res.error) { setContactMsg({ type: "error", text: res.error }); return; }
      setContactMsg({ type: "success", text: "Contact details updated." });
    });
  }

  function handleSecurity(e: React.FormEvent) {
    e.preventDefault();
    if (!password) { setSecMsg({ type: "error", text: "Enter a new password." }); return; }
    if (password.length < 6) { setSecMsg({ type: "error", text: "Password must be at least 6 characters." }); return; }
    setSecMsg(null);
    const fd = new FormData();
    fd.set("name",       name);
    fd.set("email",      contactForm.email);
    fd.set("mobile",     contactForm.mobile);
    fd.set("hospitalId", hospitalId);
    fd.set("active",     String(isActive));
    fd.set("password",   password);
    startSecTransition(async () => {
      const res = await updateUser(userId, fd);
      if (res.error) { setSecMsg({ type: "error", text: res.error }); return; }
      setPassword("");
      setSecMsg({ type: "success", text: "Password changed successfully." });
    });
  }

  function handleToggle() {
    startToggleTransition(async () => {
      const next = !isActive;
      await toggleUserActive(userId, next);
      setIsActive(next);
    });
  }

  function handleDelete() {
    setDeleteError("");
    startDeleteTransition(async () => {
      const res = await deleteUser(userId);
      if (res.error) { setDeleteError(res.error); return; }
      router.push(returnTo);
    });
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface-sunken)]">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Back */}
        <button
          onClick={() => router.push(returnTo)}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-400)] hover:text-[var(--color-ink-800)] mb-6 transition-colors"
        >
          <ArrowLeft size={15} /> Back
        </button>

        {/* ── Hero card ─────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden mb-6 shadow-sm">
          {/* Coloured top strip */}
          <div className="h-2 w-full bg-gradient-to-r from-emerald-300 via-green-200 to-teal-200" />

          <div className="px-6 py-5 flex items-start gap-5">
            {/* Avatar */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0 shadow-sm"
              style={{ background: av.bg, color: av.text }}
            >
              {initials(name)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-[var(--color-ink-900)]">{name || username}</h1>
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ring-1 ${roleMeta.color} ${roleMeta.ring}`}>
                  {roleMeta.label}
                </span>
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${isActive ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-red-50 text-red-600 ring-1 ring-red-200"}`}>
                  {isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-sm text-[var(--color-ink-400)] mt-1 flex items-center gap-1.5">
                <AtSign size={12} /> {username}
              </p>
              {hospitalName && (
                <p className="text-xs text-[var(--color-ink-400)] mt-0.5 flex items-center gap-1.5">
                  <Building2 size={12} /> {hospitalName}
                </p>
              )}
            </div>

            {/* Joined */}
            <div className="shrink-0 text-right hidden sm:block">
              <div className="flex items-center gap-1.5 text-[var(--color-ink-400)] justify-end">
                <CalendarDays size={12} />
                <span className="text-[11px]">Joined</span>
              </div>
              <p className="text-sm font-semibold text-[var(--color-ink-700)] mt-0.5">{joined}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">

          {/* ── Identity (read-only) ──────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-emerald-100 overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-emerald-100 bg-emerald-50/60 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-900">Identity</p>
                <p className="text-xs text-emerald-600/70 mt-0.5">These fields are managed by the system and cannot be changed.</p>
              </div>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3">
              <ReadOnlyRow icon={Shield} label="Full Name" value={name} />
              {hospitalName && <ReadOnlyRow icon={Building2} label="Hospital" value={hospitalName} />}
            </div>
          </div>

          {/* ── Contact details (editable) ───────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-emerald-100 overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-emerald-100 bg-emerald-50/40">
              <p className="text-sm font-semibold text-[var(--color-ink-900)]">Contact Details</p>
              <p className="text-xs text-[var(--color-ink-400)] mt-0.5">Update the user's email address and mobile number.</p>
            </div>
            <form onSubmit={handleContact} className="px-5 py-4 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wider">Email</label>
                  <InputIcon
                    icon={Mail}
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="user@example.com"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wider">Mobile</label>
                  <InputIcon
                    icon={Phone}
                    type="tel"
                    maxLength={10}
                    value={contactForm.mobile}
                    onChange={(e) => setContactForm((f) => ({ ...f, mobile: e.target.value }))}
                    placeholder="10-digit number"
                  />
                  <p className="text-[11px] text-[var(--color-ink-400)]">10 digits</p>
                </div>
              </div>

              {contactMsg && <Msg msg={contactMsg} />}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={contactPending}
                  className="rounded-xl bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                >
                  {contactPending ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>

          {/* ── Account info (read-only) ─────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-emerald-100 overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-emerald-100 bg-emerald-50/40">
              <p className="text-sm font-semibold text-[var(--color-ink-900)]">Account Information</p>
              <p className="text-xs text-[var(--color-ink-400)] mt-0.5">Read-only account identity and role details.</p>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 gap-3">
              <ReadOnlyRow icon={AtSign} label="Username" value={`@${username}`} />
              <ReadOnlyRow icon={Shield} label="Role" value={roleMeta.label} />
            </div>
          </div>

          {/* ── Security ────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-emerald-100 overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-emerald-100 bg-emerald-50/40">
              <p className="text-sm font-semibold text-[var(--color-ink-900)]">Security</p>
              <p className="text-xs text-[var(--color-ink-400)] mt-0.5">Change the user's login password.</p>
            </div>
            <form onSubmit={handleSecurity} className="px-5 py-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--color-ink-500)] uppercase tracking-wider">New Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    className={`${INPUT} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)]"
                  >
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="text-[11px] text-[var(--color-ink-400)]">Minimum 6 characters.</p>
              </div>

              {secMsg && <Msg msg={secMsg} />}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={secPending || !password}
                  className="rounded-xl bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                >
                  {secPending ? "Updating…" : "Update Password"}
                </button>
              </div>
            </form>
          </div>

          {/* ── Account status ───────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-emerald-100 overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-emerald-100 bg-emerald-50/40">
              <p className="text-sm font-semibold text-[var(--color-ink-900)]">Account Status</p>
              <p className="text-xs text-[var(--color-ink-400)] mt-0.5">Enable or disable this user's ability to log in.</p>
            </div>
            <div className="px-5 py-4">
              <div className={`flex items-center justify-between rounded-xl px-4 py-3.5 ${isActive ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-ink-800)]">
                    {isActive ? "Account is Active" : "Account is Deactivated"}
                  </p>
                  <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                    {isActive ? "User can log in and access the system." : "Login is blocked for this user."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggle}
                  disabled={toggling}
                  className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50 ${isActive ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}
                >
                  {toggling ? (
                    <span className="w-4 h-4 border-2 border-current/40 border-t-current rounded-full animate-spin" />
                  ) : isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  {toggling ? "…" : isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          </div>

          {/* ── Danger zone ──────────────────────────────────────────────── */}
          {role !== "DOCTOR" && (
            <div className="bg-white rounded-2xl border border-red-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 border-b border-red-100 bg-red-50">
                <p className="text-sm font-semibold text-red-800">Danger Zone</p>
                <p className="text-xs text-red-400 mt-0.5">Irreversible actions — proceed with caution.</p>
              </div>
              <div className="px-5 py-4">
                {!showDelete ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[var(--color-ink-800)]">Delete this user</p>
                      <p className="text-xs text-[var(--color-ink-400)] mt-0.5">Permanently removes the account and all associated data.</p>
                    </div>
                    <button
                      onClick={() => setShowDelete(true)}
                      className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={14} /> Delete User
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-red-50 border border-red-200">
                      <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">
                        Are you sure you want to delete <strong>{name || username}</strong>? This cannot be undone.
                      </p>
                    </div>
                    {deleteError && <p className="text-xs text-red-600 px-1">{deleteError}</p>}
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => setShowDelete(false)}
                        className="px-4 py-2 text-sm font-medium rounded-xl border border-[var(--color-border)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                      >
                        {deleting ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Trash2 size={14} />}
                        {deleting ? "Deleting…" : "Yes, Delete"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
