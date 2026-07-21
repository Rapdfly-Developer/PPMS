"use client";

import { useEffect } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export function Toast({
  message,
  type = "success",
  onDone,
}: {
  message: string;
  type?: "success" | "error";
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2.5 px-4 py-2.5 rounded-2xl shadow-xl text-sm font-medium text-white whitespace-nowrap"
      style={{ background: type === "success" ? "#1e293b" : "#dc2626" }}
    >
      {type === "success"
        ? <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
        : <AlertCircle size={15} className="text-white shrink-0" />}
      {message}
    </motion.div>
  );
}
