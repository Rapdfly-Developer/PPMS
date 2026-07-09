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

  // Fetch doctor's linked hospitals first so we can scope users to them
  const doctorLinksEarly = await prisma.doctorHospitalLink.findMany({
    where: { doctorId },
    select: { hospitalId: true },
  });
  const linkedHospitalIds = doctorLinksEarly.map((l) => l.hospitalId);

  const assignableRoles = await prisma.role.findMany({
    where: { name: { not: "DOCTOR" }, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { name: true, label: true, color: true },
  });

  const [allUsers, auditLogs, doctorLinks, doctorProfile, loginLogs, patientApptLogs] = await Promise.all([
    // Only show: the doctor himself + staff/refractionists from his linked hospitals
    prisma.user.findMany({
      where: {
        OR: [
          { doctor: { id: doctorId } },
          { hospitalStaff: { hospitalId: { in: linkedHospitalIds } } },
          { refractionist:  { hospitalId: { in: linkedHospitalIds } } },
        ],
      },
      include: {
        hospitalStaff: { select: { name: true, mobile: true, hospitalId: true, hospital: { select: { name: true } } } },
        refractionist:  { select: { name: true, mobile: true, hospitalId: true, hospital: { select: { name: true } } } },
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
      select: { id: true, name: true, shortCode: true, specialty: true, contact: true, credentials: true, email: true, experience: true, medicalRegNumber: true, qualifications: true, signatureUrl: true },
    }),
    // System logs scoped to: this doctor's own logins + logins at his linked hospitals
    prisma.userLoginHistory.findMany({
      where: {
        OR: [
          { userId: user.id },
          { hospitalId: { in: linkedHospitalIds } },
        ],
      },
      orderBy: { loginAt: "desc" },
      take: 100,
    }),
    prisma.auditLog.findMany({
      where: {
        OR: [
          { moduleName: { in: ["Patient", "Appointment"] } },
          { entityType: { in: ["Patient", "Appointment", "Medication", "InvestigationOrder", "Diagnosis"] } },
        ],
      },
      orderBy: { timestamp: "desc" },
      take: 300,
    }),
  ]);

  const serializedUsers = allUsers.map((u) => ({
    id:         u.id,
    username:   u.username,
    role:       u.role,
    email:      u.email ?? "",
    name:       u.doctor?.name ?? u.hospitalStaff?.name ?? u.refractionist?.name ?? u.username,
    createdAt:  u.createdAt.toISOString(),
    hospital:   u.hospitalStaff?.hospital?.name ?? u.refractionist?.hospital?.name ?? null,
    hospitalId: (u.hospitalStaff as any)?.hospitalId ?? (u.refractionist as any)?.hospitalId ?? null,
    active:     u.active,
    mobile:     (u.hospitalStaff as any)?.mobile ?? (u.refractionist as any)?.mobile ?? "",
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
    active:    l.active,
    logoUrl:   (l.hospital as any).logoUrl ?? null,
  }));

  const serializedLoginLogs = loginLogs.map((l) => ({
    id:          l.id,
    userName:    l.userName,
    role:        l.role,
    hospitalName: l.hospitalName ?? null,
    loginAt:     l.loginAt.toISOString(),
    logoutAt:    l.logoutAt?.toISOString() ?? null,
    ipAddress:   l.ipAddress ?? null,
    userAgent:   l.userAgent ?? null,
    status:      l.status,
    isActive:    l.isActive,
  }));

  const serializedPatientApptLogs = patientApptLogs.map((l) => ({
    id:         l.id,
    entityType: l.entityType,
    entityId:   l.entityId,
    action:     l.action,
    actionType: l.actionType ?? null,
    moduleName: l.moduleName ?? l.entityType,
    userName:   l.userName ?? null,
    hospitalId: l.hospitalId ?? null,
    newValue:   l.newValue ?? null,
    oldValue:   l.oldValue ?? null,
    timestamp:  l.timestamp.toISOString(),
  }));

  return (
    <DoctorSettingsClient
      users={serializedUsers}
      auditLogs={serializedAudit}
      hospitals={serializedHospitals}
      loginLogs={serializedLoginLogs}
      patientApptLogs={serializedPatientApptLogs}
      assignableRoles={assignableRoles}
      doctor={doctorProfile ? {
        id: doctorProfile.id,
        name: doctorProfile.name,
        shortCode: doctorProfile.shortCode ?? "",
        specialty: doctorProfile.specialty ?? "",
        contact: doctorProfile.contact ?? "",
        credentials: doctorProfile.credentials ?? "",
        email: doctorProfile.email ?? "",
        experience: doctorProfile.experience ?? "",
        medicalRegNumber: doctorProfile.medicalRegNumber ?? "",
        qualifications: doctorProfile.qualifications ?? "",
        signatureUrl: doctorProfile.signatureUrl ?? "",
      } : null}
    />
  );
}
