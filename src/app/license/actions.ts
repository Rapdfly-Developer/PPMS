"use server";

import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { resignLicense } from "@/lib/license-sign";
import { verifyLicenseKeyChecksum } from "@/lib/license-key";
import { generateUniqueShortCode } from "@/lib/doctor-utils";

// ── Cookie helpers ────────────────────────────────────────────────────────────
// ppms_org stores the licensee DOCTOR id — the doctor owns the license.
const ORG_COOKIE = "ppms_org";
const MID_COOKIE = "ppms_mid";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365, // 1 year
};

const KEY_RE = /^PPMS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function maskKey(key: string) {
  const parts = key.split("-");
  return parts.map((p, i) => (i < 2 ? p : "****")).join("-");
}

function logEvent(doctorId: string, action: string, status: "SUCCESS" | "FAILED", opts?: {
  key?: string; performedBy?: string; detail?: string;
}) {
  return prisma.licenseEvent.create({
    data: {
      doctorId,
      action,
      status,
      keyMasked: opts?.key ? maskKey(opts.key) : null,
      performedBy: opts?.performedBy ?? null,
      detail: opts?.detail ?? null,
    },
  }).catch(() => {});
}

// ── Start 30-day free trial ───────────────────────────────────────────────────
export async function startTrial(data: {
  adminName: string;
  email: string;
  mobile: string;
  password: string;
  machineId: string;
}): Promise<{ success?: boolean; error?: string }> {
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!data.adminName.trim())  return { error: "Doctor name is required." };
  if (!emailRe.test(data.email.trim())) return { error: "Enter a valid email address." };
  if (!/^\d{10}$/.test(data.mobile.replace(/\D/g, ""))) return { error: "Enter a valid 10-digit mobile number." };
  if (data.password.length < 6) return { error: "Password must be at least 6 characters." };

  // Auto-generate username from email prefix
  const rawUsername = data.email.trim().toLowerCase().split("@")[0].replace(/[^a-z0-9._-]/g, "");
  let username = rawUsername;
  let suffix = 1;
  while (await prisma.user.findUnique({ where: { username } })) {
    username = `${rawUsername}${suffix++}`;
  }

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(data.password, 10);

  try {
    // Create doctor user
    const user = await prisma.user.create({
      data: { username, passwordHash, role: "DOCTOR", email: data.email.trim() },
    });

    // Create doctor profile with auto-generated short code
    const shortCode = await generateUniqueShortCode(data.adminName.trim());
    const doctor = await prisma.doctor.create({
      data: { userId: user.id, name: data.adminName.trim(), email: data.email.trim(), contact: data.mobile.replace(/\D/g, ""), shortCode },
    });

    // Create 30-day trial license — owned by the DOCTOR
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);
    await prisma.tenantLicense.create({
      data: { doctorId: doctor.id, trialEndsAt, machineId: data.machineId },
    });
    await resignLicense(doctor.id);

    // Persist licensee identity in cookies (doctor id)
    const jar = await cookies();
    jar.set(ORG_COOKIE, doctor.id, COOKIE_OPTS);
    jar.set(MID_COOKIE, data.machineId, COOKIE_OPTS);

    await logEvent(doctor.id, "TRIAL_STARTED", "SUCCESS", { performedBy: data.adminName.trim() });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unique constraint")) return { error: "An account with this email already exists." };
    return { error: "Something went wrong. Please try again." };
  }
}

// ── Activate a purchased license key ─────────────────────────────────────────
export async function activateLicenseKey(data: {
  orgId: string;
  licenseKey: string;
  deviceName?: string;
}): Promise<{ success?: boolean; error?: string }> {
  const key = data.licenseKey.trim().toUpperCase();

  // Format validation: PPMS-XXXX-XXXX-XXXX-XXXX
  if (!KEY_RE.test(key)) {
    return { error: "The entered license key is invalid. Please verify and try again." };
  }

  try {
    const license = await prisma.tenantLicense.findUnique({ where: { doctorId: data.orgId } });
    if (!license) return { error: "Doctor not registered." };

    // Grandfather: re-entering the key already on this doctor's record skips
    // the checksum/registry checks (keys accepted before signing existed).
    const isOwnExistingKey = license.licenseKey === key;

    if (!isOwnExistingKey) {
      // Signed-key check: the last group must be the HMAC checksum of the
      // first three — rejects fabricated keys without touching the registry.
      if (!verifyLicenseKeyChecksum(key)) {
        await logEvent(data.orgId, "ACTIVATED", "FAILED", { key, detail: "Checksum verification failed" });
        return { error: "The entered license key is invalid. Please verify and try again." };
      }

      // Registry check: the key must have been issued by us and still be unused.
      const issued = await prisma.issuedLicenseKey.findUnique({ where: { key } });
      if (!issued || issued.revoked) {
        await logEvent(data.orgId, "ACTIVATED", "FAILED", { key, detail: issued ? "Key revoked" : "Key not issued" });
        return { error: "This license key is not recognised. Please contact support." };
      }
      if (issued.usedAt && issued.usedByDoctorId !== data.orgId) {
        await logEvent(data.orgId, "ACTIVATED", "FAILED", { key, detail: "Key already used by another organisation" });
        return { error: "This license key has already been used. Contact your administrator." };
      }
    }

    // Prevent reuse of the same key on another org
    const alreadyUsed = await prisma.tenantLicense.findFirst({
      where: { licenseKey: key, doctorId: { not: data.orgId } },
    });
    if (alreadyUsed) {
      await logEvent(data.orgId, "ACTIVATED", "FAILED", { key, detail: "Key already in use by another organisation" });
      return { error: "This license is registered for a different machine. Contact your administrator." };
    }

    // Activation period comes from the issued key (12 months by default)
    const issuedMonths = isOwnExistingKey
      ? 12
      : (await prisma.issuedLicenseKey.findUnique({ where: { key }, select: { months: true } }))?.months ?? 12;

    const now = new Date();
    const subscriptionEndsAt = new Date(now);
    subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + issuedMonths);

    await prisma.tenantLicense.update({
      where: { doctorId: data.orgId },
      data: {
        licenseKey: key,
        plan: issuedMonths >= 12 ? "YEARLY" : "MONTHLY",
        subscriptionStartsAt: now,
        subscriptionEndsAt,
        paymentStatus: "MANUAL",
        isActive: true,
        lastVerifiedAt: now,
        ...(data.deviceName ? { deviceName: data.deviceName } : {}),
      },
    });
    await resignLicense(data.orgId);

    // Mark the issued key as consumed by this organisation
    if (!isOwnExistingKey) {
      await prisma.issuedLicenseKey.update({
        where: { key },
        data: { usedAt: now, usedByDoctorId: data.orgId },
      }).catch(() => {});
    }

    await logEvent(data.orgId, "ACTIVATED", "SUCCESS", { key });

    return { success: true };
  } catch {
    return { error: "Unable to connect to the license server. Please try again later." };
  }
}

// ── Re-activate an existing license on this machine ──────────────────────────
export async function reactivateLicense(data: {
  orgId: string;
  licenseKey: string;
  machineId: string;
  deviceName?: string;
}): Promise<{ success?: boolean; error?: string }> {
  const key = data.licenseKey.trim().toUpperCase();

  if (!KEY_RE.test(key)) {
    return { error: "The entered license key is invalid. Please verify and try again." };
  }

  try {
    const license = await prisma.tenantLicense.findUnique({ where: { doctorId: data.orgId } });
    if (!license) return { error: "Doctor not registered." };
    if (!license.licenseKey) {
      return { error: "No license on record for this organisation. Use Activate License instead." };
    }
    if (license.licenseKey !== key) {
      await logEvent(data.orgId, "REACTIVATED", "FAILED", { key, detail: "Key does not match the registered license" });
      return { error: "This license is registered for a different machine. Contact your administrator." };
    }
    if (license.subscriptionEndsAt && license.subscriptionEndsAt < new Date()) {
      await logEvent(data.orgId, "REACTIVATED", "FAILED", { key, detail: "License expired" });
      return { error: "This license has expired. Please renew your subscription." };
    }

    await prisma.tenantLicense.update({
      where: { doctorId: data.orgId },
      data: {
        machineId: data.machineId,
        lastVerifiedAt: new Date(),
        ...(data.deviceName ? { deviceName: data.deviceName } : {}),
      },
    });
    await resignLicense(data.orgId);

    // Rebind the machine cookie
    const jar = await cookies();
    jar.set(MID_COOKIE, data.machineId, COOKIE_OPTS);

    await logEvent(data.orgId, "REACTIVATED", "SUCCESS", { key });

    return { success: true };
  } catch {
    return { error: "Unable to connect to the license server. Please try again later." };
  }
}

// ── Verify the current license ────────────────────────────────────────────────
export async function verifyLicense(orgId: string): Promise<{
  success?: boolean; message?: string; error?: string;
}> {
  try {
    const license = await prisma.tenantLicense.findUnique({ where: { doctorId: orgId } });
    if (!license) return { error: "Doctor not registered." };

    const now = new Date();
    const subActive = license.subscriptionEndsAt && license.subscriptionEndsAt > now;
    const trialActive = license.trialEndsAt > now;

    await prisma.tenantLicense.update({
      where: { doctorId: orgId },
      data: { lastVerifiedAt: now },
    });

    if (subActive) {
      await logEvent(orgId, "VERIFIED", "SUCCESS", { key: license.licenseKey ?? undefined });
      return { success: true, message: "License verified — your license is active and valid." };
    }
    if (trialActive) {
      await logEvent(orgId, "VERIFIED", "SUCCESS");
      return { success: true, message: "Trial verified — your trial is active." };
    }

    await logEvent(orgId, "VERIFIED", "FAILED", { detail: "License expired" });
    return { error: "This license has expired. Please renew your subscription." };
  } catch {
    return { error: "Unable to connect to the license server. Please try again later." };
  }
}

// ── Clear org cookie (for dev / re-registration) ─────────────────────────────
export async function clearOrgCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(ORG_COOKIE);
  jar.delete(MID_COOKIE);
}
