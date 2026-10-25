import { requireRole } from "@/lib/rbac";
import { getWeeklyAvailability, getHospitalsForDoctor, getCalendarData } from "../appointments/availability/actions";
import { AvailabilityClient } from "../appointments/availability/AvailabilityClient";
import { istTodayStr } from "@/lib/ist";

export default async function HospitalManagerPage() {
  await requireRole("DOCTOR");

  // Current month in IST, not the server's timezone
  const [year, month] = istTodayStr().split("-").map(Number);

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
