"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

export function SplashOverlay() {
  const [show, setShow] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!window?.Capacitor?.isNativePlatform?.()) return;

    try {
      if (sessionStorage.getItem("rf_splash_shown")) return;
      sessionStorage.setItem("rf_splash_shown", "1");
    } catch { /* ok */ }

    setShow(true);

    const t1 = setTimeout(() => setFading(true), 1700);
    const t2 = setTimeout(() => setShow(false), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!show) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        backgroundColor: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "24px",
        opacity: fading ? 0 : 1,
        transition: fading ? "opacity 0.4s ease" : "none",
        pointerEvents: "none",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/landing/logo-rf-health.webp"
        alt=""
        width={110}
        height={110}
        style={{ display: "block" }}
      />
      <div style={{ textAlign: "center" }}>
        <p style={{
          margin: 0,
          fontSize: 26,
          fontWeight: 700,
          color: "#041A18",
          letterSpacing: "-0.3px",
          fontFamily: "var(--font-inter, system-ui, -apple-system, sans-serif)",
          lineHeight: 1.2,
        }}>
          RF Health
        </p>
        <p style={{
          margin: "8px 0 0",
          fontSize: 11,
          fontWeight: 500,
          color: "#9CA3AF",
          letterSpacing: "1px",
          textTransform: "uppercase",
          fontFamily: "var(--font-inter, system-ui, -apple-system, sans-serif)",
        }}>
          A Product of RAPDFLY
        </p>
      </div>
    </div>
  );
}
