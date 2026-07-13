import { prisma } from "@/lib/prisma";

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
