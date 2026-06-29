"use client";

import { useTransition } from "react";
import { deletePatient } from "./actions";

export function DeletePatientButton({ patientId, patientName }: { patientId: string; patientName: string }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Delete patient "${patientName}"? This cannot be undone.`)) return;
    startTransition(() => deletePatient(patientId));
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="text-sm font-medium text-[var(--color-danger-600)] hover:text-[var(--color-danger-800)] disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
