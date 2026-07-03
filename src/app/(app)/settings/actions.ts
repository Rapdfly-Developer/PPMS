"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

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
  name: string; shortCode: string; address?: string; contact?: string;
  username: string; password: string; staffName: string; mobile?: string;
}): Promise<{ error?: string; id?: string }> {
  const authUser = await requireRole("DOCTOR");
  const doctor = await prisma.doctor.findUnique({ where: { userId: authUser.id }, select: { id: true } });
  if (!doctor) return { error: "Doctor profile not found." };

  const shortCode = data.shortCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!data.name.trim()) return { error: "Hospital name is required." };
  if (shortCode.length < 2 || shortCode.length > 8) return { error: "Short code must be 2–8 characters." };
  if (!data.username.trim()) return { error: "Username is required." };
  if (data.password.length < 6) return { error: "Password must be at least 6 characters." };
  if (data.mobile && !/^\d{10}$/.test(data.mobile)) return { error: "Mobile must be 10 digits." };

  const existing = await prisma.user.findUnique({ where: { username: data.username.trim() } });
  if (existing) return { error: "Username already taken." };

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(data.password, 10);

  try {
    const hospital = await prisma.hospital.create({
      data: { name: data.name.trim(), shortCode, address: data.address?.trim() || null, contact: data.contact?.trim() || null },
    });
    await prisma.doctorHospitalLink.create({ data: { doctorId: doctor.id, hospitalId: hospital.id } });

    const user = await prisma.user.create({
      data: { username: data.username.trim(), passwordHash, role: "HOSPITAL", active: true },
    });
    await (prisma.hospitalStaff as any).create({
      data: { userId: user.id, hospitalId: hospital.id, name: data.staffName.trim(), mobile: data.mobile || null },
    });

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
  data: { shortCode?: string; specialty?: string; contact?: string; credentials?: string }
): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");
  const doctor = await prisma.doctor.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!doctor) return { error: "Doctor profile not found." };

  const shortCode = data.shortCode?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || undefined;
  if (shortCode && (shortCode.length < 2 || shortCode.length > 6)) {
    return { error: "Short code must be 2–6 letters (A–Z, 0–9)." };
  }

  try {
    await prisma.doctor.update({
      where: { id: doctor.id },
      data: {
        ...(shortCode !== undefined ? { shortCode } : {}),
        ...(data.specialty !== undefined ? { specialty: data.specialty } : {}),
        ...(data.contact !== undefined ? { contact: data.contact } : {}),
        ...(data.credentials !== undefined ? { credentials: data.credentials } : {}),
      },
    });
  } catch (e: any) {
    if (e?.code === "P2002") return { error: "That short code is already taken by another doctor." };
    return { error: "Could not save profile." };
  }

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
