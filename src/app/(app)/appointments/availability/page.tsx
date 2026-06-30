import { requireRole } from "@/lib/rbac";
import { getAvailability, getHospitalsForDoctor } from "./actions";
import { AvailabilityClient } from "./AvailabilityClient";

export default async function AvailabilityPage() {
  await requireRole("DOCTOR");
  const [slots, hospitals] = await Promise.all([getAvailability(), getHospitalsForDoctor()]);
  return <AvailabilityClient slots={slots as any} hospitals={hospitals as any} />;
}
