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

    // Show web overlay for 3 seconds then fade out
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
        opacity: fading ? 0 : 1,
        transition: fading ? "opacity 0.6s ease" : "none",
        pointerEvents: "none",
      }}
    >
      <iframe
        src="/splash/RF_Health_Splash.html"
        title="RF Health"
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          border: "none",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
