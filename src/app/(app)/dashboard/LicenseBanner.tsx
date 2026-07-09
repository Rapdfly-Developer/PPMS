import Link from "next/link";
import { AlertTriangle, Clock, CheckCircle, XCircle } from "lucide-react";
import type { LicenseInfo } from "@/lib/license";

export function LicenseBanner({ license }: { license: LicenseInfo | null }) {
  if (!license) return null;

  const { status, daysRemaining } = license;

  if (status === "SUBSCRIBED") {
    if (daysRemaining > 14) return null;
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-amber-800">
          <Clock size={15} className="shrink-0" />
          <span>Subscription expires in <strong>{daysRemaining} day{daysRemaining !== 1 ? "s" : ""}</strong>.</span>
        </div>
        <Link href="/subscription" className="whitespace-nowrap rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors">
          Renew Now
        </Link>
      </div>
    );
  }

  if (status === "TRIAL_ACTIVE") {
    const color = daysRemaining <= 3 ? "red" : daysRemaining <= 7 ? "amber" : "emerald";
    const classes = {
      red:     { wrap: "border-red-200 bg-red-50",     text: "text-red-800",     btn: "bg-red-600 hover:bg-red-700"       },
      amber:   { wrap: "border-amber-200 bg-amber-50", text: "text-amber-800",   btn: "bg-amber-600 hover:bg-amber-700"   },
      emerald: { wrap: "border-emerald-200 bg-emerald-50", text: "text-emerald-800", btn: "bg-emerald-600 hover:bg-emerald-700" },
    }[color];

    const Icon = daysRemaining <= 3 ? AlertTriangle : Clock;

    return (
      <div className={`mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${classes.wrap}`}>
        <div className={`flex items-center gap-2 ${classes.text}`}>
          <Icon size={15} className="shrink-0" />
          <span>
            Free trial &mdash; <strong>{daysRemaining} day{daysRemaining !== 1 ? "s" : ""} remaining</strong>.
            {daysRemaining <= 3 && " Your access will be paused when the trial ends."}
          </span>
        </div>
        <Link href="/subscription" className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors ${classes.btn}`}>
          Subscribe Now
        </Link>
      </div>
    );
  }

  if (status === "TRIAL_EXPIRED" || status === "SUBSCRIPTION_EXPIRED") {
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-red-800">
          <XCircle size={15} className="shrink-0" />
          <span>
            {status === "TRIAL_EXPIRED" ? "Your free trial has expired." : "Your subscription has expired."}
            {" "}Subscribe to restore full access.
          </span>
        </div>
        <Link href="/subscription" className="whitespace-nowrap rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors">
          Subscribe Now
        </Link>
      </div>
    );
  }

  return null;
}
