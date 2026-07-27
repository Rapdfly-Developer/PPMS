import { requireRole } from "@/lib/rbac";
import { getWeeklyAvailability, getHospitalsForDoctor, getCalendarData } from "./actions";
import { AvailabilityClient } from "./AvailabilityClient";

export default async function AvailabilityPage() {
  await requireRole("DOCTOR");

  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  const [weekly, hospitals, initialCalendarData] = await Promise.all([
    getWeeklyAvailability(),
    getHospitalsForDoctor(),
    getCalendarData(year, month),
  ]);

  return (
    <AvailabilityClient
      weekly={weekly as any}
      hospitals={hospitals}
      initialCalendarData={initialCalendarData}
      initialYear={year}
      initialMonth={month}
    />
  );
}
