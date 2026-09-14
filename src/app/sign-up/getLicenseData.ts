// Plain async helper — no "use server" so the server component can call it
// directly during render without going through the action boundary.
//
// The DOCTOR is the licensee: orgId (ppms_org cookie) holds the doctor id.

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getLicenseForDoctor, doctorIdForHospital } from "@/lib/license";

const ORG_COOKIE = "ppms_org";

export interface LicensePageData {
  orgId: string | null;        // licensee doctor id
  orgName: string | null;      // "Dr. <name>"
  licenseKey: string | null;
  status: string;
  daysRemaining: number;
  trialStartDate: string | null;
  trialEndDate: string | null;
  activationDate: string | null;
  expiryDate: string | null;
  plan: string | null;
}

export interface ActivationPageData extends LicensePageData {
  hospitalName: string | null;
  orgShortId: string | null;
  adminName: string | null;
  adminEmail: string | null;
  adminPhone: string | null;
  deviceName: string | null;
  lastVerifiedAt: string | null;
  serverOnline: boolean;
  events: {
    id: string;
    date: string;
    action: string;
    keyMasked: string | null;
    performedBy: string | null;
    status: string;
  }[];
}

/** Resolve the licensee doctor id from the cookie; tolerates legacy cookies
 *  that stored a hospital id from the previous per-hospital license model. */
async function resolveDoctorId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(ORG_COOKIE)?.value ?? null;
  if (!raw) return null;

  const doctor = await prisma.doctor.findUnique({ where: { id: raw }, select: { id: true } }).catch(() => null);
  if (doctor) return doctor.id;

  // Legacy cookie: hospital id → its doctor
  return doctorIdForHospital(raw).catch(() => null);
}

export async function getLicenseData(overrideDoctorId?: string): Promise<LicensePageData> {
  const doctorId = overrideDoctorId ?? await resolveDoctorId();

  const empty: LicensePageData = {
    orgId: null, orgName: null, licenseKey: null,
    status: "NO_LICENSE", daysRemaining: 0,
    trialStartDate: null, trialEndDate: null,
    activationDate: null, expiryDate: null, plan: null,
  };

  if (!doctorId) return empty;

  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: { name: true, license: true },
  }).catch(() => null);

  if (!doctor) return empty;

  const info = await getLicenseForDoctor(doctorId);

  return {
    orgId: doctorId,
    orgName: `Dr. ${doctor.name}`,
    licenseKey: doctor.license?.licenseKey ?? null,
    status: info.status,
    daysRemaining: info.daysRemaining,
    trialStartDate: doctor.license?.trialStartsAt?.toISOString() ?? null,
    trialEndDate: info.trialEndsAt?.toISOString() ?? null,
    activationDate: doctor.license?.subscriptionStartsAt?.toISOString() ?? null,
    expiryDate: info.subscriptionEndsAt?.toISOString() ?? null,
    plan: info.plan,
  };
}

export async function getActivationData(): Promise<ActivationPageData> {
  const base = await getLicenseData();

  const empty: ActivationPageData = {
    ...base,
    hospitalName: null, orgShortId: null,
    adminName: null, adminEmail: null, adminPhone: null,
    deviceName: null, lastVerifiedAt: null,
    serverOnline: true, events: [],
  };

  if (!base.orgId) return empty;

  try {
    const [doctor, license, events] = await Promise.all([
      prisma.doctor.findUnique({
        where: { id: base.orgId },
        select: {
          name: true, email: true, contact: true,
          hospitalLinks: {
            where: { active: true },
            take: 1,
            select: { hospital: { select: { name: true } } },
          },
        },
      }),
      prisma.tenantLicense.findUnique({
        where: { doctorId: base.orgId },
        select: { deviceName: true, lastVerifiedAt: true },
      }),
      prisma.licenseEvent.findMany({
        where: { doctorId: base.orgId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    return {
      ...base,
      hospitalName: doctor?.hospitalLinks[0]?.hospital.name ?? null,
      orgShortId: base.orgId.slice(-8).toUpperCase(),
      adminName: doctor ? `Dr. ${doctor.name}` : null,
      adminEmail: doctor?.email ?? null,
      adminPhone: doctor?.contact ?? null,
      deviceName: license?.deviceName ?? null,
      lastVerifiedAt: license?.lastVerifiedAt?.toISOString() ?? null,
      serverOnline: true,
      events: events.map((e) => ({
        id: e.id,
        date: e.createdAt.toISOString(),
        action: e.action,
        keyMasked: e.keyMasked,
        performedBy: e.performedBy,
        status: e.status,
      })),
    };
  } catch {
    return { ...empty, serverOnline: false };
  }
}
