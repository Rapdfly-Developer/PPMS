"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Stethoscope } from "lucide-react";
import { startVisit } from "./actions";

export function StartVisitButton({
  patientId,
  appointmentId,
  udid,
}: {
  patientId: string;
  appointmentId: string;
  udid: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await startVisit(patientId, appointmentId, udid);
      if (result?.visitId) {
        router.push(`/emr/${udid}?visit=${result.visitId}`);
        router.refresh();
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-2 bg-[var(--color-primary-600)] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors"
    >
      <Stethoscope size={15} />
      {pending ? "Starting Visit…" : "Start Visit"}
    </button>
  );
}
