import { requireRole, scopeDoctorId, isCustomRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { NewEncounterForm } from "./NewEncounterForm";
import { getDoctorSessions, sessionAt } from "@/lib/doctorSessions";
import { istTodayStr, istHHMM } from "@/lib/ist";

// ── Auto-detect which hospital the doctor is currently scheduled at ───────────
// Uses the same sessions the server checks when the walk-in is saved
// (Hospital Manager calendar, overrides, leave, extra OP, else weekly template).

async function detectCurrentHospital(
  doctorId: string,
  linkedHospitals: { id: string; name: string }[],
): Promise<{ id: string; name: string } | null> {
  if (!linkedHospitals.length) return null;
  const hospitalMap = new Map(linkedHospitals.map((h) => [h.id, h]));
  const now = new Date();
  const sessions = (await getDoctorSessions(doctorId, istTodayStr(now))).filter((s) => hospitalMap.has(s.hospitalId));
  const session = sessionAt(sessions, istHHMM(now));
  return session ? hospitalMap.get(session.hospitalId) ?? null : null;
}

/** "1:33 PM" in IST, for the no-schedule message. */
function istDisplayTime(now: Date = new Date()) {
  const [h, m] = istHHMM(now).split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function NewEncounterPage() {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  const doctorId = scopeDoctorId(user);

  const patients = await prisma.patient.findMany({
    where: { doctorId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, udid: true, age: true, sex: true },
  });

  const displayTime = istDisplayTime();

  let autoHospital: { id: string; name: string } | null = null;

  if (user.role === "DOCTOR") {
    const links = await prisma.doctorHospitalLink.findMany({
      where: { doctorId, active: true },
      include: { hospital: { select: { id: true, name: true } } },
    });
    const hospitals = links.map((l) => l.hospital);
    autoHospital = await detectCurrentHospital(doctorId, hospitals);
  } else if (user.hospitalId) {
    // Hospital staff are assigned to a fixed hospital — no schedule detection needed.
    autoHospital = await prisma.hospital.findUnique({
      where: { id: user.hospitalId },
      select: { id: true, name: true },
    }) ?? null;
  }

  return (
    <NewEncounterForm
      patients={patients.map((p) => ({ ...p, udid: p.udid ?? "" }))}
      autoHospital={autoHospital}
      currentTimeIST={displayTime}
      role={user.role}
    />
  );
}
