// License signature (tamper detection) — shared by the LicenseGuard and by
// every code path that legitimately writes TenantLicense rows.

import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const SECRET =
  process.env.LICENSE_SECRET ?? process.env.AUTH_SECRET ?? "ppms-license-guard";

export type SignableLicense = {
  doctorId: string;
  licenseKey: string | null;
  machineId: string | null;
  trialStartsAt: Date;
  trialEndsAt: Date;
  subscriptionStartsAt: Date | null;
  subscriptionEndsAt: Date | null;
  plan: string | null;
  isActive: boolean;
};

function signaturePayload(l: SignableLicense): string {
  return [
    l.doctorId,
    l.licenseKey ?? "",
    l.machineId ?? "",
    l.trialStartsAt.toISOString(),
    l.trialEndsAt.toISOString(),
    l.subscriptionStartsAt?.toISOString() ?? "",
    l.subscriptionEndsAt?.toISOString() ?? "",
    l.plan ?? "",
    String(l.isActive),
  ].join("|");
}

export function computeLicenseSignature(l: SignableLicense): string {
  return crypto.createHmac("sha256", SECRET).update(signaturePayload(l)).digest("hex");
}

/** Recompute + persist the signature. Call after every legitimate license write. */
export async function resignLicense(doctorId: string): Promise<void> {
  const l = await prisma.tenantLicense.findUnique({ where: { doctorId } });
  if (!l) return;
  await prisma.tenantLicense.update({
    where: { doctorId },
    data: { signature: computeLicenseSignature(l) },
  });
}
