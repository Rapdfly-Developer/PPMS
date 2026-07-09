"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ interval = 5000 }: { interval?: number }) {
  const router = useRouter();

  useEffect(() => {
    let id: ReturnType<typeof setInterval>;

    function start() {
      id = setInterval(() => {
        if (document.visibilityState === "visible") {
          router.refresh();
        }
      }, interval);
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        router.refresh(); // immediate refresh when tab regains focus
      }
    }

    start();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [router, interval]);

  return null;
}
