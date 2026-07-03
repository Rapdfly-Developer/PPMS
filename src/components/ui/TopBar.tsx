"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search, LogOut, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function TopBar({ name, role }: { name: string; role: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) router.push(`/patients?q=${encodeURIComponent(q.trim())}`);
  };

  const initials = getInitials(name);

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-4 lg:px-6 bg-white border-b border-[var(--color-border)] z-10">
      {/* PPMS logo — mobile only (sidebar is hidden on small screens) */}
      <div className="flex items-center gap-2 lg:hidden">
        <div className="rounded-lg bg-[var(--color-primary-700)] p-1.5 text-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/>
          </svg>
        </div>
        <span className="text-sm font-bold text-[var(--color-ink-900)] tracking-tight">PPMS</span>
      </div>

      {/* Back + Search — desktop only */}
      <div className="hidden md:flex items-center gap-1">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center p-1.5 text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] rounded-lg hover:bg-[var(--color-surface-sunken)] transition-colors"
          title="Go back"
          aria-label="Go back"
        >
          <ArrowLeft size={17} />
        </button>

      <form onSubmit={handleSearch} className="flex items-center">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none"
          />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search patients, UHID..."
            className="w-56 pl-8 pr-10 py-1.5 text-sm bg-[var(--color-surface-sunken)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:bg-white transition-colors"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[var(--color-ink-400)] bg-white border border-[var(--color-border)] rounded px-1 py-0.5 pointer-events-none">
            ⌘K
          </kbd>
        </div>
      </form>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* Mobile search icon — navigates to patients search */}
        <button
          className="md:hidden p-1.5 text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] rounded-lg hover:bg-[var(--color-surface-sunken)] transition-colors"
          onClick={() => router.push("/patients")}
          title="Search patients"
          aria-label="Search patients"
        >
          <Search size={17} />
        </button>

        {/* Notifications */}
        <Link
          href="/notifications"
          title="Notifications"
          className="p-1.5 text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] rounded-lg hover:bg-[var(--color-surface-sunken)] transition-colors"
        >
          <Bell size={17} />
        </Link>

        {/* Divider */}
        <span className="hidden sm:block w-px h-5 bg-[var(--color-border)]" />

        {/* Avatar + name */}
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-full bg-[var(--color-primary-700)] flex items-center justify-center text-white text-xs font-bold select-none shrink-0">
            {initials}
          </div>
          <span className="hidden sm:block text-sm font-medium text-[var(--color-ink-800)]">{name}</span>
        </div>

        {/* Sign out */}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-1.5 text-sm text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] transition-colors"
          title="Sign out"
        >
          <LogOut size={15} />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
