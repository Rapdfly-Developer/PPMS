"use client";

import { isNativeShell } from "@/lib/open-pdf";

/**
 * Prints a same-origin print page without opening a new tab: the page loads in
 * a hidden frame and the browser's print dialog opens over the current screen.
 * In the Android shell (no in-page printing) it opens the page instead.
 */
export function printInPlace(url: string): void {
  if (typeof window === "undefined") return;
  const sep = url.includes("?") ? "&" : "?";
  const src = `${url}${sep}print=0`;
  if (isNativeShell()) { window.open(src, "_blank"); return; }

  document.getElementById("ppms-print-frame")?.remove();
  const frame = document.createElement("iframe");
  frame.id = "ppms-print-frame";
  frame.setAttribute("aria-hidden", "true");
  // Laid out at A4 width (off-screen) so the page renders as it will print
  Object.assign(frame.style, { position: "fixed", left: "-10000px", top: "0", width: "210mm", height: "297mm", border: "0", visibility: "hidden" });
  frame.onload = () => {
    // Give the page a moment to hydrate and load images (logo) before printing
    setTimeout(() => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        window.open(src, "_blank");
      }
      setTimeout(() => frame.remove(), 60_000);
    }, 900);
  };
  frame.src = src;
  document.body.appendChild(frame);
}
