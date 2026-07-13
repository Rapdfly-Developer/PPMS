import { requireSuperAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { DoctorLicenseDashboard, type DoctorLicensePageData } from "./DoctorLicenseDashboard";

function mkInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function maskKey(key: string | null | undefined) {
  if (!key) return null;
  if (key.length <= 8) return key.slice(0, 2) + "****";
  return key.slice(0, 4) + "****-****-****-" + key.slice(-4);
}

function fmtMachineId(mid: string | null | undefined) {
  if (!mid) return null;
  if (mid.length <= 16) return mid;
  return mid.slice(0, 8) + "…" + mid.slice(-8);
}

export default async function DoctorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;

  const [doctor, events, patientCount] = await Promise.all([
    prisma.doctor.findUnique({
      where: { id },
      include: {
        user: { select: { username: true, active: true, role: true, email: true } },
        hospitalLinks: {
          include: {
            hospital: { select: { id: true, name: true, shortCode: true, contact: true, address: true } },
          },
          orderBy: { hospital: { name: "asc" } },
        },
        license: true,
      },
    }),
    prisma.licenseEvent.findMany({
      where: { doctorId: id },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.patient.count({ where: { doctorId: id } }),
  ]);

  if (!doctor) notFound();

  const lic = doctor.license;
  const now = new Date();

  // Compute canonical status
  const hasKey = !!lic?.licenseKey;
  const subscribed = hasKey && !!lic?.isActive && !!lic?.subscriptionEndsAt && lic.subscriptionEndsAt > now;
  const subscriptionExpired = hasKey && (!lic?.isActive || !lic?.subscriptionEndsAt || lic.subscriptionEndsAt <= now);
  const trialActive = !hasKey && !!lic?.trialEndsAt && lic.trialEndsAt > now;
  const trialExpired = !hasKey && !!lic?.trialEndsAt && lic.trialEndsAt <= now;

  type LicenseStatus = "SUBSCRIBED" | "TRIAL_ACTIVE" | "TRIAL_EXPIRED" | "SUBSCRIPTION_EXPIRED" | "NO_LICENSE";
  const status: LicenseStatus = subscribed ? "SUBSCRIBED"
    : trialActive ? "TRIAL_ACTIVE"
    : trialExpired ? "TRIAL_EXPIRED"
    : subscriptionExpired ? "SUBSCRIPTION_EXPIRED"
    : "NO_LICENSE";

  const daysRemaining = subscribed
    ? Math.ceil((lic!.subscriptionEndsAt!.getTime() - now.getTime()) / 86_400_000)
    : trialActive
    ? Math.ceil((lic!.trialEndsAt!.getTime() - now.getTime()) / 86_400_000)
    : 0;

  const data: DoctorLicensePageData = {
    doctor: {
      id: doctor.id,
      name: doctor.name,
      specialty: doctor.specialty ?? null,
      contact: doctor.contact ?? null,
      email: doctor.email ?? doctor.user.email ?? null,
      shortCode: doctor.shortCode ?? null,
      username: doctor.user.username,
      userActive: doctor.user.active,
      createdAt: doctor.createdAt.toISOString(),
      medicalRegNumber: doctor.medicalRegNumber ?? null,
      qualifications: doctor.qualifications ?? null,
      credentials: doctor.credentials ?? null,
      experience: doctor.experience ?? null,
      initials: mkInitials(doctor.name),
    },
    hospitals: doctor.hospitalLinks.map((link) => ({
      id: link.hospital.id,
      name: link.hospital.name,
      shortCode: link.hospital.shortCode,
      contact: link.hospital.contact ?? null,
      address: link.hospital.address ?? null,
      active: link.active,
    })),
    license: lic
      ? {
          plan: lic.plan ?? null,
          isActive: lic.isActive,
          licenseKeyMasked: maskKey(lic.licenseKey),
          machineId: lic.machineId ?? null,
          machineIdFormatted: fmtMachineId(lic.machineId),
          deviceName: lic.deviceName ?? null,
          lastVerifiedAt: lic.lastVerifiedAt?.toISOString() ?? null,
          subscriptionStartsAt: lic.subscriptionStartsAt?.toISOString() ?? null,
          subscriptionEndsAt: lic.subscriptionEndsAt?.toISOString() ?? null,
          trialStartsAt: lic.trialStartsAt?.toISOString() ?? null,
          trialEndsAt: lic.trialEndsAt?.toISOString() ?? null,
          paymentStatus: lic.paymentStatus,
          razorpayOrderId: lic.razorpayOrderId ?? null,
          razorpayPaymentId: lic.razorpayPaymentId ?? null,
          status,
          daysRemaining,
        }
      : null,
    events: events.map((e) => ({
      id: e.id,
      date: e.createdAt.toISOString(),
      action: e.action,
      status: e.status as "SUCCESS" | "FAILED",
      keyMasked: e.keyMasked ?? null,
      performedBy: e.performedBy ?? null,
      detail: e.detail ?? null,
    })),
    patientCount,
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: "#F8FAFC" }}
    >
      {/* Top bar */}
      <div className="border-b border-[#E5E7EB] bg-white/80 backdrop-blur-sm px-4 md:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-sm">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #0f766e, #14b8a6)" }}>
            <span className="text-white text-[10px] font-bold">P</span>
          </div>
          <span className="font-bold text-[#111827]">PPMS</span>
          <span className="text-[#D1D5DB]">/</span>
          <a href="/setup" className="text-[#6B7280] hover:text-[#111827] transition-colors">Setup</a>
          <span className="text-[#D1D5DB]">/</span>
          <span className="text-[#374151] font-medium truncate max-w-[200px]">{doctor.name}</span>
        </div>
      </div>

      {/* Page body */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <DoctorLicenseDashboard data={data} />
      </div>
    </div>
  );
}
