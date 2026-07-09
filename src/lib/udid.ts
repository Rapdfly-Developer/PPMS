import { prisma } from "@/lib/prisma";

// UDID — Doctor-based:   PPMS-{DOCTORCODE}-NNNN  e.g. PPMS-RAM-0001
export async function generateUDID(doctorShortCode: string): Promise<string> {
  const prefix = `PPMS-${doctorShortCode.toUpperCase()}-`;
  return prisma.$transaction(async (tx) => {
    const existing = await tx.patient.findMany({
      where: { udid: { startsWith: prefix } },
      select: { udid: true },
    });
    let maxSeq = 0;
    for (const { udid } of existing) {
      if (!udid) continue;
      const suffix = udid.slice(prefix.length);
      if (/^\d+$/.test(suffix)) {
        const num = parseInt(suffix, 10);
        if (num > maxSeq) maxSeq = num;
      }
    }
    return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
  });
}

// UHID — Hospital-based: PPMS-{HOSPITALCODE}-NNNN  e.g. PPMS-SEH-0001
export async function generateUHID(hospitalShortCode: string): Promise<string> {
  const prefix = `PPMS-${hospitalShortCode.toUpperCase()}-`;
  return prisma.$transaction(async (tx) => {
    const existing = await tx.patient.findMany({
      where: { uhid: { startsWith: prefix } },
      select: { uhid: true },
    });
    let maxSeq = 0;
    for (const { uhid } of existing) {
      if (!uhid) continue;
      const suffix = uhid.slice(prefix.length);
      if (/^\d+$/.test(suffix)) {
        const num = parseInt(suffix, 10);
        if (num > maxSeq) maxSeq = num;
      }
    }
    return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
  });
}
