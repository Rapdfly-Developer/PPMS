import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  Building2, ShieldCheck, FileCheck2, ReceiptText,
  MessageSquareWarning, Banknote, TrendingUp, Clock, CheckCircle2, AlertCircle,
} from "lucide-react";

export default async function BillingOverviewPage() {
  const user = await requirePermission("insurance.view");
  const hospitalId = user.hospitalId ?? user.doctorId ?? "";

  const [companies, policies, preAuths, claims, openQueries] = await Promise.all([
    prisma.insuranceCompany.count({ where: { hospitalId, active: true } }),
    prisma.patientInsurance.count({ where: { hospitalId, status: "ACTIVE" } }),
    prisma.insurancePreAuthorization.count({ where: { hospitalId, status: "PENDING" } }),
    prisma.insuranceClaim.groupBy({
      by: ["status"],
      where: { hospitalId },
      _count: { status: true },
      _sum: { totalBillAmount: true, approvedAmount: true },
    }),
    prisma.insuranceQuery.count({ where: { claim: { hospitalId }, status: "OPEN" } }),
  ]);

  const claimStats = {
    total: claims.reduce((s, g) => s + g._count.status, 0),
    active: claims.filter((g) => !["CLOSED", "REJECTED"].includes(g.status)).reduce((s, g) => s + g._count.status, 0),
    approved: claims.find((g) => g.status === "APPROVED")?._count.status ?? 0,
    closed: claims.find((g) => g.status === "CLOSED")?._count.status ?? 0,
    totalBilled: claims.reduce((s, g) => s + (g._sum.totalBillAmount ?? 0), 0),
    totalApproved: claims.reduce((s, g) => s + (g._sum.approvedAmount ?? 0), 0),
  };

  const recentClaims = await prisma.insuranceClaim.findMany({
    where: { hospitalId },
    include: {
      patientInsurance: { include: { patient: { select: { name: true } } } },
      insuranceCompany: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const STATUS_COLORS: Record<string, string> = {
    CREATED:          "bg-slate-100 text-slate-600",
    CLAIM_SUBMITTED:  "bg-orange-100 text-orange-700",
    UNDER_REVIEW:     "bg-purple-100 text-purple-700",
    APPROVED:         "bg-emerald-100 text-emerald-700",
    PAYMENT_RECEIVED: "bg-green-100 text-green-700",
    CLOSED:           "bg-slate-100 text-slate-500",
    REJECTED:         "bg-red-100 text-red-700",
    QUERY_RAISED:     "bg-rose-100 text-rose-700",
  };

  function fmt(n: number) { return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 }); }

  const quickLinks = [
    { href: "/billing/insurance-companies", label: "Insurance Companies", icon: Building2, count: companies, desc: "active" },
    { href: "/billing/patient-insurance",   label: "Patient Policies",    icon: ShieldCheck, count: policies,  desc: "active" },
    { href: "/billing/pre-auth",            label: "Pending Pre-Auths",   icon: FileCheck2,  count: preAuths,  desc: "pending" },
    { href: "/billing/queries",             label: "Open Queries",        icon: MessageSquareWarning, count: openQueries, desc: "open" },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-7">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[var(--color-ink-900)]">Billing & Insurance</h1>
        <p className="text-sm text-[var(--color-ink-500)] mt-0.5">Overview of insurance claims, approvals, and settlements.</p>
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Billed", value: fmt(claimStats.totalBilled), icon: ReceiptText, color: "text-[var(--color-ink-800)]", bg: "rgba(107,114,128,0.08)" },
          { label: "Insurance Approved", value: fmt(claimStats.totalApproved), icon: CheckCircle2, color: "text-emerald-600", bg: "rgba(16,185,129,0.08)" },
          { label: "Recovery Rate", value: claimStats.totalBilled > 0 ? Math.round((claimStats.totalApproved / claimStats.totalBilled) * 100) + "%" : "—", icon: TrendingUp, color: "text-teal-600", bg: "rgba(20,184,166,0.08)" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-2xl border border-[var(--color-border)] px-5 py-4 flex items-center gap-4" style={{ background: "var(--color-surface-1)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.bg }}>
                <Icon size={18} className={s.color} />
              </div>
              <div>
                <p className="text-xs text-[var(--color-ink-400)]">{s.label}</p>
                <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Claim status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Claims", value: claimStats.total, color: "text-[var(--color-ink-700)]" },
          { label: "Active", value: claimStats.active, color: "text-amber-600" },
          { label: "Approved", value: claimStats.approved, color: "text-emerald-600" },
          { label: "Closed", value: claimStats.closed, color: "text-[var(--color-ink-400)]" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-center" style={{ background: "var(--color-surface-1)" }}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickLinks.map((l) => {
          const Icon = l.icon;
          const highlight = l.count > 0 && (l.desc === "pending" || l.desc === "open");
          return (
            <Link key={l.href} href={l.href}
              className="group rounded-2xl border border-[var(--color-border)] px-4 py-4 hover:border-teal-500/40 hover:bg-teal-500/[0.03] transition-all"
              style={{ background: "var(--color-surface-1)" }}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${highlight ? "bg-amber-100 dark:bg-amber-900/30" : "bg-[var(--color-surface-2)]"}`}>
                  <Icon size={15} className={highlight ? "text-amber-600" : "text-[var(--color-ink-500)] group-hover:text-teal-500"} />
                </div>
                {highlight && l.count > 0 && (
                  <span className="text-xs font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">{l.count}</span>
                )}
              </div>
              <p className="text-sm font-semibold text-[var(--color-ink-800)] group-hover:text-[var(--color-ink-900)]">{l.label}</p>
              {!highlight && <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{l.count} {l.desc}</p>}
            </Link>
          );
        })}
      </div>

      {/* Alerts */}
      {(preAuths > 0 || openQueries > 0) && (
        <div className="space-y-2">
          {preAuths > 0 && (
            <Link href="/billing/pre-auth" className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-800 hover:border-amber-400 dark:hover:border-amber-600 transition-colors" style={{ background: "rgba(245,158,11,0.05)" }}>
              <Clock size={15} className="text-amber-500 shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400"><strong>{preAuths}</strong> pre-authorization request{preAuths > 1 ? "s" : ""} pending insurer response.</p>
            </Link>
          )}
          {openQueries > 0 && (
            <Link href="/billing/queries" className="flex items-center gap-3 px-4 py-3 rounded-xl border border-rose-200 dark:border-rose-800 hover:border-rose-400 dark:hover:border-rose-600 transition-colors" style={{ background: "rgba(244,63,94,0.05)" }}>
              <AlertCircle size={15} className="text-rose-500 shrink-0" />
              <p className="text-sm text-rose-700 dark:text-rose-400"><strong>{openQueries}</strong> open insurer {openQueries > 1 ? "queries" : "query"} awaiting response.</p>
            </Link>
          )}
        </div>
      )}

      {/* Recent claims */}
      {recentClaims.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--color-ink-700)]">Recent Claims</h2>
            <Link href="/billing/claims" className="text-xs text-teal-500 hover:underline">View all →</Link>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden" style={{ background: "var(--color-surface-1)" }}>
            {recentClaims.map((c, i) => (
              <div key={c.id} className={`flex items-center justify-between px-5 py-3.5 ${i < recentClaims.length - 1 ? "border-b border-[var(--color-border)]" : ""} hover:bg-[var(--color-surface-2)] transition-colors`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-teal-500">{c.claimNumber}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] ?? "bg-slate-100 text-slate-500"}`}>{c.status.replace(/_/g, " ")}</span>
                  </div>
                  <p className="text-sm text-[var(--color-ink-700)] mt-0.5">{c.patientInsurance.patient.name} · {c.insuranceCompany.name}</p>
                </div>
                <p className="font-mono text-sm font-semibold text-[var(--color-ink-800)]">{fmt(c.totalBillAmount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
