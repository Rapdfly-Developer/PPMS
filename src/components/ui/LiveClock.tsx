"use client";
import { useState, useEffect } from "react";
import { format } from "date-fns";

export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  return (
    <div className="text-right">
      <div className="text-3xl font-mono font-light tracking-tight text-white tabular-nums">
        {format(now, "hh:mm:ss aa").toLowerCase()}
      </div>
      <div className="text-sm text-slate-400 mt-1">
        {format(now, "EEEE, d MMMM yyyy")}
      </div>
    </div>
  );
}
