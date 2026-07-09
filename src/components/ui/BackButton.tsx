"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function BackButton({
  href,
  label = "Back",
  className = "",
}: {
  href?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const cls = `inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-500)] hover:text-[var(--color-primary-700)] transition-colors ${className}`;

  if (href) {
    return (
      <Link href={href} className={cls}>
        <ArrowLeft size={14} /> {label}
      </Link>
    );
  }

  return (
    <button onClick={() => router.back()} className={cls}>
      <ArrowLeft size={14} /> {label}
    </button>
  );
}
