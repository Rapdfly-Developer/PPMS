"use client";

import { Check, Clock, AlertTriangle, Crown, Zap, Phone, MessageCircle } from "lucide-react";
import type { LicenseInfo } from "@/lib/license";

function PpmsLogo({ size = 110 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
      <defs>
        <linearGradient id="sl-blue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563EB"/>
          <stop offset="100%" stopColor="#1E3A8A"/>
        </linearGradient>
        <linearGradient id="sl-green" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4ADE80"/>
          <stop offset="100%" stopColor="#059669"/>
        </linearGradient>
        <linearGradient id="sl-swoosh" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10B981"/>
          <stop offset="55%" stopColor="#14B8A6"/>
          <stop offset="100%" stopColor="#0EA5E9"/>
        </linearGradient>
        <linearGradient id="sl-stem" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1E3A8A"/>
          <stop offset="60%" stopColor="#2563EB"/>
          <stop offset="100%" stopColor="#14B8A6"/>
        </linearGradient>
        <linearGradient id="sl-word" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1E3A8A"/>
          <stop offset="45%" stopColor="#2563EB"/>
          <stop offset="70%" stopColor="#14B8A6"/>
          <stop offset="100%" stopColor="#059669"/>
        </linearGradient>
        <filter id="sl-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1.5" dy="2.5" stdDeviation="3" floodColor="rgba(30,58,138,0.25)"/>
        </filter>
      </defs>
      {/* Green medical cross */}
      <g filter="url(#sl-shadow)">
        <rect x="42" y="42" width="20" height="64" rx="5" fill="url(#sl-green)"/>
        <rect x="20" y="64" width="64" height="20" rx="5" fill="url(#sl-green)"/>
        <rect x="46" y="44" width="6" height="28" rx="3" fill="rgba(255,255,255,0.3)"/>
      </g>
      {/* Letter P */}
      <g filter="url(#sl-shadow)">
        <path d="M 92 16 L 116 16 L 116 148 Q 116 154 110 154 L 98 154 Q 92 154 92 148 Z" fill="url(#sl-stem)"/>
        <path fillRule="evenodd" fill="url(#sl-blue)"
          d="M 116 16 L 156 16 C 194 16 214 40 214 68 C 214 96 194 120 156 120 L 116 120 L 116 94 L 152 94 C 176 94 188 84 188 68 C 188 52 176 42 152 42 L 116 42 Z"/>
        <path d="M 92 16 L 116 16 L 116 24 Q 104 28 92 24 Z" fill="rgba(255,255,255,0.22)"/>
      </g>
      {/* Teal swoosh */}
      <path d="M 26 128 C 66 118 92 74 126 54 C 146 42 168 44 178 58 C 160 50 144 55 130 66 C 98 92 72 126 26 128 Z"
        fill="url(#sl-swoosh)" opacity="0.92" filter="url(#sl-shadow)"/>
      {/* Patient figure */}
      <g fill="url(#sl-blue)">
        <circle cx="152" cy="60" r="9"/>
        <path d="M 138 92 C 138 78 144 72 152 73 C 160 74 164 80 162 92 Q 150 97 138 92 Z"/>
        <path d="M 160 74 Q 170 64 177 69 Q 172 76 163 80 Z"/>
      </g>
      {/* PPMS wordmark */}
      <text x="120" y="192" textAnchor="middle" fill="url(#sl-word)"
        style={{ font: "800 44px Arial, Helvetica, sans-serif", letterSpacing: "3px" }}>
        PPMS
      </text>
      {/* Tagline */}
      <text x="120" y="207" textAnchor="middle" fill="#475569"
        style={{ font: "700 8px Arial, Helvetica, sans-serif", letterSpacing: "1.6px" }}>
        PATIENT PRACTICE MANAGEMENT SYSTEM
      </text>
      {/* Divider with heart+ECG */}
      <line x1="30" y1="217" x2="104" y2="217" stroke="#CBD5E1" strokeWidth="1"/>
      <line x1="136" y1="217" x2="210" y2="217" stroke="#CBD5E1" strokeWidth="1"/>
      <path d="M 120 224 C 114 218 110 215 110 211 C 110 207 114 205 117 208 L 120 211 L 123 208 C 126 205 130 207 130 211 C 130 215 126 218 120 224 Z" fill="#10B981"/>
      <path d="M 112 213 L 116 213 L 118 209 L 121 217 L 123 213 L 128 213" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Motto */}
      <text x="120" y="238" textAnchor="middle"
        style={{ font: "800 10.5px Arial, Helvetica, sans-serif", letterSpacing: "1.4px" }}>
        <tspan fill="#1E3A8A">MANAGE. </tspan>
        <tspan fill="#10B981">CARE. </tspan>
        <tspan fill="#1E3A8A">GROW.</tspan>
      </text>
    </svg>
  );
}

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
        <div className="flex items-center justify-center mx-auto mb-4">
          <PpmsLogo size={110} />
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
