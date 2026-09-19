"use client";

import { useEffect, useState } from "react";
import { User, X } from "lucide-react";

/**
 * The header avatar, clickable to view full size.
 *
 * Same lightbox shape used for investigation results and patient records
 * (fixed inset-0, z-[60], dimmed backdrop, click anywhere to dismiss), so the
 * behaviour matches everywhere a clinical image is opened.
 */
export function PatientPhoto({
  src,
  alt,
  statusDot,
}: {
  /** Resolved, auth-gated URL. Null renders the placeholder and stays inert. */
  src: string | null;
  alt: string;
  statusDot?: "active" | "closed" | null;
}) {
  const [open, setOpen] = useState(false);

  // Escape closes, matching the other lightboxes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => src && setOpen(true)}
          disabled={!src}
          aria-label={src ? `View ${alt}'s photo` : undefined}
          className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden ring-[3px] ring-sky-400/40 shadow-lg bg-sky-900/50 flex items-center justify-center ${
            src ? "cursor-zoom-in hover:ring-sky-300/70 transition-all" : "cursor-default"
          }`}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={alt} className="w-full h-full object-cover" />
          ) : (
            <User size={26} className="text-sky-300/70" />
          )}
        </button>
        {statusDot && (
          <span
            className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 shadow-sm pointer-events-none ${
              statusDot === "active" ? "bg-emerald-400 border-[#0D1F3C]" : "bg-slate-500 border-[#0D1F3C]"
            }`}
          />
        )}
      </div>

      {open && src && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80"
          role="dialog"
          aria-modal="true"
          aria-label={`${alt}'s photo`}
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X size={18} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
