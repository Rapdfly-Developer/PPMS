"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ReceiptText, Building2, ShieldCheck,
  FileCheck2, MessageSquareWarning, Banknote,
} from "lucide-react";
import clsx from "clsx";

const SUB_NAV = [
  { href: "/billing",                     label: "Overview",            icon: ReceiptText          },
  { href: "/billing/insurance-companies", label: "Insurance Companies", icon: Building2            },
  { href: "/billing/patient-insurance",   label: "Patient Insurance",   icon: ShieldCheck          },
  { href: "/billing/pre-auth",            label: "Pre-Authorization",   icon: FileCheck2           },
  { href: "/billing/claims",              label: "Claims",              icon: ReceiptText          },
  { href: "/billing/queries",             label: "Queries",             icon: MessageSquareWarning },
  { href: "/billing/settlement",          label: "Settlement",          icon: Banknote             },
];

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/billing" ? pathname === "/billing" : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex flex-col gap-0 min-h-0 flex-1">
      {/* Sub-nav strip */}
      <div className="border-b border-gray-200 dark:border-white/[0.08] bg-white dark:bg-transparent sticky top-0 z-10">
        <nav className="flex items-center gap-1 px-6 overflow-x-auto scrollbar-none">
          {SUB_NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-3 text-[12.5px] font-medium whitespace-nowrap border-b-2 transition-all duration-150",
                  active
                    ? "border-teal-500 text-teal-600 dark:text-teal-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-white/20",
                )}
              >
                <Icon size={13} strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Page content */}
      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
}
