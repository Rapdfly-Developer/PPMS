"use client";

import { useState } from "react";
import { requestAppointment } from "../appointments/actions";
import { TealSelect } from "@/components/ui/TealSelect";

export function RequestAppointmentButton({ patientId, hospitals, showHospitalSelect }: { patientId: string; hospitals: { id: string; name: string }[]; showHospitalSelect: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hospitalId, setHospitalId] = useState(hospitals[0]?.id ?? "");

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-[var(--color-primary-600)] font-medium hover:underline text-sm">
        Request Appointment
      </button>
    );
  }

  return (
    <div>
      <form
        action={async (formData) => {
          setError(null);
          const result = await requestAppointment(formData);
          if (result?.error) {
            setError(result.error);
          } else {
            setOpen(false);
          }
        }}
        className="flex items-center gap-2"
      >
        <input type="hidden" name="patientId" value={patientId} />
        {showHospitalSelect && (
          <>
            <TealSelect
              value={hospitalId}
              onChange={setHospitalId}
              options={hospitals.map((h) => ({ value: h.id, label: h.name }))}
              className="min-w-[120px]"
            />
            <input type="hidden" name="hospitalId" value={hospitalId} />
          </>
        )}
        <input type="datetime-local" name="dateTime" required className="text-xs rounded-lg border border-[var(--color-border)] px-2 py-1.5 bg-white" />
        <button type="submit" className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-[var(--color-primary-600)] text-white">Send</button>
        <button type="button" onClick={() => { setOpen(false); setError(null); }} className="text-xs text-[var(--color-ink-400)]">Cancel</button>
      </form>
      {error && (
        <p className="text-sm text-[var(--color-danger-600)] mt-1">{error}</p>
      )}
    </div>
  );
}
