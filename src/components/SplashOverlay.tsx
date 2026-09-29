"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

export function SplashOverlay() {
  // Start as visible so the overlay is in the initial server-rendered HTML —
  // it appears the instant the page paints, with zero JS delay.
  // useEffect then removes it immediately if we're not in a Capacitor native shell.
  const [show, setShow] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const isNative = window?.Capacitor?.isNativePlatform?.() === true;

    if (!isNative) {
      setShow(false);
      return;
    }

    try {
      if (sessionStorage.getItem("rf_splash_shown")) {
        setShow(false);
        return;
      }
      sessionStorage.setItem("rf_splash_shown", "1");
    } catch { /* ok */ }

    // Show for 3 seconds: fade starts at 2.5s, completes at 3s
    const t1 = setTimeout(() => setFading(true), 2500);
    const t2 = setTimeout(() => setShow(false), 3100);
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
        transition: fading ? "opacity 0.6s ease" : "none",
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
