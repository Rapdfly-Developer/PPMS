import { prisma } from "@/lib/prisma";
import { userCan, type SessionUser } from "@/lib/rbac";
import { tabsFor, type TabId } from "./definitions";

export interface NamedOption { id: string; name: string }

/**
 * What the signed-in user may see in analytics. Every service query is built
 * from this, so data outside the user's doctor/hospital never reaches a query
 * result — the analytics equivalent of row-level security.
 */
export interface AnalyticsScope {
  userId: string;
  role: string;
  kind: "doctor" | "hospital";
  /** Set for doctor scope; for hospital scope only when a doctor filter is applied. */
  doctorId?: string;
  hospitalIds: string[];
  hospitals: NamedOption[];
  doctors: NamedOption[];
  visitTypes: string[];
  label: string;
  canViewPatients: boolean;
  canViewClinical: boolean;
  canViewInvestigations: boolean;
  canAudit: boolean;
  canExport: boolean;
  tabs: TabId[];
}

export async function resolveScope(user: SessionUser): Promise<AnalyticsScope | null> {
  const isDoctor = user.role === "DOCTOR";
  const doctorId = isDoctor ? user.profileId : !user.hospitalId ? user.doctorId : undefined;

  let kind: "doctor" | "hospital";
  let hospitals: NamedOption[];
  let doctors: NamedOption[];
  let label: string;

  if (doctorId) {
    kind = "doctor";
    const [doctor, links] = await Promise.all([
      prisma.doctor.findUnique({ where: { id: doctorId }, select: { id: true, name: true } }),
      prisma.doctorHospitalLink.findMany({
        where: { doctorId },
        select: { hospital: { select: { id: true, name: true } } },
        orderBy: { hospital: { name: "asc" } },
      }),
    ]);
    if (!doctor) return null;
    hospitals = links.map((l) => l.hospital);
    doctors = [doctor];
    label = "your practice";
  } else if (user.hospitalId) {
    kind = "hospital";
    const [hospital, links] = await Promise.all([
      prisma.hospital.findUnique({ where: { id: user.hospitalId }, select: { id: true, name: true } }),
      prisma.doctorHospitalLink.findMany({
        where: { hospitalId: user.hospitalId },
        select: { doctor: { select: { id: true, name: true } } },
        orderBy: { doctor: { name: "asc" } },
      }),
    ]);
    if (!hospital) return null;
    hospitals = [hospital];
    doctors = links.map((l) => l.doctor);
    label = hospital.name;
  } else {
    return null;
  }

  const hospitalIds = hospitals.map((h) => h.id);
  const typeRows = await prisma.appointment.groupBy({
    by: ["visitType"],
    where: kind === "doctor" ? { doctorId } : { hospitalId: { in: hospitalIds } },
    _count: { visitType: true },
    orderBy: { _count: { visitType: "desc" } },
    take: 20,
  });

  const flags = {
    canViewPatients: userCan(user, "patients.view"),
    canViewClinical: userCan(user, "emr.view"),
    canViewInvestigations: userCan(user, "investigations.view") || userCan(user, "emr.view"),
    // Audit and staff activity stay with practice owners / hospital admins.
    canAudit: user.role === "DOCTOR" || user.role === "HOSPITAL",
  };

  return {
    userId: user.id,
    role: user.role,
    kind,
    doctorId,
    hospitalIds,
    hospitals,
    doctors,
    visitTypes: typeRows.map((t) => t.visitType).filter(Boolean),
    label,
    ...flags,
    canExport: userCan(user, "reports.export"),
    tabs: tabsFor(flags),
  };
}

/** User ids belonging to the scope: the doctor's own account plus staff at the scoped hospitals. */
export async function scopeUserIds(scope: AnalyticsScope): Promise<{ ids: string[]; roleById: Map<string, string> }> {
  const [doctorUser, staff, refractionists] = await Promise.all([
    scope.kind === "doctor" && scope.doctorId
      ? prisma.doctor.findUnique({ where: { id: scope.doctorId }, select: { user: { select: { id: true, role: true } } } })
      : Promise.resolve(null),
    prisma.hospitalStaff.findMany({
      where: { hospitalId: { in: scope.hospitalIds } },
      select: { user: { select: { id: true, role: true } } },
    }),
    prisma.refractionist.findMany({
      where: scope.kind === "doctor"
        ? { OR: [{ doctorId: scope.doctorId }, { hospitalId: { in: scope.hospitalIds } }] }
        : { hospitalId: { in: scope.hospitalIds } },
      select: { user: { select: { id: true, role: true } } },
    }),
  ]);

  const roleById = new Map<string, string>();
  if (doctorUser?.user) roleById.set(doctorUser.user.id, doctorUser.user.role);
  for (const s of staff) roleById.set(s.user.id, s.user.role);
  for (const r of refractionists) roleById.set(r.user.id, r.user.role);
  return { ids: [...roleById.keys()], roleById };
}
