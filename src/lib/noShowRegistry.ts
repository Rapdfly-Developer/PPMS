import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { format, startOfDay, subDays } from "date-fns";
import { istTodayRange } from "@/lib/ist";
import { computeFollowUpStatus } from "@/lib/followUpStatus";
import { scopeDoctorId, type SessionUser } from "@/lib/rbac";
import type { NoShowKind } from "@/lib/noShowKinds";

/**
 * Patient Library "No Show Registry". One record per missed encounter, of three kinds:
 *  1. Incomplete visit   — patient reached the queue on a previous day but the doctor
 *                          never finalized the consultation (incl. EOD auto-closed visits).
 *  2. Appointment no-show — booked for a previous day, never reached the queue (no visit).
 *  3. Follow-up no-show  — follow-up the Follow-ups page shows as "No Show".
 * The card count and the list are both derived from these records, so they always agree.
 */
export type NoShowRecord = {
  id: string;
  kind: NoShowKind;
  patientId: string;
  arrivedAt: Date | null;
  dateTime: Date;
  status: string;
  isWalkIn: boolean;
  visitType: string;
  hospitalName: string | null;
  doctorName: string | null;
  visitStarted: boolean;
  patient: { name: string; udid: string | null; uhid: string | null; age: number; sex: string; mobile: string | null; photoUrl: string | null };
};

const PATIENT_SELECT = { name: true, udid: true, uhid: true, age: true, sex: true, mobile: true, photoUrl: true } as const;

export type NoShowScope = {
  scope: { doctorId: string } | { hospitalId: string } | { id: string };
  patientScope: Prisma.PatientWhereInput;
};

/**
 * Who sees which no-show records — the same rule as the Patient Library list:
 * a doctor sees their own appointments/visits for patients they own or that are
 * registered at their active hospitals; hospital staff see their hospital's
 * records for patients registered there. Used by the library and the patient
 * profile so both always show the same records.
 */
export async function noShowScopeFor(user: SessionUser): Promise<NoShowScope> {
  if (user.role === "DOCTOR") {
    const doctorId = scopeDoctorId(user);
    const links = await prisma.doctorHospitalLink.findMany({
      where: { doctorId, active: true },
      select: { hospitalId: true },
    });
    const hospitalIds = links.map(l => l.hospitalId);
    return {
      scope: { doctorId },
      patientScope: { OR: [{ doctorId }, ...(hospitalIds.length > 0 ? [{ registeredAtId: { in: hospitalIds } }] : [])] },
    };
  }
  if (user.hospitalId) {
    return { scope: { hospitalId: user.hospitalId }, patientScope: { registeredAtId: user.hospitalId } };
  }
  return { scope: { id: "__no_match__" }, patientScope: { id: "__no_scope__" } };
}

export async function getNoShowRegistry(
  { scope, patientScope: baseScope }: NoShowScope,
  /** Restrict to one patient (patient profile). */
  onlyPatientId?: string,
): Promise<NoShowRecord[]> {
  const patientScope: Prisma.PatientWhereInput = onlyPatientId
    ? { AND: [baseScope, { id: onlyPatientId }] }
    : baseScope;
  const { dayStart: todayIST } = istTodayRange();

  const [incomplete, apptNoShows, fuCandidates] = await Promise.all([
    // 1. Incomplete visit
    prisma.appointment.findMany({
      where: {
        ...scope,
        patient:  patientScope,
        visit:    { isNot: null },
        dateTime: { lt: todayIST },
        status:   { notIn: ["CANCELLED", "RESCHEDULED", "PARTIAL_DISPENSE"] },
        // `not: "FINALIZED"` alone would skip NULL, which is the unfinalized case.
        OR: [{ consultationStatus: null }, { consultationStatus: { not: "FINALIZED" } }],
      },
      include: { patient: { select: PATIENT_SELECT }, hospital: { select: { name: true } }, doctor: { select: { name: true } } },
    }),
    // 2. Appointment no-show
    prisma.appointment.findMany({
      where: {
        ...scope,
        patient:  patientScope,
        visit:    null,
        dateTime: { lt: todayIST },
        status:   { notIn: ["CANCELLED", "RESCHEDULED", "DISPENSED", "PARTIAL_DISPENSE"] },
      },
      include: { patient: { select: PATIENT_SELECT }, hospital: { select: { name: true } }, doctor: { select: { name: true } } },
    }),
    // 3. Follow-up no-show candidates (pending, date well past) — exact rule applied below
    prisma.visit.findMany({
      where: {
        ...scope,
        patient:             patientScope,
        followUpDate:        { not: null, lt: subDays(startOfDay(new Date()), 14) },
        followUpCompleted:   false,
        followUpCancelledAt: null,
      },
      select: {
        id: true, patientId: true, visitType: true, followUpDate: true,
        followUpCompleted: true, followUpCancelledAt: true,
        hospital: { select: { name: true } },
        doctor:   { select: { name: true } },
        patient:  { select: PATIENT_SELECT },
      },
    }),
  ]);

  // Follow-up: same appointment / attended-visit checks as the Follow-ups page.
  const fuNoShows: typeof fuCandidates = [];
  if (fuCandidates.length > 0) {
    const today      = new Date();
    const patientIds = [...new Set(fuCandidates.map(v => v.patientId))];
    const originIds  = fuCandidates.map(v => v.id);
    const fuDates    = fuCandidates.map(v => v.followUpDate!);
    const minDate    = new Date(Math.min(...fuDates.map(d => d.getTime())));
    const maxDate    = new Date(Math.max(...fuDates.map(d => d.getTime())));
    minDate.setHours(0, 0, 0, 0);
    maxDate.setHours(23, 59, 59, 999);
    const [appts, consults] = await Promise.all([
      prisma.appointment.findMany({
        where:  { patientId: { in: patientIds }, status: { not: "CANCELLED" }, dateTime: { gte: minDate, lte: maxDate } },
        select: { patientId: true, dateTime: true },
      }),
      prisma.visit.findMany({
        where:  { patientId: { in: patientIds }, id: { notIn: originIds }, date: { gte: minDate, lte: maxDate } },
        select: { patientId: true, date: true },
      }),
    ]);
    const apptSet    = new Set(appts.map(a => `${a.patientId}_${format(a.dateTime, "yyyy-MM-dd")}`));
    const consultSet = new Set(consults.map(c => `${c.patientId}_${format(c.date, "yyyy-MM-dd")}`));
    for (const v of fuCandidates) {
      const key = `${v.patientId}_${format(v.followUpDate!, "yyyy-MM-dd")}`;
      const status = computeFollowUpStatus(v.followUpDate!, v.followUpCompleted, v.followUpCancelledAt, apptSet.has(key), consultSet.has(key), today);
      if (status === "NO_SHOW") fuNoShows.push(v);
    }
  }

  const fromAppt = (a: (typeof incomplete)[number], kind: NoShowKind): NoShowRecord => ({
    id:           a.id,
    kind,
    patientId:    a.patientId,
    arrivedAt:    a.arrivedAt,
    dateTime:     a.dateTime,
    status:       a.status,
    isWalkIn:     a.isWalkIn,
    visitType:    a.visitType,
    hospitalName: a.hospital?.name ?? null,
    doctorName:   a.doctor?.name ?? null,
    visitStarted: false,
    patient:      a.patient,
  });

  return [
    ...incomplete.map(a => ({ ...fromAppt(a, "INCOMPLETE_VISIT"), visitStarted: true })),
    ...apptNoShows.map(a => fromAppt(a, "APPOINTMENT_NO_SHOW")),
    ...fuNoShows.map((v): NoShowRecord => ({
      id:           `fu_${v.id}`,
      kind:         "FOLLOW_UP_NO_SHOW",
      patientId:    v.patientId,
      arrivedAt:    null,
      dateTime:     v.followUpDate!,
      status:       "FOLLOW_UP_NO_SHOW",
      isWalkIn:     false,
      visitType:    v.visitType,
      hospitalName: v.hospital?.name ?? null,
      doctorName:   v.doctor?.name ?? null,
      visitStarted: false,
      patient:      v.patient,
    })),
  ];
}
