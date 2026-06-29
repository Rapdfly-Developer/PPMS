import { prisma } from "@/lib/prisma";

// Format: PPMS-{DOCTORCODE}-NNNN  (per-doctor sequential number, zero-padded to 4 digits)
// e.g. PPMS-DRS-0001, PPMS-DRS-0002
export async function generateUDID(shortCode: string): Promise<string> {
  const prefix = `PPMS-${shortCode.toUpperCase()}-`;

  return prisma.$transaction(async (tx) => {
    // Fetch all UHIDs for this hospital prefix, filter to purely sequential ones in JS
    const existing = await tx.patient.findMany({
      where: { udid: { startsWith: prefix } },
      select: { udid: true },
    });

    let maxSeq = 0;
    for (const { udid } of existing) {
      const suffix = udid.slice(prefix.length);
      if (/^\d+$/.test(suffix)) {
        const num = parseInt(suffix, 10);
        if (num > maxSeq) maxSeq = num;
      }
    }

    return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
  });
}
