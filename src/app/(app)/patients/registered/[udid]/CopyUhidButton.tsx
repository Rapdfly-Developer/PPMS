"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyUhidButton({ udid }: { udid: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(udid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-sm text-[var(--color-primary-600)] hover:text-[var(--color-primary-800)] font-medium transition-colors"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copied!" : "Copy UHID"}
    </button>
  );
}
