"use client";

import { Check, Shield, Clock, AlertTriangle, Crown, Zap, Phone, MessageCircle } from "lucide-react";
import type { LicenseInfo } from "@/lib/license";

interface Props {
  hospitalId: string | null;
  hospitalName: string;
  license: LicenseInfo | null;
  razorpayKey: string;
}

const PLANS = [
  {
    id: "MONTHLY",
    label: "Monthly",
    price: "₹999",
    period: "/month",
    icon: Zap,
    features: [
      "All modules unlocked",
      "Unlimited patients",
      "EMR & prescriptions",
      "Appointment management",
      "Audit trail & analytics",
    ],
  },
  {
    id: "YEARLY",
    label: "Yearly",
    price: "₹9,999",
    period: "/year",
    badge: "Save ₹2,989",
    icon: Crown,
    features: [
      "Everything in Monthly",
      "Priority support",
      "Early feature access",
      "Custom data export",
      "SLA guarantee",
    ],
  },
];

const CONTACT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "9999999999";
const WHATSAPP_MSG = (hospital: string, plan: string) =>
  encodeURIComponent(
    `Hi, I'd like to subscribe to PPMS for *${hospital}* — ${plan} plan. Please activate my account.`
  );

export function SubscriptionClient({ hospitalId, hospitalName, license }: Props) {
  const isExpired = license?.isBlocked ?? true;
  const daysLeft  = license?.daysRemaining ?? 0;
  const status    = license?.status ?? "NO_LICENSE";

  const statusLabel: Record<string, { text: string; color: string }> = {
    TRIAL_ACTIVE:         { text: `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left in trial`, color: "text-amber-700 bg-amber-50 border-amber-200" },
    TRIAL_EXPIRED:        { text: "Free trial has expired",        color: "text-red-700 bg-red-50 border-red-200"       },
    SUBSCRIPTION_EXPIRED: { text: "Subscription has expired",      color: "text-red-700 bg-red-50 border-red-200"       },
    SUBSCRIBED:           { text: `Active — ${daysLeft} days left`,color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    NO_LICENSE:           { text: "No license found",              color: "text-red-700 bg-red-50 border-red-200"       },
  };
  const badge = statusLabel[status] ?? statusLabel.NO_LICENSE;

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-12 px-4">
      {/* Header */}
      <div className="text-center mb-10 max-w-lg">
        <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary-100)] flex items-center justify-center mx-auto mb-4">
          <Shield size={28} className="text-[var(--color-primary-600)]" />
        </div>

        {isExpired && (
          <div className="flex items-center gap-2 justify-center mb-4 rounded-xl border px-4 py-2.5 text-sm font-semibold text-red-700 bg-red-50 border-red-200">
            <AlertTriangle size={15} /> Your access has been paused
          </div>
        )}

        <h1 className="text-2xl font-bold text-[var(--color-ink-900)] mb-2">
          {hospitalName ? `${hospitalName} · ` : ""}PPMS Subscription
        </h1>
        <p className="text-sm text-[var(--color-ink-500)]">
          Choose a plan and contact us to activate your account.
        </p>

        <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full border text-xs font-semibold ${badge.color}`}>
          <Clock size={12} /> {badge.text}
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl w-full mb-8">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const waLink = `https://wa.me/${CONTACT_PHONE}?text=${WHATSAPP_MSG(hospitalName || "my hospital", plan.label)}`;
          return (
            <div key={plan.id} className="relative rounded-2xl border-2 border-[var(--color-border)] bg-white p-6 flex flex-col shadow-sm">
              {"badge" in plan && plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold px-3 py-1 rounded-full bg-emerald-600 text-white shadow-sm">
                  {plan.badge}
                </span>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-50)] flex items-center justify-center">
                  <Icon size={18} className="text-[var(--color-primary-600)]" />
                </div>
                <p className="text-base font-bold text-[var(--color-ink-900)]">{plan.label}</p>
              </div>

              <div className="mb-5">
                <span className="text-3xl font-extrabold text-[var(--color-ink-900)]">{plan.price}</span>
                <span className="text-sm text-[var(--color-ink-500)] ml-1">{plan.period}</span>
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-[var(--color-ink-700)]">
                    <Check size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
              >
                <MessageCircle size={15} /> Subscribe via WhatsApp
              </a>
            </div>
          );
        })}
      </div>

      {/* Contact info */}
      <div className="max-w-md w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center">
        <p className="text-xs font-bold text-[var(--color-ink-500)] uppercase tracking-wider mb-3">
          How to subscribe
        </p>
        <ol className="text-sm text-[var(--color-ink-700)] space-y-1.5 text-left list-none">
          <li className="flex items-start gap-2"><span className="font-bold text-[var(--color-primary-600)] shrink-0">1.</span> Pick a plan above</li>
          <li className="flex items-start gap-2"><span className="font-bold text-[var(--color-primary-600)] shrink-0">2.</span> Click "Subscribe via WhatsApp" — it opens a pre-filled message</li>
          <li className="flex items-start gap-2"><span className="font-bold text-[var(--color-primary-600)] shrink-0">3.</span> We'll activate your account within a few hours after payment</li>
        </ol>

        <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex items-center justify-center gap-2 text-sm font-semibold text-[var(--color-ink-700)]">
          <Phone size={15} className="text-[var(--color-primary-600)]" />
          <a href={`tel:${CONTACT_PHONE}`} className="hover:underline">{CONTACT_PHONE}</a>
        </div>
      </div>

      <p className="mt-5 text-[11px] text-[var(--color-ink-400)] text-center">
        Payments collected offline or via UPI · Account activated within a few hours
      </p>
    </div>
  );
}
