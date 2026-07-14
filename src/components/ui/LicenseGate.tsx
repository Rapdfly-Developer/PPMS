"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ShieldOff, Key, CreditCard } from "lucide-react";

interface Props {
  active: boolean;
  status: string;
  expiryDate: string | null;
  remainingDays: number;
  children: React.ReactNode;
}

// Routes accessible even without a valid license
function isExempt(pathname: string) {
  return pathname.startsWith("/settings") || pathname.startsWith("/subscription");
}

const STATUS_LABEL: Record<string, string> = {
  NONE:      "Not Activated",
  EXPIRED:   "Expired",
  INVALID:   "Invalid — License Tampered",
  SUSPENDED: "Suspended",
};

export function LicenseGate({ active, status, expiryDate, remainingDays, children }: Props) {
  const pathname = usePathname() ?? "";

  if (active || isExempt(pathname)) return <>{children}</>;

  const isExpired = ["EXPIRED", "SUSPENDED", "INVALID"].includes(status);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-12 text-center">

      {/* Icon */}
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: "rgba(239,68,68,.07)", border: "1px solid rgba(239,68,68,.18)" }}
      >
        <ShieldOff size={32} className="text-red-500" />
      </div>

      <h1 className="text-2xl font-black text-[var(--color-text,#111827)] mb-2">
        License Required
      </h1>
      <p className="text-sm text-[var(--color-text-muted,#6B7280)] max-w-md mb-6 leading-relaxed">
        Your PPMS license has {isExpired ? "expired or been deactivated" : "not been activated"}.
        Activate or renew your license to continue using this module.
      </p>

      {/* Status card */}
      <div
        className="rounded-xl p-5 mb-7 w-full max-w-sm text-left"
        style={{ background: "var(--color-surface,#fff)", border: "1px solid var(--color-border,#E2E6E8)" }}
      >
        <p className="text-[10px] font-bold text-[var(--color-text-muted,#6B7280)] uppercase tracking-widest mb-3">
          License Status
        </p>
        <div className="flex flex-col gap-2.5">
          <Row label="Status">
            <span className="font-semibold text-red-500">{STATUS_LABEL[status] ?? status}</span>
          </Row>
          {expiryDate && (
            <Row label="Expiry Date">
              <span className="font-semibold text-[var(--color-text,#111827)]">
                {new Date(expiryDate).toLocaleDateString("en-IN", {
                  day: "2-digit", month: "short", year: "numeric",
                })}
              </span>
            </Row>
          )}
          {remainingDays > 0 && (
            <Row label="Remaining Days">
              <span className="font-semibold text-amber-500">{remainingDays} days</span>
            </Row>
          )}
        </div>
      </div>

      {/* Go to settings note */}
      <p className="text-xs text-[var(--color-text-muted,#6B7280)] mb-4">
        Go to <strong>Settings → License Management</strong> to manage your license.
      </p>

      {/* Actions */}
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/settings?tab=license"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
          style={{ background: "#157A73" }}
        >
          <Key size={14} /> Activate License
        </Link>
        <Link
          href="/settings?tab=license"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          style={{ border: "1px solid var(--color-border,#E2E6E8)", color: "var(--color-text,#111827)" }}
        >
          <CreditCard size={14} /> Renew License
        </Link>
        <a
          href="mailto:support@ppms.in"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          style={{ border: "1px solid var(--color-border,#E2E6E8)", color: "var(--color-text-muted,#6B7280)" }}
        >
          Contact Support
        </a>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--color-text-muted,#6B7280)]">{label}</span>
      {children}
    </div>
  );
}
