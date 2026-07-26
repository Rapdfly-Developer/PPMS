import { requireRole } from "@/lib/rbac";
import {
  getWeeklyAvailability,
  getMonthlyAvailability,
  getIndividualDayAvailability,
  getLeaves,
  getHospitalsForDoctor,
} from "./actions";
import { AvailabilityClient } from "./AvailabilityClient";

export default async function AvailabilityPage() {
  await requireRole("DOCTOR");
  const [weekly, monthly, individualDays, leaves, hospitals] = await Promise.all([
    getWeeklyAvailability(),
    getMonthlyAvailability(),
    getIndividualDayAvailability(),
    getLeaves(),
    getHospitalsForDoctor(),
  ]);

  return (
    <AvailabilityClient
      weekly={weekly as any}
      monthly={monthly as any}
      individualDays={individualDays as any}
      leaves={leaves as any}
      hospitals={hospitals}
    />
  );
}
