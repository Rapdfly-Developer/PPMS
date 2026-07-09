import { prisma } from "@/lib/prisma";
import { resignLicense } from "@/lib/license-sign";

// The DOCTOR is the licensee: one license covers the doctor and every
// hospital they operate. Staff/refractionist access is gated by the license
// of the doctor their hospital belongs to.

export type LicenseStatus =
  | "TRIAL_ACTIVE"
  | "TRIAL_EXPIRED"
  | "SUBSCRIBED"
  | "SUBSCRIPTION_EXPIRED"
  | "NO_LICENSE";

export interface LicenseInfo {
  status: LicenseStatus;
  daysRemaining: number;   // days until trial/subscription ends (0 if expired)
  trialEndsAt: Date | null;
  subscriptionEndsAt: Date | null;
  plan: string | null;
  paymentStatus: string;
  isBlocked: boolean;      // true when access should be blocked
}

export async function getLicenseForDoctor(doctorId: string): Promise<LicenseInfo> {
  const license = await prisma.tenantLicense.findUnique({
    where: { doctorId },
  });

  if (!license) {
    return {
      status: "NO_LICENSE",
      daysRemaining: 0,
      trialEndsAt: null,
      subscriptionEndsAt: null,
      plan: null,
      paymentStatus: "NONE",
      isBlocked: true,
    };
  }

  const now = new Date();

  // Active subscription overrides trial
  if (license.subscriptionEndsAt && license.subscriptionEndsAt > now) {
    const days = Math.ceil((license.subscriptionEndsAt.getTime() - now.getTime()) / 86_400_000);
    return {
      status: "SUBSCRIBED",
      daysRemaining: days,
      trialEndsAt: license.trialEndsAt,
      subscriptionEndsAt: license.subscriptionEndsAt,
      plan: license.plan,
      paymentStatus: license.paymentStatus,
      isBlocked: false,
    };
  }

  // Trial active
  if (license.trialEndsAt > now) {
    const days = Math.ceil((license.trialEndsAt.getTime() - now.getTime()) / 86_400_000);
    return {
      status: "TRIAL_ACTIVE",
      daysRemaining: days,
      trialEndsAt: license.trialEndsAt,
      subscriptionEndsAt: null,
      plan: null,
      paymentStatus: license.paymentStatus,
      isBlocked: false,
    };
  }

  // Subscription existed but expired
  if (license.subscriptionEndsAt) {
    return {
      status: "SUBSCRIPTION_EXPIRED",
      daysRemaining: 0,
      trialEndsAt: license.trialEndsAt,
      subscriptionEndsAt: license.subscriptionEndsAt,
      plan: license.plan,
      paymentStatus: license.paymentStatus,
      isBlocked: true,
    };
  }

  // Trial expired, no subscription
  return {
    status: "TRIAL_EXPIRED",
    daysRemaining: 0,
    trialEndsAt: license.trialEndsAt,
    subscriptionEndsAt: null,
    plan: null,
    paymentStatus: license.paymentStatus,
    isBlocked: true,
  };
}

/** Resolve the licensee doctor for a hospital (first active doctor link). */
export async function doctorIdForHospital(hospitalId: string): Promise<string | null> {
  const link = await prisma.doctorHospitalLink.findFirst({
    where: { hospitalId, active: true },
    select: { doctorId: true },
  });
  if (link) return link.doctorId;
  // Fall back to inactive links so a paused link doesn't read as "no license"
  const anyLink = await prisma.doctorHospitalLink.findFirst({
    where: { hospitalId },
    select: { doctorId: true },
  });
  return anyLink?.doctorId ?? null;
}

/** License info for the doctor who runs this hospital. */
export async function getLicenseForHospital(hospitalId: string): Promise<LicenseInfo> {
  const doctorId = await doctorIdForHospital(hospitalId);
  if (!doctorId) {
    return {
      status: "NO_LICENSE",
      daysRemaining: 0,
      trialEndsAt: null,
      subscriptionEndsAt: null,
      plan: null,
      paymentStatus: "NONE",
      isBlocked: true,
    };
  }
  return getLicenseForDoctor(doctorId);
}

export async function createTrialLicense(doctorId: string) {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);

  const license = await prisma.tenantLicense.create({
    data: { doctorId, trialEndsAt },
  });
  await resignLicense(doctorId);
  return license;
}

export async function activateLicense(
  doctorId: string,
  plan: "MONTHLY" | "YEARLY",
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
) {
  const now = new Date();
  const subscriptionEndsAt = new Date(now);
  if (plan === "MONTHLY") {
    subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + 1);
  } else {
    subscriptionEndsAt.setFullYear(subscriptionEndsAt.getFullYear() + 1);
  }

  const license = await prisma.tenantLicense.upsert({
    where: { doctorId },
    update: {
      plan,
      subscriptionStartsAt: now,
      subscriptionEndsAt,
      paymentStatus: "PAID",
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      isActive: true,
    },
    create: {
      doctorId,
      trialEndsAt: now,
      plan,
      subscriptionStartsAt: now,
      subscriptionEndsAt,
      paymentStatus: "PAID",
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    },
  });
  await resignLicense(doctorId);
  return license;
}

/** Manually activate a license without a payment gateway (admin use). */
export async function manualActivateLicense(
  doctorId: string,
  plan: "MONTHLY" | "YEARLY",
  months: number,
  note: string,
) {
  const now = new Date();
  const subscriptionEndsAt = new Date(now);
  subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + months);

  const license = await prisma.tenantLicense.upsert({
    where: { doctorId },
    update: {
      plan,
      subscriptionStartsAt: now,
      subscriptionEndsAt,
      paymentStatus: "MANUAL",
      isActive: true,
      razorpayOrderId: note || null,
    },
    create: {
      doctorId,
      trialEndsAt: now,
      plan,
      subscriptionStartsAt: now,
      subscriptionEndsAt,
      paymentStatus: "MANUAL",
      isActive: true,
      razorpayOrderId: note || null,
    },
  });
  await resignLicense(doctorId);
  return license;
}
