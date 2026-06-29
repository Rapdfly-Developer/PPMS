"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

export async function createUser(formData: FormData): Promise<{ error?: string }> {
  await requireRole("DOCTOR");

  const username = (formData.get("username") as string)?.trim();
  const password = formData.get("password") as string;
  const role = (formData.get("role") as string)?.trim().toUpperCase();
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim() || undefined;
  const mobile = (formData.get("mobile") as string)?.trim() || null;
  const hospitalId = (formData.get("hospitalId") as string)?.trim();
  const doctorId = formData.get("doctorId") as string;

  if (!username || !password || !role || !name || !hospitalId) {
    return { error: "All required fields must be filled." };
  }
  if (role !== "HOSPITAL" && role !== "REFRACTIONIST") {
    return { error: "Role must be HOSPITAL or REFRACTIONIST." };
  }
  if (mobile && !/^\d{10}$/.test(mobile)) {
    return { error: "Mobile number must be exactly 10 digits." };
  }

  const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });
  if (!hospital) {
    return { error: "Selected hospital not found." };
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return { error: "Username already taken." };

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: { username, passwordHash, role, email, active: true },
    });

    if (role === "HOSPITAL") {
      await (prisma.hospitalStaff as any).create({
        data: { userId: user.id, hospitalId, name, mobile },
      });
    } else {
      await (prisma.refractionist as any).create({
        data: { userId: user.id, hospitalId, doctorId, name, mobile },
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { error: `Failed to create user: ${msg}` };
  }

  revalidatePath("/users");
  return {};
}

export async function updateUser(userId: string, formData: FormData): Promise<{ error?: string }> {
  await requireRole("DOCTOR");

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim() || null;
  const mobile = (formData.get("mobile") as string)?.trim() || null;
  const newPassword = (formData.get("password") as string)?.trim() || null;
  const hospitalId = (formData.get("hospitalId") as string)?.trim() || undefined;
  const active = formData.get("active") === "true";

  if (!name) return { error: "Name is required." };
  if (mobile && !/^\d{10}$/.test(mobile)) {
    return { error: "Mobile number must be exactly 10 digits." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      hospitalStaff: true,
      refractionist: true,
    },
  });
  if (!user) return { error: "User not found." };

  // Update User record
  const userUpdate: Record<string, unknown> = { email, active };
  if (newPassword) userUpdate.passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: userUpdate });

  // Update profile
  if ((user as any).hospitalStaff) {
    const resolvedHospitalId = hospitalId ?? (user as any).hospitalStaff.hospitalId;
    await (prisma.hospitalStaff as any).update({
      where: { userId },
      data: { name, mobile, hospitalId: resolvedHospitalId },
    });
  } else if ((user as any).refractionist) {
    const resolvedHospitalId = hospitalId ?? (user as any).refractionist.hospitalId;
    await (prisma.refractionist as any).update({
      where: { userId },
      data: { name, mobile, hospitalId: resolvedHospitalId },
    });
  }

  revalidatePath("/users");
  return {};
}

export async function deleteUser(userId: string): Promise<{ error?: string }> {
  await requireRole("DOCTOR");

  try {
    await prisma.hospitalStaff.deleteMany({ where: { userId } });
    await prisma.refractionist.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { error: `Failed to delete user: ${msg}` };
  }

  revalidatePath("/users");
  return {};
}

export async function toggleUserActive(userId: string, active: boolean): Promise<void> {
  await requireRole("DOCTOR");
  await prisma.user.update({ where: { id: userId }, data: { active } });
  revalidatePath("/users");
}
