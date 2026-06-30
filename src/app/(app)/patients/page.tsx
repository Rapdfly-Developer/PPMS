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
  const sortBy         = sp.sort      ?? "newest";
  const registered     = sp.registered ?? "";
  const page     = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = ([10, 25, 50] as number[]).includes(parseInt(sp.size ?? "25", 10))
    ? parseInt(sp.size ?? "25", 10) : 25;

  // ── Scope conditions ────────────────────────────────────────────────────────
  const scopeConds: any[] = [];
  if (user.role === "DOCTOR") {
    const doctorId = scopeDoctorId(user);
    const links = await prisma.doctorHospitalLink.findMany({
      where: { doctorId, active: true },
      select: { hospitalId: true },
    });
    const hospitalIds = links.map(l => l.hospitalId);
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

  const listWhere: any = listConds.length > 0 ? { AND: listConds } : {};
  const orderBy: any   =
    sortBy === "oldest" ? { createdAt: "asc"  } :
    sortBy === "name"   ? { name:      "asc"  } :
                          { createdAt: "desc" };

  const today     = startOfDay(new Date());
  const weekStart = subDays(today, 6);
  const apptScope = isHospital ? { hospitalId: user.hospitalId! } : {};

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
        visits: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
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
      select:  { name: true, udid: true, sex: true, age: true, category: true, createdAt: true, mobile: true },
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
    udid:         p.udid,
    name:         p.name,
    age:          p.age,
    sex:          p.sex,
    mobile:       p.mobile,
    category:     p.category,
    createdAt:    p.createdAt.toISOString(),
    hospitalName: p.registeredAt?.name ?? null,
    lastVisit:    p.visits[0]?.date.toISOString() ?? null,
  }));

  const recentSerialized = recentReg.map(p => ({
    name:      p.name,
    udid:      p.udid,
    sex:       p.sex,
    age:       p.age,
    category:  p.category,
    createdAt: p.createdAt.toISOString(),
    mobile:    p.mobile,
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
