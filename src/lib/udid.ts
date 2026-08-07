import { prisma } from "@/lib/prisma";

// UDID — Doctor-based:   PPMS-{DOCTORCODE}-NNNN  e.g. PPMS-RAM-0001
export async function generateUDID(doctorShortCode: string): Promise<string> {
  const prefix = `PPMS-${doctorShortCode.toUpperCase()}-`;
  return prisma.$transaction(async (tx) => {
    const last = await tx.patient.findFirst({
      where: { udid: { startsWith: prefix } },
      select: { udid: true },
      orderBy: { udid: "desc" },
    });
    let maxSeq = 0;
    if (last?.udid) {
      const suffix = last.udid.slice(prefix.length);
      if (/^\d+$/.test(suffix)) maxSeq = parseInt(suffix, 10);
    }
    return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
  });
}

// UHID — Hospital-based: PPMS-{HOSPITALCODE}-NNNN  e.g. PPMS-SEH-0001
export async function generateUHID(hospitalShortCode: string): Promise<string> {
  const prefix = `PPMS-${hospitalShortCode.toUpperCase()}-`;
  return prisma.$transaction(async (tx) => {
    const last = await tx.patient.findFirst({
      where: { uhid: { startsWith: prefix } },
      select: { uhid: true },
      orderBy: { uhid: "desc" },
    });
    let maxSeq = 0;
    if (last?.uhid) {
      const suffix = last.uhid.slice(prefix.length);
      if (/^\d+$/.test(suffix)) maxSeq = parseInt(suffix, 10);
    }
    return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
  });
}
