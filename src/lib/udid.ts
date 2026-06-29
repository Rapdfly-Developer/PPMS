import { prisma } from "@/lib/prisma";

// Format: PPMS-{HOSPITALCODE}-NNNN  (per-hospital sequential number, zero-padded to 4 digits)
// e.g. PPMS-SEH-0001, PPMS-SEH-0002, PPMS-CMH-0001
export async function generateUDID(hospitalShortCode: string): Promise<string> {
  const prefix = `PPMS-${hospitalShortCode.toUpperCase()}-`;

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
