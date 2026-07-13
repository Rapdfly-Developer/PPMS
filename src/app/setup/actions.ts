"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export type ActionResult = { success?: string; error?: string };

async function generateUniqueShortCode(name: string): Promise<string> {
  const cleaned = name.replace(/^(dr\.?|prof\.?|mr\.?|mrs\.?|ms\.?)\s*/i, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  let base: string;
  if (words.length === 0) {
    base = "DOC";
  } else if (words.length === 1) {
    base = words[0].toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  } else {
    const initials = words.map((w) => w[0]).join("").toUpperCase().replace(/[^A-Z0-9]/g, "");
    base = initials.length >= 2 ? initials.slice(0, 4) : words[0].toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  }
  if (!base) base = "DOC";

  let candidate = base;
  let i = 2;
  while (true) {
    const exists = await prisma.doctor.findUnique({ where: { shortCode: candidate } });
    if (!exists) return candidate;
    candidate = base.slice(0, 3) + i;
    i++;
  }
}

export async function createDoctor(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const name      = (formData.get("name") as string)?.trim();
  const username  = (formData.get("username") as string)?.trim().toLowerCase();
  const password  = (formData.get("password") as string);
  const specialty = (formData.get("specialty") as string)?.trim() || "Ophthalmology";
  const contact   = (formData.get("contact") as string)?.trim() || null;

  if (!name || !username || !password)
    return { error: "Name, username, and password are required." };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };
  if (!/^[a-z0-9._-]+$/.test(username))
    return { error: "Username may only contain lowercase letters, numbers, dots, dashes, and underscores." };

  const existingUser = await prisma.user.findUnique({ where: { username } });
  if (existingUser) return { error: `Username "${username}" is already taken.` };

  const shortCode = await generateUniqueShortCode(name);
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, passwordHash, role: "DOCTOR", active: true },
  });
  await prisma.doctor.create({
    data: { userId: user.id, name, shortCode, specialty, contact },
  });

  return { success: `Doctor "${name}" created successfully.` };
}

export async function createHospital(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const name      = (formData.get("name") as string)?.trim();
  const shortCode = (formData.get("shortCode") as string)?.trim().toUpperCase();
  const address   = (formData.get("address") as string)?.trim() || null;
  const contact   = (formData.get("contact") as string)?.trim() || null;

  if (!name || !shortCode) return { error: "Name and short code are required." };
  if (!/^[A-Z0-9]{2,8}$/.test(shortCode))
    return { error: "Short code must be 2–8 uppercase letters/numbers." };

  const existing = await prisma.hospital.findUnique({ where: { shortCode } });
  if (existing) return { error: `Short code "${shortCode}" is already in use.` };

  await prisma.hospital.create({ data: { name, shortCode, address, contact } });

  // No per-hospital license — hospitals are covered by their doctor's license,
  // which is created when the doctor registers via /license or gets linked.

  return { success: `Hospital "${name}" created successfully.` };
}

export async function linkDoctorToHospitals(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const doctorId    = (formData.get("doctorId") as string)?.trim();
  const hospitalIds = formData.getAll("hospitalIds") as string[];

  if (!doctorId) return { error: "Please select a doctor." };
  if (hospitalIds.length === 0) return { error: "Please select at least one hospital." };

  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId }, select: { name: true } });
  if (!doctor) return { error: "Doctor not found." };

  // Upsert links — create new, skip existing
  await prisma.doctorHospitalLink.createMany({
    data: hospitalIds.map((hId) => ({ doctorId, hospitalId: hId, active: true })),
    skipDuplicates: true,
  });

  // Activate any previously deactivated links
  await prisma.doctorHospitalLink.updateMany({
    where: { doctorId, hospitalId: { in: hospitalIds } },
    data: { active: true },
  });

  const hospitals = await prisma.hospital.findMany({
    where: { id: { in: hospitalIds } },
    select: { name: true },
  });
  const names = hospitals.map((h) => h.name).join(", ");

  return { success: `${doctor.name} linked to: ${names}` };
}
