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
