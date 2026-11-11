"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Paperclip, X } from "lucide-react";
import { fileHref } from "@/lib/file-href";
import type { ExtraResult } from "@/lib/investigation-extra-results";

/** Small preview of a report file added with "Add more", with its upload time. */
export function ExtraResultPreview({
  file, label, onOpen, onRemove,
}: {
  file: ExtraResult;
  label: string;
  onOpen: () => void;
  /** Omit to hide the remove button (read-only or frozen). */
  onRemove?: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const url = fileHref(file.ref)!;
  const isImage = /\.(jpg|jpeg|png|webp)$/i.test(file.ref);
  const isPdf = /\.pdf$/i.test(file.ref);

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="relative">
        {isImage ? (
          <img src={url} alt={label} className="max-h-52 rounded-lg cursor-pointer object-contain" onClick={onOpen} />
        ) : isPdf ? (
          <div className="relative h-52 w-40 overflow-hidden rounded-lg border border-[var(--color-border)]">
            <iframe src={`${url}#toolbar=0&navpanes=0`} title={label} className="h-full w-full pointer-events-none" />
            <button type="button" onClick={onOpen} aria-label="View report" className="absolute inset-0 cursor-pointer" />
          </div>
        ) : (
          <button
            onClick={onOpen}
            className="flex items-center gap-2 text-xs text-[var(--color-primary-700)] bg-[var(--color-primary-50)] border border-[var(--color-primary-200)] px-3 py-2 rounded-lg hover:bg-[var(--color-primary-100)] transition-colors"
          >
            <Paperclip size={13} /> {label}, click to view
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={() => {
              if (!confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 3500); return; }
              onRemove();
            }}
            title="Remove this file"
            aria-label="Remove this file"
            className={`absolute -top-1.5 -right-1.5 flex items-center gap-0.5 rounded-full border px-1 py-0.5 text-caption font-semibold shadow-sm transition-colors ${
              confirm
                ? "border-red-500 bg-red-500 text-white"
                : "border-[var(--color-border)] bg-white text-[var(--color-ink-400)] hover:border-red-300 hover:text-red-600"
            }`}
          >
            <X size={10} strokeWidth={2.5} />{confirm ? "Sure?" : ""}
          </button>
        )}
      </div>
      <span className="text-caption text-[var(--color-ink-400)]">Added {format(new Date(file.at), "dd MMM yyyy, h:mm a")}</span>
    </div>
  );
}
