import { requireUser } from "@/lib/rbac";
import { getLicenseForHospital, getLicenseForDoctor } from "@/lib/license";
import { prisma } from "@/lib/prisma";
import { SubscriptionClient } from "./SubscriptionClient";

export default async function SubscriptionPage() {
  const user = await requireUser();

  let hospitalId: string | null = null;
  let hospitalName = "";
  let license = null;

  if (user.role === "DOCTOR") {
    // The doctor is the licensee
    if (user.doctorId) license = await getLicenseForDoctor(user.doctorId);
    hospitalName = user.name;
  } else if (user.role === "REFRACTIONIST") {
    const ref = await (prisma.refractionist as any).findUnique({
      where: { userId: user.id },
      include: { hospital: { select: { id: true, name: true } } },
    });
    hospitalId = ref?.hospital?.id ?? null;
    hospitalName = ref?.hospital?.name ?? "";
  } else {
    // HOSPITAL and custom staff roles
    const staff = await prisma.hospitalStaff.findUnique({
      where: { userId: user.id },
      include: { hospital: { select: { id: true, name: true } } },
    });
    hospitalId = staff?.hospital.id ?? null;
    hospitalName = staff?.hospital.name ?? "";
  }

  // For staff roles the license belongs to the hospital's doctor
  if (!license && hospitalId) license = await getLicenseForHospital(hospitalId);

  return (
    <SubscriptionClient
      hospitalId={hospitalId}
      hospitalName={hospitalName}
      license={license}
      razorpayKey={process.env.RAZORPAY_KEY_ID ?? ""}
    />
  );
}
