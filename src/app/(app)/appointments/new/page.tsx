import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { NewEncounterForm } from "./NewEncounterForm";

// ── IST helpers ───────────────────────────────────────────────────────────────

function getISTNow() {
  const istDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = istDate.getHours();
  const m = istDate.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return {
    timeHHMM:    `${pad(h)}:${pad(m)}`,
    displayTime: `${h12}:${pad(m)} ${ampm}`,
    weekday:     istDate.getDay(), // 0=Sun … 6=Sat
    dateStr:     `${istDate.getFullYear()}-${pad(istDate.getMonth() + 1)}-${pad(istDate.getDate())}`,
    isMorning:   h < 12,
  };
}

function inRange(time: string, start: string, end: string) {
  return time >= start && time <= end;
}

// ── Auto-detect which hospital the doctor is currently scheduled at ───────────

async function detectCurrentHospital(
  doctorId: string,
  linkedHospitals: { id: string; name: string }[],
): Promise<{ id: string; name: string } | null> {
  if (!linkedHospitals.length) return null;

  const { timeHHMM, weekday, dateStr, isMorning } = getISTNow();
  const hospitalMap = new Map(linkedHospitals.map((h) => [h.id, h]));
  const hospitalIds = linkedHospitals.map((h) => h.id);

  const todayStart = new Date(`${dateStr}T00:00:00+05:30`);
  const todayEnd   = new Date(`${dateStr}T23:59:59+05:30`);

  // 1. DoctorLeave — approved leave blocks the day (or half)
  const leave = await prisma.doctorLeave.findFirst({
    where: {
      doctorId,
      status: "APPROVED",
      date: { gte: todayStart, lte: todayEnd },
      OR: [{ hospitalId: null }, { hospitalId: { in: hospitalIds } }],
    },
  });
  if (leave) {
    if (leave.leaveType === "FULL_DAY") return null;
    // HALF_DAY: morning = before 12:00, afternoon = 12:00+
    if (leave.halfPeriod === "MORNING"   && isMorning)  return null;
    if (leave.halfPeriod === "AFTERNOON" && !isMorning) return null;
  }

  // 2. ScheduleException — LEAVE/HOLIDAY blocks; EXTRA_OP adds availability
  const exceptions = await prisma.scheduleException.findMany({
    where: {
      doctorId,
      status: "ACTIVE",
      date: { gte: todayStart, lte: todayEnd },
      OR: [{ hospitalId: null }, { hospitalId: { in: hospitalIds } }],
    },
  });
  for (const ex of exceptions) {
    const exStart = ex.startTime ?? "00:00";
    const exEnd   = ex.endTime   ?? "23:59";
    if ((ex.type === "LEAVE" || ex.type === "HOLIDAY") && inRange(timeHHMM, exStart, exEnd)) {
      // Applies to all hospitals (null) or to specific one
      if (!ex.hospitalId) return null;
      // Specific hospital blocked — remove from candidates below, don't return null yet
    }
    if (ex.type === "EXTRA_OP" && ex.hospitalId && ex.startTime && ex.endTime) {
      if (inRange(timeHHMM, ex.startTime, ex.endTime) && hospitalMap.has(ex.hospitalId)) {
        return hospitalMap.get(ex.hospitalId)!;
      }
    }
  }
  // Collect hospitalIds blocked by targeted LEAVE/HOLIDAY exceptions
  const blockedIds = new Set(
    exceptions
      .filter((ex) => (ex.type === "LEAVE" || ex.type === "HOLIDAY") && ex.hospitalId)
      .filter((ex) => inRange(timeHHMM, ex.startTime ?? "00:00", ex.endTime ?? "23:59"))
      .map((ex) => ex.hospitalId as string),
  );

  // 3. IndividualDayAvailability — date-specific override (replaces weekly/generated for that day)
  const individual = await prisma.individualDayAvailability.findMany({
    where: {
      doctorId,
      status: "ACTIVE",
      date: { gte: todayStart, lte: todayEnd },
      hospitalId: { in: hospitalIds },
    },
  });
  if (individual.length > 0) {
    // Individual records exist → they are authoritative for today; don't fall through
    for (const slot of individual) {
      if (!blockedIds.has(slot.hospitalId) && inRange(timeHHMM, slot.startTime, slot.endTime)) {
        return hospitalMap.get(slot.hospitalId) ?? null;
      }
    }
    return null;
  }

  // 4. GeneratedSchedule — materialized schedule
  const generated = await prisma.generatedSchedule.findMany({
    where: {
      doctorId,
      date: { gte: todayStart, lte: todayEnd },
      hospitalId: { in: hospitalIds },
    },
  });
  if (generated.length > 0) {
    for (const slot of generated) {
      if (!blockedIds.has(slot.hospitalId) && inRange(timeHHMM, slot.startTime, slot.endTime)) {
        return hospitalMap.get(slot.hospitalId) ?? null;
      }
    }
    return null;
  }

  // 5. Fallback: weekly DoctorAvailability template
  const weekly = await prisma.doctorAvailability.findMany({
    where: {
      doctorId,
      status: "ACTIVE",
      weekday,
      hospitalId: { in: hospitalIds },
    },
  });
  for (const slot of weekly) {
    if (!blockedIds.has(slot.hospitalId) && inRange(timeHHMM, slot.startTime, slot.endTime)) {
      return hospitalMap.get(slot.hospitalId) ?? null;
    }
  }

  return null;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function NewEncounterPage() {
  const user = await requireRole("DOCTOR");

  const patients = await prisma.patient.findMany({
    where: { doctorId: user.profileId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, udid: true, age: true, sex: true },
  });

  const links = await prisma.doctorHospitalLink.findMany({
    where: { doctorId: user.profileId!, active: true },
    include: { hospital: { select: { id: true, name: true } } },
  });
  const hospitals = links.map((l) => l.hospital);

  const { displayTime } = getISTNow();
  const autoHospital = await detectCurrentHospital(user.profileId!, hospitals);

  return (
    <NewEncounterForm
      patients={patients.map((p) => ({ ...p, udid: p.udid ?? "" }))}
      autoHospital={autoHospital}
      currentTimeIST={displayTime}
    />
  );
}
