"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSidebar } from "./SidebarContext";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, Search, LogOut, ArrowLeft, Menu } from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { markAllRead, markOneRead } from "@/app/(app)/notifications/actions";
import { searchPatientsAutocomplete, type PatientSearchResult } from "@/app/(app)/patients/actions";
import { formatComplaintDisplay } from "@/lib/appointment-cc";

const BACK_BTN_CLS =
  "group inline-flex items-center gap-1.5 h-8 pl-3 pr-3 sm:pl-2 sm:pr-3 rounded-lg border border-[var(--color-border)] bg-white text-label sm:text-sm font-medium text-[var(--color-ink-600)] hover:text-[var(--color-primary-700)] hover:border-[var(--color-primary-300)] hover:bg-[var(--color-primary-50)] active:scale-[0.97] transition-all duration-150";

const BackBtnContent = () => (
  <>
    <ArrowLeft size={15} className="transition-transform duration-150 group-hover:-translate-x-0.5" />
    {/* Icon-only below sm so the search field gets the width back. The button
        already carries title/aria-label="Go back", so nothing is lost for
        screen readers or tooltips. */}
    <span className="hidden sm:inline">Back</span>
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

function BellDropdown({ items, onRead, onMarkAll, dropdownRef, style }: {
  items: NotifItem[];
  onRead: (id: string) => void;
  onMarkAll: () => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  style: React.CSSProperties;
}) {
  const router = useRouter();

  return (
    <div
      ref={dropdownRef}
      className="w-[min(320px,calc(100vw-1rem))] rounded-xl border border-[var(--color-border)] bg-white overflow-hidden"
      style={{
        position: "fixed",
        zIndex: 400,
        boxShadow: "0 8px 30px -8px rgba(0,0,0,0.18), 0 2px 8px -2px rgba(0,0,0,0.08)",
        ...style,
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <span className="text-caption sm:text-sm font-semibold text-[var(--color-ink-800)]">Notifications</span>
        {items.length > 0 && (
          <span className="text-caption sm:text-xs font-semibold text-red-500">{items.length} unread</span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <Bell size={20} className="mx-auto mb-2 text-[var(--color-ink-300)]" />
          <p className="text-caption sm:text-sm text-[var(--color-ink-400)]">No new notifications</p>
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
                  router.push("/notifications");
                }}
              >
                <span className="mt-0.5 shrink-0 w-7 h-7 rounded-full bg-[var(--color-primary-50)] flex items-center justify-center">
                  <Bell size={13} className="text-[var(--color-primary-600)]" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-caption sm:text-sm text-[var(--color-ink-800)] leading-snug">{item.message}</span>
                  <span className="block text-caption sm:text-xs text-[var(--color-ink-400)] mt-0.5">{timeAgo(item.createdAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="px-4 py-2.5 border-t border-[var(--color-border)] flex items-center justify-between gap-2">
        <Link
          href="/notifications"
          className="text-caption sm:text-xs font-medium text-[var(--color-primary-600)] hover:underline"
        >
          View all notifications →
        </Link>
        {items.length > 0 && (
          <button
            onClick={onMarkAll}
            className="text-caption sm:text-xs font-medium text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>
    </div>
  );
}

export function TopBar({ name, role }: { name: string; role: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [bellOpen, setBellOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifItems, setNotifItems] = useState<NotifItem[]>([]);
  const { toggle, collapsed, toggleCollapsed } = useSidebar();

  // Autocomplete state
  const [acResults, setAcResults] = useState<PatientSearchResult[]>([]);
  const [acOpen, setAcOpen] = useState(false);
  const [acLoading, setAcLoading] = useState(false);
  const [acIndex, setAcIndex] = useState(-1);
  const genRef = useRef(0);

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

  // Fetch unread notifications — polled every 5 min (was 30s → 10× reduction).
  // Tab re-focus triggers an immediate catch-up so users see fresh counts when
  // they return to the app without waiting for the next scheduled tick.
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
    const id = setInterval(fetchUnread, 600_000); // 10 minutes

    function handleVisibility() {
      if (document.visibilityState === "visible") fetchUnread();
    }
    async function handleRefresh() {
      // Bypass 60s browser cache so badge clears immediately after mark-read
      try {
        const res = await fetch("/api/notifications/unread", { cache: "reload" });
        if (!res.ok) return;
        const data = await res.json();
        setUnreadCount(data.count ?? 0);
        setNotifItems(data.items ?? []);
      } catch {}
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("notifications:refresh", handleRefresh);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("notifications:refresh", handleRefresh);
    };
  }, [fetchUnread]);

  // Click-outside to close dropdown (check both the bell button and the portal)
  useEffect(() => {
    if (!bellOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inBell = bellRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inBell && !inDropdown) setBellOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [bellOpen]);

  // Debounced autocomplete
  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setAcResults([]);
      setAcOpen(false);
      setAcLoading(false);
      return;
    }
    setAcLoading(true);
    const gen = ++genRef.current;
    const id = setTimeout(async () => {
      try {
        const results = await searchPatientsAutocomplete(trimmed);
        if (gen !== genRef.current) return;
        setAcResults(results);
        setAcOpen(true);
        setAcIndex(-1);
      } catch {
        if (gen !== genRef.current) return;
        setAcResults([]);
      } finally {
        if (gen === genRef.current) setAcLoading(false);
      }
    }, 300);
    return () => { clearTimeout(id); genRef.current++; };
  }, [q]);

  // Click-outside to close autocomplete
  useEffect(() => {
    if (!acOpen) return;
    const handler = (e: MouseEvent) => {
      if (!searchContainerRef.current?.contains(e.target as Node)) {
        setAcOpen(false);
        setAcIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [acOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const highlighted = acIndex >= 0 ? acResults[acIndex] : null;
    if (highlighted) {
      setAcOpen(false);
      router.push(highlighted.visitId
        ? `/emr/${highlighted.udid}?visit=${highlighted.visitId}`
        : `/patients/${highlighted.udid}`);
    } else if (q.trim()) {
      setAcOpen(false);
      router.push(`/patients?q=${encodeURIComponent(q.trim())}`);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!acOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAcIndex((i) => Math.min(i + 1, acResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAcIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setAcOpen(false);
      setAcIndex(-1);
    }
  };

  const handleMarkRead = (id: string) => {
    setNotifItems((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setBellOpen(false);
  };

  const handleMarkAll = async () => {
    setNotifItems([]);
    setUnreadCount(0);
    setBellOpen(false);
    await markAllRead();
  };

  const initials = getInitials(name);

  return (
    <header
      className="shrink-0 flex items-center gap-2 px-4 lg:px-6 bg-white border-b border-[var(--color-border)] z-30 relative"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)", minHeight: "calc(var(--rf-header-h) + env(safe-area-inset-top, 0px))" }}
    >

      {/* Hamburger — mobile + tablet (≤1024px) */}
      <button
        onClick={toggle}
        aria-label="Open menu"
        className="min-[1025px]:hidden shrink-0 p-2.5 -ml-1.5 rounded-lg text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] hover:bg-[var(--color-surface-sunken)] transition-colors"
      >
        <Menu size={20} />
      </button>

      {/* Sidebar collapse — desktop only */}
      <button
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden min-[1025px]:flex shrink-0 p-1.5 rounded-lg text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] hover:bg-[var(--color-surface-sunken)] transition-colors"
      >
        <Menu size={20} />
      </button>

      {/* Back + Search */}
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <Suspense
          fallback={
            <span className={`${BACK_BTN_CLS} opacity-60 pointer-events-none shrink-0`}>
              <ArrowLeft size={15} /> <span className="hidden sm:inline">Back</span>
            </span>
          }
        >
          <TopBarBackBtn />
        </Suspense>

        <form onSubmit={handleSearch} className="flex items-center flex-1 min-w-0">
          <div ref={searchContainerRef} className="relative flex-1 min-w-0">
            {acLoading ? (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="animate-spin w-3 h-3 sm:w-3.5 sm:h-3.5 text-[var(--color-primary-500)]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              </span>
            ) : (
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none sm:w-3.5 sm:h-3.5 w-3 h-3" />
            )}
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => { if (acResults.length > 0) setAcOpen(true); }}
              placeholder="Search patients, visits, complaints or diagnoses…"
              aria-label="Universal search"
              aria-autocomplete="list"
              aria-expanded={acOpen}
              aria-activedescendant={acIndex >= 0 ? `ac-item-${acIndex}` : undefined}
              className="w-full pl-8 pr-3 lg:pr-10 py-1 sm:py-1.5 text-caption placeholder:text-caption sm:text-sm sm:placeholder:text-sm bg-[var(--color-surface-sunken)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:bg-white transition-colors"
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-caption font-medium text-[var(--color-ink-400)] bg-white border border-[var(--color-border)] rounded px-1 py-0.5 pointer-events-none hidden lg:block">
              ⌘K
            </kbd>

            {/* Autocomplete dropdown */}
            {acOpen && acResults.length > 0 && (
              <ul
                role="listbox"
                className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-xl border border-[var(--color-border)] overflow-hidden"
                style={{ boxShadow: "0 8px 30px -8px rgba(0,0,0,0.18), 0 2px 8px -2px rgba(0,0,0,0.08)" }}
              >
                {acResults.map((r, i) => (
                  <li
                    key={r.udid}
                    id={`ac-item-${i}`}
                    role="option"
                    aria-selected={i === acIndex}
                  >
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setAcOpen(false);
                        router.push(r.visitId
                          ? `/emr/${r.udid}?visit=${r.visitId}`
                          : `/patients/${r.udid}`);
                      }}
                      className={`w-full text-left px-3 py-2 flex flex-col gap-0.5 transition-colors ${
                        i === acIndex
                          ? "bg-[var(--color-primary-50)]"
                          : "hover:bg-[var(--color-surface-sunken)]"
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-caption sm:text-sm font-semibold text-[var(--color-ink-800)] truncate">{r.name}</span>
                        <span className="text-caption sm:text-xs text-[var(--color-ink-400)] shrink-0">{r.udid}</span>
                        <span className="text-caption sm:text-xs text-[var(--color-ink-400)] shrink-0 hidden sm:inline">{r.mobile}</span>
                      </span>
                      {r.matchText && (r.matchType === "complaint" || r.matchType === "diagnosis") && (
                        <span className={`${r.matchType === "diagnosis" ? "clinical-diagnosis-text" : "clinical-complaint-text"} text-caption sm:text-xs truncate`}>
                          {r.matchType === "diagnosis" ? `Dx: ${r.matchText}` : `CC: ${formatComplaintDisplay(r.matchText)}`}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {acOpen && !acLoading && q.trim().length >= 2 && acResults.length === 0 && (
              <div
                className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-xl border border-[var(--color-border)] px-3 py-4 text-center text-caption sm:text-xs text-[var(--color-ink-400)]"
                style={{ boxShadow: "0 8px 30px -8px rgba(0,0,0,0.18)" }}
              >
                No patients found for "{q.trim()}"
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Bell with dropdown */}
        <div ref={bellRef}>
          <button
            onClick={() => {
              if (!bellOpen && bellRef.current) {
                const rect = bellRef.current.getBoundingClientRect();
                setDropdownStyle({
                  top: rect.bottom + 4,
                  right: 8,
                });
              }
              setBellOpen((v) => !v);
            }}
            title="Notifications"
            aria-label="Notifications"
            className="relative p-2.5 sm:p-1.5 text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] rounded-lg hover:bg-[var(--color-surface-sunken)] transition-colors"
          >
            <Bell size={17} className="w-[18px] h-[18px] sm:w-[17px] sm:h-[17px]" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 flex items-center justify-center rounded-full bg-red-500 text-white text-micro sm:text-caption font-bold px-1 leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {bellOpen && createPortal(
            <BellDropdown items={notifItems} onRead={handleMarkRead} onMarkAll={handleMarkAll} dropdownRef={dropdownRef} style={dropdownStyle} />,
            document.body
          )}
        </div>

        {/* Divider */}
        <span className="hidden sm:block w-px h-5 bg-[var(--color-border)]" />

        {/* Avatar + name */}
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-full bg-[var(--color-primary-700)] flex items-center justify-center text-white text-xs font-bold select-none shrink-0">
            {initials}
          </div>
          <span className="hidden sm:block text-label sm:text-sm font-medium text-[var(--color-ink-800)]">{role === "DOCTOR" ? `Dr. ${name}` : name}</span>
        </div>

        {/* Sign out */}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          aria-label="Sign out"
          className="flex items-center justify-center gap-1.5 min-h-10 min-w-10 -mr-2 sm:mr-0 sm:min-h-0 sm:min-w-0 rounded-lg text-label sm:text-sm text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)] transition-colors"
          title="Sign out"
        >
          <LogOut size={15} />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
