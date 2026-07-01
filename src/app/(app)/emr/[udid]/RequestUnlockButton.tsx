"use client";

import { useState } from "react";

export function RequestUnlockButton() {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <span className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700">
        Request sent ✓
      </span>
    );
  }

  return (
    <button
      onClick={() => setSent(true)}
      className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors"
    >
      Request Unlock
    </button>
  );
}
