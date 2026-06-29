import { requireRole, scopeDoctorId } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { HospitalSettingsClient } from "./HospitalSettingsClient";
import { DoctorSettingsClient } from "./DoctorSettingsClient";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const user = await requireRole("HOSPITAL", "DOCTOR");

  // ── Hospital role ────────────────────────────────────────────────────────
  if (user.role === "HOSPITAL") {
    const staff = await prisma.hospitalStaff.findUnique({
      where: { userId: user.id },
      include: { hospital: true },
    });
    if (!staff) redirect("/dashboard");
    return <HospitalSettingsClient hospital={staff.hospital} />;
  }

  // ── Doctor role ──────────────────────────────────────────────────────────
  const doctorId = scopeDoctorId(user);

  const [allUsers, auditLogs, doctorLinks, doctorProfile] = await Promise.all([
    prisma.user.findMany({
      include: {
        hospitalStaff: { include: { hospital: { select: { name: true } } } },
        refractionist:  { include: { hospital: { select: { name: true } } } },
        doctor:         { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 60,
    }),
    prisma.doctorHospitalLink.findMany({
      where: { doctorId },
      include: { hospital: true },
    }),
    prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { id: true, name: true, shortCode: true, specialty: true, contact: true, credentials: true },
    }),
  ]);

  const serializedUsers = allUsers.map((u) => ({
    id:        u.id,
    username:  u.username,
    role:      u.role,
    email:     u.email ?? "",
    name:      u.doctor?.name ?? u.hospitalStaff?.name ?? u.refractionist?.name ?? u.username,
    createdAt: u.createdAt.toISOString(),
    hospital:  u.hospitalStaff?.hospital?.name ?? u.refractionist?.hospital?.name ?? null,
  }));

  const serializedAudit = auditLogs.map((a) => ({
    id:         a.id,
    entityType: a.entityType,
    action:     a.action,
    timestamp:  a.timestamp.toISOString(),
    userId:     a.userId,
  }));

  const serializedHospitals = doctorLinks.map((l) => ({
    id:        l.hospital.id,
    name:      l.hospital.name,
    shortCode: l.hospital.shortCode,
    address:   l.hospital.address ?? "",
    contact:   l.hospital.contact ?? "",
  }));

  return (
    <DoctorSettingsClient
      users={serializedUsers}
      auditLogs={serializedAudit}
      hospitals={serializedHospitals}
      doctor={doctorProfile ? {
        id: doctorProfile.id,
        name: doctorProfile.name,
        shortCode: doctorProfile.shortCode ?? "",
        specialty: doctorProfile.specialty ?? "",
        contact: doctorProfile.contact ?? "",
        credentials: doctorProfile.credentials ?? "",
      } : null}
    />
  );
}
