import { requireRole } from "@/lib/rbac";
import Link from "next/link";
import { ShieldCheck, LogIn, Activity, Monitor, AlertTriangle } from "lucide-react";

const NAV = [
  { href: "/audit",                icon: ShieldCheck,    label: "Dashboard"        },
  { href: "/audit/login-history",  icon: LogIn,          label: "Login History"    },
  { href: "/audit/activity",       icon: Activity,       label: "Activity Logs"    },
  { href: "/audit/sessions",       icon: Monitor,        label: "Active Sessions"  },
  { href: "/audit/failed-logins",  icon: AlertTriangle,  label: "Failed Logins"    },
];

export default async function AuditLayout({ children }: { children: React.ReactNode }) {
  await requireRole("DOCTOR");

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start">
      {/* Sidebar — horizontal scroll on mobile, sticky sidebar on md+ */}
      <aside className="w-full md:w-52 md:shrink-0 md:sticky md:top-6">
        <div className="rounded-2xl border border-[var(--color-border)] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-ink-400)]">Audit & Security</p>
          </div>
          <nav className="py-1.5 flex md:flex-col overflow-x-auto">
            {NAV.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-[var(--color-ink-600)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink-900)] transition-colors whitespace-nowrap"
              >
                <Icon size={14} className="shrink-0" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 fade-in">{children}</div>
    </div>
  );
}
