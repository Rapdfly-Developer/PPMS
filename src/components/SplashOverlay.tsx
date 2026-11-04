"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

export function SplashOverlay() {
  const [show, setShow] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const isNative = window?.Capacitor?.isNativePlatform?.() === true;

    if (!isNative) {
      setShow(false);
      return;
    }

    // Dismiss the native Capacitor splash immediately now that the web page
    // has painted — our overlay takes over from here with zero gap.
    import("@capacitor/splash-screen")
      .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 0 }))
      .catch(() => {});

    try {
      if (sessionStorage.getItem("rf_splash_shown")) {
        setShow(false);
        return;
      }
      sessionStorage.setItem("rf_splash_shown", "1");
    } catch { /* ok */ }

    // Show the logo for ~2.5 seconds then fade out
    const t1 = setTimeout(() => setFading(true), 2500);
    const t2 = setTimeout(() => setShow(false), 3100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!show) return null;

  return (
    <div
      aria-hidden
      className="rf-splash"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        backgroundColor: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
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
    </div>
  );
}
