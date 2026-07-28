"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSidebar } from "./SidebarContext";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, Search, LogOut, ArrowLeft, Menu } from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";

const BACK_BTN_CLS =
  "group inline-flex items-center gap-1.5 h-8 pl-2 pr-3 rounded-lg border border-[var(--color-border)] bg-white text-sm font-medium text-[var(--color-ink-600)] hover:text-[var(--color-primary-700)] hover:border-[var(--color-primary-300)] hover:bg-[var(--color-primary-50)] active:scale-[0.97] transition-all duration-150";

const BackBtnContent = () => (
  <>
    <ArrowLeft size={15} className="transition-transform duration-150 group-hover:-translate-x-0.5" />
    Back
  </>
);

function TopBarBackBtn() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get("returnTo");

  if (returnTo) {
    return (
      <Link href={returnTo} className={BACK_BTN_CLS} title="Go back" aria-label="Go back">
        <BackBtnContent />
      </Link>
    );
  }

  return (
    <button onClick={() => router.back()} className={BACK_BTN_CLS} title="Go back" aria-label="Go back">
      <BackBtnContent />
    </button>
  );
}

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
  const { toggle } = useSidebar();

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
    <header className="h-14 shrink-0 flex items-center gap-2 px-4 lg:px-6 bg-white border-b border-[var(--color-border)] z-10">

      {/* Hamburger — mobile + tablet (hidden on desktop where sidebar is always visible) */}
      <button
        onClick={toggle}
        aria-label="Open menu"
        className="lg:hidden shrink-0 p-1.5 rounded-lg text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] hover:bg-[var(--color-surface-sunken)] transition-colors"
      >
        <Menu size={20} />
      </button>

      {/* Back + Search — all screen sizes */}
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <Suspense
          fallback={
            <span className={`${BACK_BTN_CLS} opacity-60 pointer-events-none shrink-0`}>
              <ArrowLeft size={15} /> Back
            </span>
          }
        >
          <TopBarBackBtn />
        </Suspense>

        <form onSubmit={handleSearch} className="flex items-center flex-1 min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none"
            />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search patients…"
              className="w-full pl-8 pr-3 lg:pr-10 py-1.5 text-sm bg-[var(--color-surface-sunken)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:bg-white transition-colors"
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[var(--color-ink-400)] bg-white border border-[var(--color-border)] rounded px-1 py-0.5 pointer-events-none hidden lg:block">
              ⌘K
            </kbd>
          </div>
        </form>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0">
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
