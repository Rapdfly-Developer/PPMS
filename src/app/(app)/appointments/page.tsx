import { requirePermission, scopeDoctorId } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { istDayRange, istTodayStr } from "@/lib/ist";
import { autoCloseStaleVisits } from "@/lib/autoClose";
import { AppointmentsClient } from "./AppointmentsClient";

async function expireStaleRequested() {
  await prisma.appointment.updateMany({
    where: {
      status: "REQUESTED",
      dateTime: { lt: istDayRange(istTodayStr()).dayStart },
    },
    data: { status: "NO_SHOW" },
  });
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp   = await searchParams;
  const user = await requirePermission("appointments.view");

  // Silently expire any REQUESTED appointments from previous days
  await expireStaleRequested();
  // EOD sweep: close IN_PROGRESS visits left over from previous days
  await autoCloseStaleVisits();

  const dateParam     = sp.date ?? "";
  const statusParam   = sp.status ?? "ALL";
  const search        = (sp.search ?? "").trim();
  const view          = sp.view === "table" ? "table" : "card";
  const page          = Math.max(1, parseInt(sp.page ?? "1", 10));
  const pageSize      = [10, 25, 50, 100].includes(parseInt(sp.pageSize ?? "25", 10))
    ? parseInt(sp.pageSize ?? "25", 10) : 25;
  const doctorIdParam  = sp.doctor   ?? "";
  const visitTypeParam = sp.visitType ?? "";
  const deptParam      = sp.dept     ?? "";
  const booked         = !!sp.booked;
  const isHospital     = user.role === "HOSPITAL";

  // ── Date range (IST calendar day) ──────────────────────────────────────
  const today = istTodayStr();
  const validDateParam = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : "";
  const { dayStart, dayEnd } = istDayRange(validDateParam || today);
  const dateFilter = { gte: dayStart, lte: dayEnd };

  // ── Build where clause ─────────────────────────────────────────────────
  const where: any = {};

  const isPastDate = !!validDateParam && validDateParam < today;

  if (user.role === "DOCTOR") {
    where.doctorId = scopeDoctorId(user);
    // Show only the selected day (defaults to today); other days via the date picker
    where.dateTime = dateFilter;
    // For past dates show everything; for today/future hide NO_SHOW/CANCELLED by default
    if (statusParam === "ALL" && !isPastDate) {
      where.status = { in: ["REQUESTED", "SCHEDULED", "CONFIRMED", "DISPENSED"] };
    }
  } else if (user.role === "HOSPITAL") {
    where.hospitalId = user.hospitalId;
    where.dateTime = dateFilter;
  } else {
    where.dateTime = dateFilter;
  }

  if (statusParam !== "ALL") where.status = statusParam;

  if (doctorIdParam) {
    where.doctorId = doctorIdParam;
  } else if (deptParam) {
    where.doctor = { specialty: { contains: deptParam, mode: "insensitive" as const } };
  }

  if (visitTypeParam) where.visitType = { contains: visitTypeParam, mode: "insensitive" as const };

  if (search) {
    where.patient = {
      OR: [
        { name:   { contains: search, mode: "insensitive" as const } },
        { udid:   { contains: search, mode: "insensitive" as const } },
        { mobile: { contains: search, mode: "insensitive" as const } },
      ],
    };
  }

  // ── Fetch ───────────────────────────────────────────────────────────────
  const hospitalParam = sp.hospital ?? "";
  if (hospitalParam && user.role === "DOCTOR") {
    where.hospitalId = hospitalParam;
  }

  const [total, appts, doctors, hospitals] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({
      where,
      include: {
        hospital: true,
        patient:  true,
        doctor:   { select: { id: true, name: true, specialty: true } },
        visit:    true,
      },
      orderBy: { dateTime: "asc" },
      skip:    (page - 1) * pageSize,
      take:    pageSize,
    }),
    isHospital
      ? prisma.doctor.findMany({
          where: { hospitalLinks: { some: { hospitalId: user.hospitalId! } } },
          select: { id: true, name: true, specialty: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    user.role === "DOCTOR"
      ? prisma.doctorHospitalLink.findMany({
          where: { doctorId: scopeDoctorId(user), active: true },
          include: { hospital: { select: { id: true, name: true } } },
        }).then(links => links.map(l => l.hospital))
      : Promise.resolve([]),
  ]);

  return (
    <div className="fade-in">
      <AppointmentsClient
        appointments={appts as any}
        total={total}
        page={page}
        pageSize={pageSize}
        view={view}
        role={user.role}
        isHospital={isHospital}
        dateParam={dateParam}
        statusParam={statusParam}
        search={search}
        doctorIdParam={doctorIdParam}
        visitTypeParam={visitTypeParam}
        deptParam={deptParam}
        hospitalParam={hospitalParam}
        doctors={doctors}
        hospitals={hospitals}
        booked={booked}
      />
    </div>
  );
}
