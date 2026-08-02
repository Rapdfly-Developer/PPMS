"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSidebar } from "./SidebarContext";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, Search, LogOut, ArrowLeft, Menu, Scissors } from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { markOneRead } from "@/app/(app)/notifications/actions";

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

type NotifItem = {
  id: string;
  message: string;
  type: string;
  entityId: string | null;
  createdAt: string;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function BellDropdown({ items, onRead }: {
  items: NotifItem[];
  onRead: (id: string) => void;
}) {
  const router = useRouter();

  return (
    <div
      className="absolute right-0 top-full mt-1 w-80 rounded-xl border border-[var(--color-border)] bg-white shadow-xl z-50 overflow-hidden"
      style={{ boxShadow: "0 8px 30px -8px rgba(0,0,0,0.18), 0 2px 8px -2px rgba(0,0,0,0.08)" }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <span className="text-sm font-semibold text-[var(--color-ink-800)]">Notifications</span>
        {items.length > 0 && (
          <span className="text-xs font-semibold text-red-500">{items.length} unread</span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <Bell size={20} className="mx-auto mb-2 text-[var(--color-ink-300)]" />
          <p className="text-sm text-[var(--color-ink-400)]">No new notifications</p>
        </div>
      ) : (
        <ul className="max-h-72 overflow-y-auto divide-y divide-[var(--color-border)]">
          {items.map((item) => (
            <li key={item.id}>
              <button
                className="w-full text-left px-4 py-3 hover:bg-[var(--color-surface-sunken)] transition-colors flex gap-3 items-start"
                onClick={async () => {
                  onRead(item.id);
                  await markOneRead(item.id);
                  router.push("/scheduled-ot");
                }}
              >
                <span className="mt-0.5 shrink-0 w-7 h-7 rounded-full bg-[var(--color-primary-50)] flex items-center justify-center">
                  <Scissors size={13} className="text-[var(--color-primary-600)]" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-[var(--color-ink-800)] leading-snug">{item.message}</span>
                  <span className="block text-xs text-[var(--color-ink-400)] mt-0.5">{timeAgo(item.createdAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="px-4 py-2.5 border-t border-[var(--color-border)]">
        <Link
          href="/notifications"
          className="text-xs font-medium text-[var(--color-primary-600)] hover:underline"
        >
          View all notifications →
        </Link>
      </div>
    </div>
  );
}

export function TopBar({ name, role }: { name: string; role: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [bellOpen, setBellOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifItems, setNotifItems] = useState<NotifItem[]>([]);
  const { toggle } = useSidebar();

  // Cmd+K shortcut
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

  // Poll for unread notifications
  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread");
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(data.count ?? 0);
      setNotifItems(data.items ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchUnread();
    const id = setInterval(fetchUnread, 30_000);
    return () => clearInterval(id);
  }, [fetchUnread]);

  // Click-outside to close dropdown
  useEffect(() => {
    if (!bellOpen) return;
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [bellOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) router.push(`/patients?q=${encodeURIComponent(q.trim())}`);
  };

  const handleMarkRead = (id: string) => {
    setNotifItems((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setBellOpen(false);
  };

  const initials = getInitials(name);

  return (
    <header className="h-14 shrink-0 flex items-center gap-2 px-4 lg:px-6 bg-white border-b border-[var(--color-border)] z-10">

      {/* Hamburger — mobile + tablet */}
      <button
        onClick={toggle}
        aria-label="Open menu"
        className="lg:hidden shrink-0 p-1.5 rounded-lg text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] hover:bg-[var(--color-surface-sunken)] transition-colors"
      >
        <Menu size={20} />
      </button>

      {/* Back + Search */}
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
        {/* Bell with dropdown */}
        <div ref={bellRef} className="relative">
          <button
            onClick={() => setBellOpen((v) => !v)}
            title="Notifications"
            aria-label="Notifications"
            className="relative p-1.5 text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] rounded-lg hover:bg-[var(--color-surface-sunken)] transition-colors"
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {bellOpen && (
            <BellDropdown items={notifItems} onRead={handleMarkRead} />
          )}
        </div>

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
