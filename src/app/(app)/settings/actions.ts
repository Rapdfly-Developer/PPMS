"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { manualActivateLicense } from "@/lib/license";
import { generateLicenseKey } from "@/lib/license-key";
import { sendMail } from "@/lib/mailer";
import { auth } from "@/auth";
import { generateUniqueShortCode } from "@/lib/doctor-utils";
import { isEmailTaken, isMobileTaken } from "@/lib/uniqueness";

// ── Hospital settings (HOSPITAL role) ──────────────────────────────────────

export async function updateHospitalSettings(
  hospitalId: string,
  data: { contact?: string; address?: string; retentionYears?: number }
): Promise<{ error?: string }> {
  const user = await requireRole("HOSPITAL");

  const staff = await prisma.hospitalStaff.findUnique({
    where: { userId: user.id },
    select: { hospitalId: true },
  });
  if (!staff || staff.hospitalId !== hospitalId) return { error: "Forbidden." };

  await prisma.hospital.update({
    where: { id: hospitalId },
    data: {
      ...(data.contact !== undefined ? { contact: data.contact } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.retentionYears !== undefined ? { retentionYears: data.retentionYears } : {}),
    },
  });

  revalidatePath("/settings");
  return {};
}

// ── Hospital management (DOCTOR role) ─────────────────────────────────────

export async function createHospitalWithUser(data: {
  name: string; shortCode: string; address: string; contact: string; email: string;
  username: string; password: string; staffName: string; mobile: string; adminEmail: string;
}): Promise<{ error?: string; id?: string }> {
  const authUser = await requireRole("DOCTOR");
  const doctor = await prisma.doctor.findUnique({ where: { userId: authUser.id }, select: { id: true } });
  if (!doctor) return { error: "Doctor profile not found." };

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const shortCode = data.shortCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (!data.name.trim())                                    return { error: "Hospital name is required." };
  if (shortCode.length < 2 || shortCode.length > 8)        return { error: "Short code must be 2–8 characters." };
  if (!data.contact.trim())                                 return { error: "Hospital contact number is required." };
  if (!/^\d{10}$/.test(data.contact.trim()))               return { error: "Hospital contact must be a 10-digit number." };
  if (!data.email.trim())                                   return { error: "Hospital email is required." };
  if (!emailRe.test(data.email.trim()))                    return { error: "Enter a valid hospital email address." };
  if (!data.address.trim())                                 return { error: "Hospital address is required." };
  if (!data.staffName.trim())                               return { error: "Contact person name is required." };
  if (!data.username.trim())                                return { error: "Username is required." };
  if (!/^[a-z0-9._-]{3,}$/.test(data.username.trim()))   return { error: "Username must be ≥3 characters (a–z, 0–9, . _ - only)." };
  if (data.password.length < 6)                            return { error: "Password must be at least 6 characters." };
  if (!data.mobile.trim())                                  return { error: "Admin mobile number is required." };
  if (!/^\d{10}$/.test(data.mobile.trim()))               return { error: "Admin mobile must be a 10-digit number." };
  if (!data.adminEmail.trim())                              return { error: "Admin email is required." };
  if (!emailRe.test(data.adminEmail.trim()))               return { error: "Enter a valid admin email address." };

  const existing = await prisma.user.findUnique({ where: { username: data.username.trim() } });
  if (existing) return { error: "Username already taken." };

  if (await isEmailTaken(data.adminEmail.trim())) return { error: "This email address is already registered to another account." };
  if (await isMobileTaken(data.mobile.trim())) return { error: "This mobile number is already registered to another account." };

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(data.password, 10);

  try {
    const hospital = await prisma.hospital.create({
      data: {
        name: data.name.trim(), shortCode,
        email: data.email.trim(), address: data.address.trim(), contact: data.contact.trim(),
      },
    });
    await prisma.doctorHospitalLink.create({ data: { doctorId: doctor.id, hospitalId: hospital.id } });

    const user = await prisma.user.create({
      data: { username: data.username.trim(), passwordHash, role: "HOSPITAL", email: data.adminEmail.trim(), active: true },
    });
    await (prisma.hospitalStaff as any).create({
      data: { userId: user.id, hospitalId: hospital.id, name: data.staffName.trim(), mobile: data.mobile.trim() },
    });

    // No per-hospital license: the hospital is covered by the doctor's license.
    // Ensure the doctor has one (30-day trial) if they don't yet.
    const hasLicense = await prisma.tenantLicense.findUnique({ where: { doctorId: doctor.id } });
    if (!hasLicense) {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 30);
      await prisma.tenantLicense.create({ data: { doctorId: doctor.id, trialEndsAt } });
    }

    revalidatePath("/settings");
    return { id: hospital.id };
  } catch (e: any) {
    if (e?.code === "P2002") return { error: "Short code or username already taken." };
    return { error: "Could not create hospital." };
  }
}

// ── Hospital CRUD (DOCTOR role) ───────────────────────────────────────────

export async function updateHospital(
  hospitalId: string,
  data: { name?: string; shortCode?: string; address?: string; contact?: string }
): Promise<{ error?: string }> {
  const authUser = await requireRole("DOCTOR");
  const doctor = await prisma.doctor.findUnique({ where: { userId: authUser.id }, select: { id: true } });
  if (!doctor) return { error: "Doctor profile not found." };

  const link = await prisma.doctorHospitalLink.findUnique({
    where: { doctorId_hospitalId: { doctorId: doctor.id, hospitalId } },
  });
  if (!link) return { error: "Hospital not linked to this doctor." };

  const shortCode = data.shortCode?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (shortCode && (shortCode.length < 2 || shortCode.length > 8)) return { error: "Short code must be 2–8 characters." };

  try {
    await prisma.hospital.update({
      where: { id: hospitalId },
      data: {
        ...(data.name?.trim() ? { name: data.name.trim() } : {}),
        ...(shortCode ? { shortCode } : {}),
        ...(data.address !== undefined ? { address: data.address.trim() || null } : {}),
        ...(data.contact !== undefined ? { contact: data.contact.trim() || null } : {}),
      },
    });
  } catch (e: any) {
    if (e?.code === "P2002") return { error: "Short code already taken." };
    return { error: "Could not update hospital." };
  }

  revalidatePath("/settings");
  return {};
}

export async function saveHospitalLogo(
  hospitalId: string,
  logoUrl: string
): Promise<{ error?: string }> {
  const authUser = await requireRole("DOCTOR", "HOSPITAL");

  if (authUser.role === "HOSPITAL") {
    // HOSPITAL user: verify they belong to this hospital
    const staff = await prisma.hospitalStaff.findUnique({
      where: { userId: authUser.id },
      select: { hospitalId: true },
    });
    if (!staff || staff.hospitalId !== hospitalId) return { error: "Access denied." };
  } else {
    // DOCTOR: verify the hospital is linked
    const doctor = await prisma.doctor.findUnique({ where: { userId: authUser.id }, select: { id: true } });
    if (!doctor) return { error: "Doctor profile not found." };
    const link = await prisma.doctorHospitalLink.findUnique({
      where: { doctorId_hospitalId: { doctorId: doctor.id, hospitalId } },
    });
    if (!link) return { error: "Hospital not linked to this doctor." };
  }

  await prisma.hospital.update({ where: { id: hospitalId }, data: { logoUrl } });
  revalidatePath("/settings");
  return {};
}

export async function toggleHospitalLink(
  hospitalId: string,
  active: boolean
): Promise<{ error?: string }> {
  const authUser = await requireRole("DOCTOR");
  const doctor = await prisma.doctor.findUnique({ where: { userId: authUser.id }, select: { id: true } });
  if (!doctor) return { error: "Doctor profile not found." };

  await prisma.doctorHospitalLink.update({
    where: { doctorId_hospitalId: { doctorId: doctor.id, hospitalId } },
    data: { active },
  });

  revalidatePath("/settings");
  return {};
}

// ── User CRUD (DOCTOR role) ───────────────────────────────────────────────

export async function updateUser(
  userId: string,
  data: { name?: string; email?: string; mobile?: string; newPassword?: string }
): Promise<{ error?: string }> {
  await requireRole("DOCTOR");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { hospitalStaff: true, refractionist: true },
  });
  if (!user) return { error: "User not found." };

  const bcrypt = await import("bcryptjs");

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.email !== undefined ? { email: data.email.trim() || null } : {}),
        ...(data.newPassword ? { passwordHash: await bcrypt.hash(data.newPassword, 10) } : {}),
      },
    });

    if (data.name?.trim()) {
      if (user.hospitalStaff) {
        await prisma.hospitalStaff.update({
          where: { userId },
          data: {
            name: data.name.trim(),
            ...(data.mobile !== undefined ? { mobile: data.mobile.trim() || null } : {}),
          },
        });
      } else if (user.refractionist) {
        await (prisma.refractionist as any).update({
          where: { userId },
          data: {
            name: data.name.trim(),
            ...(data.mobile !== undefined ? { mobile: data.mobile.trim() || null } : {}),
          },
        });
      }
    }
  } catch {
    return { error: "Could not update user." };
  }

  revalidatePath("/settings");
  return {};
}

export async function deleteUser(userId: string): Promise<{ error?: string }> {
  await requireRole("DOCTOR");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return { error: "User not found." };
  if (user.role === "DOCTOR") return { error: "Cannot delete a doctor account." };

  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch {
    return { error: "Could not delete user." };
  }

  revalidatePath("/settings");
  return {};
}

export async function toggleUserActive(userId: string, active: boolean): Promise<{ error?: string }> {
  await requireRole("DOCTOR");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return { error: "User not found." };
  if (user.role === "DOCTOR") return { error: "Cannot deactivate a doctor account." };

  await prisma.user.update({ where: { id: userId }, data: { active } });
  revalidatePath("/settings");
  return {};
}

// ── Doctor profile (DOCTOR role) ───────────────────────────────────────────

export async function saveDoctorProfile(
  data: {
    name?: string; specialty?: string; contact?: string; credentials?: string;
    email?: string; experience?: string; medicalRegNumber?: string; qualifications?: string; signatureUrl?: string;
  }
): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");
  const doctor = await prisma.doctor.findUnique({ where: { userId: user.id }, select: { id: true, name: true, shortCode: true } });
  if (!doctor) return { error: "Doctor profile not found." };

  const name = data.name?.trim() || undefined;
  if (name !== undefined && name.length < 2) {
    return { error: "Name must be at least 2 characters." };
  }

  // Uniqueness checks (skip empty values)
  if (data.email?.trim()) {
    if (await isEmailTaken(data.email.trim(), { excludeDoctorId: doctor.id }))
      return { error: "This email address is already registered to another account." };
  }
  if (data.contact?.trim()) {
    if (await isMobileTaken(data.contact.trim(), { excludeDoctorId: doctor.id }))
      return { error: "This mobile number is already registered to another account." };
  }

  // Auto-assign short code if doctor doesn't have one yet
  const autoShortCode = !doctor.shortCode
    ? await generateUniqueShortCode(name ?? doctor.name)
    : undefined;

  try {
    await prisma.doctor.update({
      where: { id: doctor.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(autoShortCode ? { shortCode: autoShortCode } : {}),
        ...(data.specialty !== undefined ? { specialty: data.specialty } : {}),
        ...(data.contact !== undefined ? { contact: data.contact } : {}),
        ...(data.credentials !== undefined ? { credentials: data.credentials } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.experience !== undefined ? { experience: data.experience } : {}),
        ...(data.medicalRegNumber !== undefined ? { medicalRegNumber: data.medicalRegNumber } : {}),
        ...(data.qualifications !== undefined ? { qualifications: data.qualifications } : {}),
        ...(data.signatureUrl !== undefined ? { signatureUrl: data.signatureUrl } : {}),
      },
    });
  } catch (e: any) {
    if (e?.code === "P2002") return { error: "That short code is already taken by another doctor." };
    return { error: "Could not save profile." };
  }

  revalidatePath("/settings");
  return {};
}

// ── List all assignable roles for user creation ───────────────────────────

export async function getAssignableRoles(): Promise<{ name: string; label: string; color: string }[]> {
  await requireRole("DOCTOR");
  const roles = await prisma.role.findMany({
    where: { name: { not: "DOCTOR" }, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { name: true, label: true, color: true },
  });
  return roles;
}

// ── Create user directly (DOCTOR role) ────────────────────────────────────

export async function createUserDirect(data: {
  name: string; username: string; password: string;
  role: string; hospitalId: string; mobile?: string;
}): Promise<{ error?: string }> {
  await requireRole("DOCTOR");

  if (!data.name.trim() || !data.username.trim()) return { error: "Name and username are required." };
  if (data.password.length < 6) return { error: "Password must be at least 6 characters." };
  if (data.mobile && !/^\d{10}$/.test(data.mobile)) return { error: "Mobile must be 10 digits." };

  const existing = await prisma.user.findUnique({ where: { username: data.username.trim() } });
  if (existing) return { error: `Username "${data.username}" is already taken.` };

  if (data.mobile && await isMobileTaken(data.mobile)) return { error: "This mobile number is already registered to another account." };

  const hospital = await prisma.hospital.findUnique({ where: { id: data.hospitalId } });
  if (!hospital) return { error: "Hospital not found." };

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: { username: data.username.trim(), passwordHash, role: data.role as any, active: true },
  });

  await (prisma.hospitalStaff as any).create({
    data: { userId: user.id, hospitalId: data.hospitalId, name: data.name.trim(), mobile: data.mobile?.trim() || null },
  });

  revalidatePath("/settings");
  return {};
}

// ── ChipOption management (DOCTOR role) ────────────────────────────────────

async function getDoctorId(userId: string) {
  const d = await prisma.doctor.findUnique({ where: { userId }, select: { id: true } });
  return d?.id ?? null;
}

export async function addChipOption(
  hospitalId: string,
  category: string,
  value: string
): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");
  const doctorId = await getDoctorId(user.id);
  if (!doctorId) return { error: "Doctor profile not found." };

  const link = await prisma.doctorHospitalLink.findUnique({
    where: { doctorId_hospitalId: { doctorId, hospitalId } },
  });
  if (!link) return { error: "Not linked to this hospital." };

  const label = value.trim();
  if (!label) return { error: "Value cannot be empty." };

  try {
    await prisma.chipOption.upsert({
      where: { category_value_hospitalId: { category, value: label, hospitalId } },
      create: { category, value: label, label, hospitalId, active: true },
      update: { active: true },
    });
  } catch {
    return { error: "Could not add option." };
  }

  revalidatePath("/settings/chips");
  return {};
}

export async function removeChipOption(id: string): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");
  const doctorId = await getDoctorId(user.id);
  if (!doctorId) return { error: "Doctor profile not found." };

  const chip = await prisma.chipOption.findUnique({ where: { id } });
  if (!chip) return { error: "Not found." };

  // Verify doctor is linked to this hospital
  if (chip.hospitalId) {
    const link = await prisma.doctorHospitalLink.findUnique({
      where: { doctorId_hospitalId: { doctorId, hospitalId: chip.hospitalId } },
    });
    if (!link) return { error: "Forbidden." };
  }

  await prisma.chipOption.delete({ where: { id } });
  revalidatePath("/settings/chips");
  return {};
}

// ── Export helpers (DOCTOR role) ──────────────────────────────────────────

export async function getDoctorsByHospital(hospitalId: string): Promise<{ id: string; name: string }[]> {
  await requireRole("DOCTOR");
  const links = await prisma.doctorHospitalLink.findMany({
    where: { hospitalId, active: true },
    select: { doctor: { select: { id: true, name: true } } },
    orderBy: { doctor: { name: "asc" } },
  });
  return links.map((l) => ({ id: l.doctor.id, name: l.doctor.name }));
}

export async function exportPatients(filters: {
  hospitalId: string;
  category?: string;
  sex?: string;
  ageMin?: number;
  ageMax?: number;
  fromDate?: string;
  toDate?: string;
  format: "CSV" | "Excel" | "PDF";
}): Promise<{ error?: string; data?: { name: string; udid: string; uhid: string; age: number; sex: string; mobile: string; category: string; registeredAt: string }[] }> {
  await requireRole("DOCTOR");

  const where: any = filters.hospitalId ? { registeredAtId: filters.hospitalId } : {};
  if (filters.category) where.category = filters.category;
  if (filters.sex)      where.sex = filters.sex;
  if (filters.ageMin !== undefined || filters.ageMax !== undefined) {
    where.age = {};
    if (filters.ageMin !== undefined) where.age.gte = filters.ageMin;
    if (filters.ageMax !== undefined) where.age.lte = filters.ageMax;
  }
  if (filters.fromDate || filters.toDate) {
    where.createdAt = {};
    if (filters.fromDate) where.createdAt.gte = new Date(filters.fromDate);
    if (filters.toDate)   where.createdAt.lte = new Date(filters.toDate + "T23:59:59");
  }

  const patients = await prisma.patient.findMany({
    where,
    select: { name: true, udid: true, uhid: true, age: true, sex: true, mobile: true, category: true, createdAt: true },
    orderBy: { name: "asc" },
  });

  return {
    data: patients.map((p) => ({
      name: p.name, udid: p.udid ?? "", uhid: p.uhid ?? "", age: p.age, sex: p.sex,
      mobile: p.mobile, category: p.category,
      registeredAt: p.createdAt.toISOString(),
    })),
  };
}

// ── License management (DOCTOR role only) ─────────────────────────────────

// The DOCTOR is the licensee: one license covers all their hospitals.
export async function getHospitalsWithLicense(): Promise<{
  id: string; name: string;
  license: {
    status: string; plan: string | null;
    licenseKeyMasked: string | null;
    subscriptionStartsAt: string | null;
    subscriptionEndsAt: string | null; trialEndsAt: string | null;
    remainingDays: number;
    paymentStatus: string;
  } | null;
}[]> {
  const authUser = await requireRole("DOCTOR");
  const doctor = await prisma.doctor.findUnique({
    where: { userId: authUser.id },
    select: { id: true, name: true, license: true },
  });
  if (!doctor) return [];

  const lic = doctor.license;
  if (!lic) return [{ id: doctor.id, name: `Dr. ${doctor.name} — all hospitals`, license: null }];

  const now = new Date();
  let status = "TRIAL_ACTIVE";
  if (lic.subscriptionEndsAt && lic.subscriptionEndsAt > now) status = "SUBSCRIBED";
  else if (lic.subscriptionEndsAt && lic.subscriptionEndsAt <= now) status = "SUBSCRIPTION_EXPIRED";
  else if (lic.trialEndsAt && lic.trialEndsAt <= now) status = "TRIAL_EXPIRED";

  const expiresAt = lic.subscriptionEndsAt ?? lic.trialEndsAt;
  const remainingDays = expiresAt && expiresAt > now
    ? Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000)
    : 0;

  // Mask all but the first two groups: PPMS-XXXX-****-****-****
  const licenseKeyMasked = lic.licenseKey
    ? lic.licenseKey.split("-").map((p, i) => (i < 2 ? p : "****")).join("-")
    : null;

  return [{
    id: doctor.id,
    name: `Dr. ${doctor.name} — all hospitals`,
    license: {
      status,
      plan: lic.plan,
      licenseKeyMasked,
      subscriptionStartsAt: lic.subscriptionStartsAt?.toISOString() ?? null,
      subscriptionEndsAt: lic.subscriptionEndsAt?.toISOString() ?? null,
      trialEndsAt: lic.trialEndsAt?.toISOString() ?? null,
      remainingDays,
      paymentStatus: lic.paymentStatus,
    },
  }];
}

export type LicenseFullData = {
  doctorId: string;
  doctorName: string;
  doctorEmail: string | null;
  doctorContact: string | null;
  primaryHospital: string | null;
  shortId: string;
  status: "SUBSCRIBED" | "TRIAL_ACTIVE" | "TRIAL_EXPIRED" | "SUBSCRIPTION_EXPIRED" | "NO_LICENSE";
  plan: string | null;
  licenseKeyMasked: string | null;
  subscriptionStartsAt: string | null;
  subscriptionEndsAt: string | null;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  remainingDays: number;
  paymentStatus: string;
  machineId: string | null;
  deviceName: string | null;
  lastVerifiedAt: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  isActive: boolean;
  events: {
    id: string;
    date: string;
    action: string;
    keyMasked: string | null;
    performedBy: string | null;
    status: "SUCCESS" | "FAILED";
    detail: string | null;
  }[];
};

export async function getLicenseFullDetails(): Promise<LicenseFullData | null> {
  const authUser = await requireRole("DOCTOR");
  const now = new Date();

  const doctor = await prisma.doctor.findUnique({
    where: { userId: authUser.id },
    include: {
      license: true,
      hospitalLinks: {
        where: { active: true },
        take: 1,
        select: { hospital: { select: { name: true } } },
      },
    },
  });
  if (!doctor) return null;

  const lic = doctor.license;

  let status: LicenseFullData["status"] = "NO_LICENSE";
  if (lic) {
    if (lic.subscriptionEndsAt && lic.subscriptionEndsAt > now) status = "SUBSCRIBED";
    else if (lic.subscriptionEndsAt && lic.subscriptionEndsAt <= now) status = "SUBSCRIPTION_EXPIRED";
    else if (lic.trialEndsAt && lic.trialEndsAt > now) status = "TRIAL_ACTIVE";
    else if (lic.trialEndsAt) status = "TRIAL_EXPIRED";
  }

  const expiresAt = lic?.subscriptionEndsAt ?? lic?.trialEndsAt;
  const remainingDays = expiresAt && expiresAt > now
    ? Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000)
    : 0;

  const licenseKeyMasked = lic?.licenseKey
    ? lic.licenseKey.split("-").map((p, i) => (i < 2 ? p : "****")).join("-")
    : null;

  const events = await prisma.licenseEvent.findMany({
    where: { doctorId: doctor.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return {
    doctorId: doctor.id,
    doctorName: doctor.name,
    doctorEmail: doctor.email ?? null,
    doctorContact: doctor.contact ?? null,
    primaryHospital: doctor.hospitalLinks[0]?.hospital.name ?? null,
    shortId: doctor.id.slice(-8).toUpperCase(),
    status,
    plan: lic?.plan ?? null,
    licenseKeyMasked,
    subscriptionStartsAt: lic?.subscriptionStartsAt?.toISOString() ?? null,
    subscriptionEndsAt: lic?.subscriptionEndsAt?.toISOString() ?? null,
    trialStartsAt: lic?.trialStartsAt?.toISOString() ?? null,
    trialEndsAt: lic?.trialEndsAt?.toISOString() ?? null,
    remainingDays,
    paymentStatus: lic?.paymentStatus ?? "NONE",
    machineId: lic?.machineId ?? null,
    deviceName: lic?.deviceName ?? null,
    lastVerifiedAt: lic?.lastVerifiedAt?.toISOString() ?? null,
    razorpayOrderId: lic?.razorpayOrderId ?? null,
    razorpayPaymentId: lic?.razorpayPaymentId ?? null,
    isActive: lic?.isActive ?? false,
    events: events.map((e) => ({
      id: e.id,
      date: e.createdAt.toISOString(),
      action: e.action,
      keyMasked: e.keyMasked,
      performedBy: e.performedBy,
      status: e.status as "SUCCESS" | "FAILED",
      detail: e.detail,
    })),
  };
}

// ── License key registry (signed keys) ──────────────────────────────────────

/** When LICENSE_ADMIN_EMAILS is set (comma-separated), only those emails may
 *  mint keys; unset, any DOCTOR may (matching activateLicenseManual's trust). */
function licenseKeyAdminAllowed(email: string | null): boolean {
  const allow = (process.env.LICENSE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length === 0) return true;
  return !!email && allow.includes(email.toLowerCase());
}

export async function generateLicenseKeys(
  count: number,
  months: number,
  note: string,
): Promise<{ error?: string; keys?: string[] }> {
  const authUser = await requireRole("DOCTOR");
  const u = await prisma.user.findUnique({ where: { id: authUser.id }, select: { email: true } });
  if (!licenseKeyAdminAllowed(u?.email ?? null)) {
    return { error: "Not authorised to issue license keys." };
  }

  const n = Math.min(Math.max(Math.trunc(count) || 1, 1), 20);
  const m = Math.min(Math.max(Math.trunc(months) || 12, 1), 60);

  const keys: string[] = [];
  for (let i = 0; i < n; i++) {
    const key = generateLicenseKey();
    await prisma.issuedLicenseKey.create({ data: { key, months: m, note: note.trim() || null } });
    keys.push(key);
  }
  return { keys };
}

export async function listIssuedKeys(): Promise<{
  error?: string;
  keys?: {
    key: string; note: string | null; months: number;
    createdAt: string; usedAt: string | null; usedBy: string | null; revoked: boolean;
  }[];
}> {
  const authUser = await requireRole("DOCTOR");
  const u = await prisma.user.findUnique({ where: { id: authUser.id }, select: { email: true } });
  if (!licenseKeyAdminAllowed(u?.email ?? null)) {
    return { error: "Not authorised to view issued keys." };
  }

  const rows = await prisma.issuedLicenseKey.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const doctorIds = [...new Set(rows.map((r) => r.usedByDoctorId).filter((x): x is string => !!x))];
  const doctors = doctorIds.length
    ? await prisma.doctor.findMany({ where: { id: { in: doctorIds } }, select: { id: true, name: true } })
    : [];
  const nameOf = new Map(doctors.map((d) => [d.id, d.name]));

  return {
    keys: rows.map((r) => ({
      key: r.key,
      note: r.note,
      months: r.months,
      createdAt: r.createdAt.toISOString(),
      usedAt: r.usedAt?.toISOString() ?? null,
      usedBy: r.usedByDoctorId ? (nameOf.get(r.usedByDoctorId) ?? r.usedByDoctorId) : null,
      revoked: r.revoked,
    })),
  };
}

export async function activateLicenseManual(
  _licenseeId: string, // kept for call-site compatibility; the caller's own license is activated
  plan: "MONTHLY" | "YEARLY",
  months: number,
  note: string,
): Promise<{ error?: string }> {
  const authUser = await requireRole("DOCTOR");
  const doctor = await prisma.doctor.findUnique({ where: { userId: authUser.id }, select: { id: true } });
  if (!doctor) return { error: "Doctor profile not found." };

  if (!["MONTHLY", "YEARLY"].includes(plan)) return { error: "Invalid plan." };
  if (months < 1 || months > 24) return { error: "Months must be 1–24." };

  try {
    await manualActivateLicense(doctor.id, plan, months, note);
    revalidatePath("/settings");
    return {};
  } catch {
    return { error: "Could not activate license." };
  }
}

// ── Export OTP ─────────────────────────────────────────────────────────────

export async function requestExportOtp(): Promise<{ error?: string; email?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user?.email) {
    return { error: "No email address on file for your account. Ask the administrator to add one." };
  }

  // Invalidate any existing unused OTPs for this user
  await prisma.exportOtp.updateMany({
    where: { userId, used: false },
    data: { used: true },
  });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  await prisma.exportOtp.create({ data: { userId, code, expiresAt } });

  await sendMail(
    user.email,
    "Your PPMS export verification code",
    `<div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;">
      <div style="background:#0f766e;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;font-size:16px;font-weight:700;">PPMS — Export OTP</div>
      <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
        <p style="margin:0 0 12px;color:#334155;font-size:14px;">Use the code below to authorise your data export. It expires in <strong>5 minutes</strong>.</p>
        <div style="text-align:center;letter-spacing:10px;font-size:36px;font-weight:800;color:#0f766e;padding:16px 0;">${code}</div>
        <p style="margin:12px 0 0;color:#94a3b8;font-size:12px;">If you did not request this, ignore this email.</p>
      </div>
    </div>`
  );

  const masked = user.email.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + "*".repeat(b.length) + c);
  return { email: masked };
}

export async function verifyExportOtp(code: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  const userId = session.user.id;

  const otp = await prisma.exportOtp.findFirst({
    where: { userId, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) return { error: "OTP expired or not found. Request a new one." };
  if (otp.code !== code.trim()) return { error: "Incorrect OTP. Please try again." };

  await prisma.exportOtp.update({ where: { id: otp.id }, data: { used: true } });
  return {};
}
