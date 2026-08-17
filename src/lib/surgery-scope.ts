/**
 * Who can see which surgical cases.
 *
 * The Counseling board, Scheduled OT and the counselling case page must all
 * agree — a case visible on one and hidden on another means a user clicks a row
 * and gets bounced. This is the single definition they all read.
 *
 * Doctors see every case at the hospitals they are linked to, not just the
 * visits they personally recorded, so a doctor can pick up a colleague's case
 * and act on it. Their own visits are always included as a fallback, so a
 * missing or deactivated hospital link never hides a doctor's own patients.
 */

import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/rbac";

export type SurgeryScope = {
  /** Filter for prisma.surgicalCounselling — `any` so it composes with spreads, as before. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  counsellingWhere: any;
  /** Filter for prisma.surgerySchedule */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scheduleWhere: any;
  /** Hospitals this user can see into. */
  hospitalIds: string[];
};

/** Hospitals a doctor is actively linked to, plus their own if the session carries one. */
async function doctorHospitalIds(user: SessionUser): Promise<string[]> {
  const links = await prisma.doctorHospitalLink.findMany({
    where: { doctorId: user.profileId, active: true },
    select: { hospitalId: true },
  });
  const ids = links.map((l) => l.hospitalId);
  if (user.hospitalId && !ids.includes(user.hospitalId)) ids.push(user.hospitalId);
  return ids;
}

export async function getSurgeryScope(user: SessionUser): Promise<SurgeryScope> {
  if (user.role === "DOCTOR") {
    const hospitalIds = await doctorHospitalIds(user);

    // An empty `in` list matches nothing rather than erroring, so the doctorId
    // branch alone still returns the doctor's own cases.
    return {
      hospitalIds,
      counsellingWhere: {
        OR: [
          { visit: { hospitalId: { in: hospitalIds } } },
          { visit: { doctorId: user.profileId } },
        ],
      },
      scheduleWhere: {
        OR: [
          { hospitalId: { in: hospitalIds } },
          { operatingSurgeonId: user.profileId },
        ],
      },
    };
  }

  /* ── Hospital staff and custom roles — unchanged from before ────────── */
  const linkedDoctors = await prisma.doctorHospitalLink.findMany({
    where: { hospitalId: user.hospitalId, active: true },
    select: { doctorId: true },
  });
  const doctorIds = linkedDoctors.map((l) => l.doctorId);

  return {
    hospitalIds: user.hospitalId ? [user.hospitalId] : [],
    counsellingWhere: {
      OR: [
        { visit: { hospitalId: user.hospitalId } },
        ...(doctorIds.length > 0 ? [{ visit: { doctorId: { in: doctorIds } } }] : []),
      ],
    },
    scheduleWhere: { hospitalId: user.hospitalId },
  };
}

/**
 * Whether a user may open one specific case. Mirrors getSurgeryScope so the
 * board and the case page never disagree.
 */
export async function canAccessCase(
  user: SessionUser,
  visit: { doctorId: string; hospitalId: string },
): Promise<boolean> {
  if (user.role === "DOCTOR") {
    if (visit.doctorId === user.profileId) return true;
    const hospitalIds = await doctorHospitalIds(user);
    return hospitalIds.includes(visit.hospitalId);
  }

  if (!user.hospitalId) return false;
  if (visit.hospitalId === user.hospitalId) return true;

  const linked = await prisma.doctorHospitalLink.findFirst({
    where: { hospitalId: user.hospitalId, doctorId: visit.doctorId, active: true },
    select: { id: true },
  });
  return linked !== null;
}
