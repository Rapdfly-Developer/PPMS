"use client";

import { motion } from "framer-motion";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Continue",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-[var(--color-ink-900)] mb-2">{title}</p>
        <p className="text-sm text-[var(--color-ink-500)] leading-relaxed mb-5">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
