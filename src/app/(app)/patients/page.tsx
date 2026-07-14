import { requirePermission, scopeDoctorId } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { startOfDay, subDays, format } from "date-fns";
import { PatientsClient } from "./PatientsClient";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp   = await searchParams;
  const user = await requirePermission("patients.view");
  const isHospital = user.role === "HOSPITAL";

  const q              = (sp.q        ?? "").trim();
  const categoryFilter = sp.category  ?? "";
  const sexFilter      = sp.sex       ?? "";
  const hospitalFilter = sp.hospital  ?? "";
  const opStatusFilter = sp.opStatus  ?? "";
  const sortBy         = sp.sort      ?? "newest";
  const registered     = sp.registered ?? "";
  const page     = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = ([10, 25, 50] as number[]).includes(parseInt(sp.size ?? "25", 10))
    ? parseInt(sp.size ?? "25", 10) : 25;

  // ── Scope conditions ────────────────────────────────────────────────────────
  const scopeConds: any[] = [];
  let doctorHospitals: { id: string; name: string }[] = [];
  if (user.role === "DOCTOR") {
    const doctorId = scopeDoctorId(user);
    const links = await prisma.doctorHospitalLink.findMany({
      where: { doctorId, active: true },
      include: { hospital: { select: { id: true, name: true } } },
    });
    const hospitalIds = links.map(l => l.hospitalId);
    doctorHospitals = links.map(l => ({ id: l.hospital.id, name: l.hospital.name }));
    scopeConds.push({
      OR: [
        { doctorId },
        ...(hospitalIds.length > 0 ? [{ registeredAtId: { in: hospitalIds } }] : []),
      ],
    });
  } else if (user.role === "HOSPITAL") {
    scopeConds.push({ registeredAtId: user.hospitalId });
  }

  const scopeWhere: any = scopeConds.length > 0 ? { AND: scopeConds } : {};

  // ── List conditions ─────────────────────────────────────────────────────────
  const listConds = [...scopeConds];
  if (q) {
    listConds.push({
      OR: [
        { name:   { contains: q, mode: "insensitive" as const } },
        { udid:   { contains: q, mode: "insensitive" as const } },
        { mobile: { contains: q, mode: "insensitive" as const } },
      ],
    });
  }
  if (categoryFilter) listConds.push({ category: categoryFilter });
  if (sexFilter)      listConds.push({ sex: sexFilter });
  if (hospitalFilter) listConds.push({ registeredAtId: hospitalFilter });
  if (opStatusFilter === "surgery")    listConds.push({ visits: { some: { surgicalCounselling: { isNot: null } } } });
  if (opStatusFilter === "admitted")   listConds.push({ visits: { some: { admission: { discharged: false } } } });
  if (opStatusFilter === "discharged") listConds.push({ visits: { some: { admission: { discharged: true  } } } });

  const listWhere: any = listConds.length > 0 ? { AND: listConds } : {};
  const orderBy: any   =
    sortBy === "oldest" ? { createdAt: "asc"  } :
    sortBy === "name"   ? { name:      "asc"  } :
                          { createdAt: "desc" };

  const today     = startOfDay(new Date());
  const weekStart = subDays(today, 6);
  const doctorId  = user.role === "DOCTOR" ? scopeDoctorId(user) : null;
  const apptScope = isHospital
    ? { hospitalId: user.hospitalId! }
    : doctorId
    ? { doctorId }
    : {};

  const [
    total,
    patients,
    totalPatients,
    todayReg,
    insurancePatients,
    followUpCount,
    pendingRequests,
    catGroups,
    trendRaw,
    recentReg,
  ] = await Promise.all([
    prisma.patient.count({ where: listWhere }),
    prisma.patient.findMany({
      where:   listWhere,
      orderBy,
      include: {
        registeredAt: { select: { name: true } },
        visits: {
          orderBy: { date: "desc" },
          take: 1,
          select: { date: true, generalExam: { select: { chiefComplaint: true } } },
        },
      },
      skip:    (page - 1) * pageSize,
      take:    pageSize,
    }),
    prisma.patient.count({ where: scopeWhere }),
    prisma.patient.count({ where: { AND: [...scopeConds, { createdAt: { gte: today } }] } }),
    prisma.patient.count({ where: { AND: [...scopeConds, { category: { in: ["ECHS", "INSURANCE"] } }] } }),
    prisma.appointment.count({
      where: {
        ...apptScope,
        visitType: { contains: "follow", mode: "insensitive" as const },
        status:    { notIn: ["CANCELLED", "NO_SHOW"] },
        dateTime:  { gte: today },
      },
    }),
    prisma.appointment.count({
      where: { ...apptScope, status: "REQUESTED" },
    }),
    prisma.patient.groupBy({
      by:    ["category"],
      where: scopeWhere,
      _count: { id: true },
    }),
    prisma.patient.findMany({
      where:   { AND: [...scopeConds, { createdAt: { gte: weekStart } }] },
      select:  { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.patient.findMany({
      where:   scopeWhere,
      orderBy: { createdAt: "desc" },
      take:    6,
      select:  { name: true, udid: true, uhid: true, sex: true, age: true, category: true, createdAt: true, mobile: true, photoUrl: true },
    }),
  ]);

  // 7-day registration trend
  const trendData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    const dayStr = format(d, "yyyy-MM-dd");
    return {
      label:   i === 6 ? "Today" : format(d, "EEE"),
      count:   trendRaw.filter(p => format(new Date(p.createdAt), "yyyy-MM-dd") === dayStr).length,
      isToday: i === 6,
    };
  });

  const serialized = patients.map(p => ({
    id:           p.id,
    udid:         p.udid ?? "",
    uhid:         p.uhid ?? "",
    name:         p.name,
    age:          p.age,
    sex:          p.sex,
    mobile:       p.mobile,
    category:     p.category,
    createdAt:     p.createdAt.toISOString(),
    hospitalName:  p.registeredAt?.name ?? null,
    lastVisit:     p.visits[0]?.date.toISOString() ?? null,
    chiefComplaint: p.visits[0]?.generalExam?.chiefComplaint ?? null,
    photoUrl:      p.photoUrl ?? null,
  }));

  const recentSerialized = recentReg.map(p => ({
    name:      p.name,
    udid:      p.udid ?? "",
    sex:       p.sex,
    age:       p.age,
    category:  p.category,
    createdAt: p.createdAt.toISOString(),
    mobile:    p.mobile,
    photoUrl:  p.photoUrl ?? null,
  }));

  return (
    <div className="fade-in">
      {registered && (
        <div className="mb-4 rounded-xl bg-[var(--color-success-100)] text-[var(--color-success-600)] px-4 py-3 text-sm font-medium border border-[var(--color-success-200)]">
          Patient registered successfully. UHID{" "}
          <span className="font-mono">{registered}</span> has been generated.
        </div>
      )}
      <PatientsClient
        patients={serialized}
        total={total}
        page={page}
        pageSize={pageSize}
        q={q}
        categoryFilter={categoryFilter}
        sexFilter={sexFilter}
        hospitalFilter={hospitalFilter}
        opStatusFilter={opStatusFilter}
        doctorHospitals={doctorHospitals}
        sortBy={sortBy}
        isHospital={isHospital}
        kpis={{ totalPatients, todayReg, followUpCount, insurancePatients, pendingRequests }}
        trendData={trendData}
        catDist={catGroups.map(g => ({ category: g.category, count: g._count.id }))}
        recentReg={recentSerialized}
      />
    </div>
  );
}
