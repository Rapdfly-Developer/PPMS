// ── LicenseGuard — single source of truth for license enforcement ───────────
//
// Runs BEFORE authentication (login page / login action) and before every
// protected route (via requireUser in rbac.ts). Validation order per spec:
//
//   1. License exists          → NONE
//   2. Integrity (signature)   → INVALID
//   3. Machine ID match        → MISMATCH   (pre-login, on the licensed device)
//   4. Suspended / deactivated → SUSPENDED
//   5. Expiry                  → EXPIRED
//   6. Otherwise               → ACTIVE (Trial or Professional)
//
// The DOCTOR is the licensee. Pre-login the licensee is resolved from the
// ppms_org cookie; post-login from the session user's doctor/hospital link.

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { doctorIdForHospital } from "@/lib/license";
import {
  computeLicenseSignature,
  resignLicense,
  type SignableLicense,
} from "@/lib/license-sign";
import type { SessionUser } from "@/lib/rbac";

const ORG_COOKIE = "ppms_org";
const MID_COOKIE = "ppms_mid";

export type GuardStatus =
  | "ACTIVE"    // valid license or trial — login allowed
  | "NONE"      // no license activated
  | "EXPIRED"   // trial or subscription ended
  | "INVALID"   // signature check failed (corrupted / modified)
  | "MISMATCH"  // license belongs to another machine
  | "SUSPENDED"; // isActive = false (revoked / deactivated)

export interface LicenseGuardResult {
  status: GuardStatus;
  allowLogin: boolean;
  licenseType: "Trial" | "Professional" | null;
  expiryDate: string | null; // ISO
  remainingDays: number;
  machineMatched: boolean;
  features: string[];
  message: string;
}

const FEATURES = ["EMR", "Appointments", "Billing"];

type LicenseRecord = SignableLicense & { signature: string | null };

// ── Core evaluation ──────────────────────────────────────────────────────────

function blocked(status: GuardStatus, message: string, extra?: Partial<LicenseGuardResult>): LicenseGuardResult {
  return {
    status,
    allowLogin: false,
    licenseType: null,
    expiryDate: null,
    remainingDays: 0,
    machineMatched: true,
    features: [],
    message,
    ...extra,
  };
}

async function evaluate(
  license: LicenseRecord | null,
  machineIdCookie: string | null,
  opts: { enforceMachine: boolean },
): Promise<LicenseGuardResult> {
  // 1. License exists
  if (!license) {
    return blocked("NONE", "No license has been activated. Please activate your PPMS license to continue.");
  }

  // 2. Integrity — unsigned legacy records are signed on first sight;
  //    a present-but-wrong signature means the row was modified out of band.
  if (license.signature === null) {
    await resignLicense(license.doctorId).catch(() => {});
  } else if (license.signature !== computeLicenseSignature(license)) {
    return blocked("INVALID", "License verification failed. Your license appears to be corrupted or modified. Please reactivate your license.");
  }

  // 3. Machine binding — only meaningful on the device that activated
  //    (staff log in from their own machines and are gated by expiry/status).
  const machineMatched = !license.machineId || !opts.enforceMachine
    ? true
    : license.machineId === machineIdCookie;
  if (!machineMatched) {
    return blocked("MISMATCH", "This license belongs to another device. Please contact your administrator or reactivate your license.", { machineMatched: false });
  }

  // 4. Suspended / revoked / deactivated
  if (!license.isActive) {
    return blocked("SUSPENDED", "This license has been suspended or deactivated. Please contact support.");
  }

  // 5. Expiry — check active subscription or active trial; block otherwise.
  const now = new Date();

  if (license.subscriptionEndsAt && license.subscriptionEndsAt > now) {
    const days = Math.ceil((license.subscriptionEndsAt.getTime() - now.getTime()) / 86_400_000);
    return {
      status: "ACTIVE",
      allowLogin: true,
      licenseType: "Professional",
      expiryDate: license.subscriptionEndsAt.toISOString(),
      remainingDays: days,
      machineMatched,
      features: FEATURES,
      message: "License active.",
    };
  }

  if (!license.licenseKey && license.trialEndsAt && license.trialEndsAt > now) {
    const days = Math.ceil((license.trialEndsAt.getTime() - now.getTime()) / 86_400_000);
    return {
      status: "ACTIVE",
      allowLogin: true,
      licenseType: "Trial",
      expiryDate: license.trialEndsAt.toISOString(),
      remainingDays: days,
      machineMatched,
      features: FEATURES,
      message: "Trial license active.",
    };
  }

  if (!license.licenseKey) {
    return blocked("NONE", "A license key is required to log in. Please activate your PPMS license to continue.");
  }

  const expiredOn = license.subscriptionEndsAt ?? license.trialEndsAt;
  return blocked("EXPIRED", `Your license expired on ${expiredOn.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}. Please renew your license.`, {
    expiryDate: expiredOn.toISOString(),
  });
}

// ── Entry points ─────────────────────────────────────────────────────────────

/** Pre-login check: licensee resolved from the ppms_org cookie, machine
 *  binding enforced against the ppms_mid cookie. */
export async function checkLicenseFromCookies(): Promise<LicenseGuardResult> {
  const jar = await cookies();
  const orgId = jar.get(ORG_COOKIE)?.value ?? null;
  const machineId = jar.get(MID_COOKIE)?.value ?? null;

  if (!orgId) return evaluate(null, machineId, { enforceMachine: true });

  // A DB failure must not read as "no license" — fail closed with an honest
  // message so a transient outage never looks like a missing activation.
  let license: LicenseRecord | null;
  try {
    license = await prisma.tenantLicense.findUnique({ where: { doctorId: orgId } });
  } catch {
    return blocked("NONE", "Unable to verify your license right now. Please check your connection and try again.");
  }
  return evaluate(license, machineId, { enforceMachine: true });
}

/** Pre-login check by username: resolves the licensee doctor for the account
 *  being signed in and validates THAT doctor's license — works on any device,
 *  unlike the cookie-based check which only knows the activation browser. */
export async function checkLicenseForLogin(username: string): Promise<LicenseGuardResult | null> {
  let user;
  try {
    user = await prisma.user.findUnique({
      where: { username },
      select: {
        doctor: { select: { id: true } },
        refractionist: { select: { doctorId: true, hospitalId: true } },
        hospitalStaff: { select: { hospitalId: true } },
      },
    });
  } catch {
    return blocked("NONE", "Unable to verify your license right now. Please check your connection and try again.");
  }
  // Unknown username — let signIn report invalid credentials instead of
  // leaking whether the account exists via a license message.
  if (!user) return null;

  let doctorId = user.doctor?.id ?? user.refractionist?.doctorId ?? null;
  if (!doctorId) {
    const hospitalId = user.hospitalStaff?.hospitalId ?? user.refractionist?.hospitalId ?? null;
    doctorId = hospitalId ? await doctorIdForHospital(hospitalId).catch(() => null) : null;
  }
  if (!doctorId) return null; // no license context resolvable — do not block

  let license: LicenseRecord | null;
  try {
    license = await prisma.tenantLicense.findUnique({ where: { doctorId } });
  } catch {
    return blocked("NONE", "Unable to verify your license right now. Please check your connection and try again.");
  }
  return evaluate(license, null, { enforceMachine: false });
}

// user id → licensee doctor id. Hospital links rarely change; a short TTL
// keeps the guard down to a single (cached) license query per request.
const doctorIdCache = new Map<string, { at: number; doctorId: string | null }>();
const DOCTOR_ID_TTL_MS = 5 * 60_000;

/** Resolve the licensee doctor for a logged-in user. */
export async function licenseeDoctorIdForUser(user: SessionUser): Promise<string | null> {
  if (user.role === "DOCTOR") return user.profileId;
  if (user.doctorId) return user.doctorId;

  const hit = doctorIdCache.get(user.id);
  if (hit && Date.now() - hit.at < DOCTOR_ID_TTL_MS) return hit.doctorId;

  let hospitalId: string | null = user.hospitalId ?? null;
  if (!hospitalId) {
    if (user.role === "REFRACTIONIST") {
      const ref = await prisma.refractionist.findUnique({
        where: { userId: user.id },
        select: { hospitalId: true },
      }).catch(() => null);
      hospitalId = ref?.hospitalId ?? null;
    } else {
      const staff = await prisma.hospitalStaff.findUnique({
        where: { userId: user.id },
        select: { hospitalId: true },
      }).catch(() => null);
      hospitalId = staff?.hospitalId ?? null;
    }
  }
  const doctorId = hospitalId ? await doctorIdForHospital(hospitalId) : null;
  doctorIdCache.set(user.id, { at: Date.now(), doctorId });
  return doctorId;
}

// Small cache so AutoRefresh (5s) doesn't hammer the DB. Expiry itself is
// computed against `new Date()` on every call, so an expiry is never delayed
// by caching — only tamper/suspension detection can lag by up to the TTL.
const cache = new Map<string, { at: number; license: LicenseRecord | null }>();
const CACHE_TTL_MS = 15_000;

/** Post-login check for a session user. Machine binding is NOT enforced here —
 *  staff work from their own devices; they are gated by expiry/status. */
export async function checkLicenseForUser(user: SessionUser): Promise<LicenseGuardResult | null> {
  const doctorId = await licenseeDoctorIdForUser(user);
  if (!doctorId) return null; // no license context resolvable — do not block

  const hit = cache.get(doctorId);
  let license: LicenseRecord | null;
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    license = hit.license;
  } else {
    try {
      license = await prisma.tenantLicense.findUnique({ where: { doctorId } });
      cache.set(doctorId, { at: Date.now(), license });
    } catch {
      // Transient DB failure: don't log the user out over infrastructure
      // noise — the page's own queries will surface the outage anyway.
      return null;
    }
  }

  const jar = await cookies();
  const machineId = jar.get(MID_COOKIE)?.value ?? null;
  return evaluate(license, machineId, { enforceMachine: false });
}

/** Where a blocked visitor should land. */
export function licenseRedirectTarget(result: LicenseGuardResult): string {
  switch (result.status) {
    case "EXPIRED":   return "/license?reason=expired";
    case "INVALID":   return "/license/activate?reason=invalid";
    case "MISMATCH":  return "/license/activate?reason=machine";
    case "SUSPENDED": return "/license/activate?reason=suspended";
    default:          return "/license?reason=none";
  }
}

/** Paths that must stay reachable while the license is invalid/expired,
 *  otherwise renewal itself becomes impossible. */
export function isLicenseExemptPath(pathname: string): boolean {
  return (
    pathname.startsWith("/license") ||
    pathname.startsWith("/subscription") ||
    pathname.startsWith("/setup") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/license") ||
    pathname.startsWith("/api/razorpay") ||
    pathname.startsWith("/api/setup") ||
    pathname.startsWith("/api/cron")
  );
}
