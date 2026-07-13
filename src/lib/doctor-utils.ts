import { prisma } from "@/lib/prisma";

export function hospitalShortCodeBase(name: string): string {
  const words = name.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "HSP";
  if (words.length === 1) return words[0].slice(0, 4);
  const initials = words.map((w) => w[0]).join("");
  return initials.length >= 2 ? initials.slice(0, 4) : words[0].slice(0, 4);
}

export async function generateUniqueHospitalShortCode(name: string): Promise<string> {
  const base = hospitalShortCodeBase(name) || "HSP";
  let candidate = base;
  let i = 2;
  while (true) {
    const exists = await prisma.hospital.findUnique({ where: { shortCode: candidate } });
    if (!exists) return candidate;
    candidate = base.slice(0, 3) + i;
    i++;
  }
}

export async function generateUniqueShortCode(name: string): Promise<string> {
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
