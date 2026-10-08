import { requirePermission, scopeDoctorId } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { startOfDay, subDays, format } from "date-fns";
import { complaintText } from "@/lib/appointment-cc";
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
  const diagnosisFilter    = sp.diagnosis    ?? "";
  const diagnosisLatFilter = sp.diagnosisLat ?? "";
  const complaintFilter    = sp.complaint    ?? "";
  const complaintLatFilter = sp.complaintLat ?? "";
  const activeCard     = sp.card      ?? "";
  const rawOpStatus    = sp.opStatus  ?? "dispensed";
  const opStatusFilter = rawOpStatus === "all" ? "" : rawOpStatus;
  const sortBy         = sp.sort      ?? "lastvisit";
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
  } else if (user.hospitalId) {
    // Any hospital-affiliated user — the shared HOSPITAL login and every named
    // staff role alike — sees only their own hospital's patients.
    scopeConds.push({ registeredAtId: user.hospitalId });
  } else {
    // No doctor scope and no hospital: match nothing. An empty condition list
    // would fall through to `{}` and return every patient in the database.
    scopeConds.push({ id: "__no_scope__" });
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
  // Diagnosis is a controlled description, so it matches exactly. A chief
  // complaint is a composite string ("RE | Since: 3 days | Eye Pain"), so the
  // option value is the complaint text and it matches on contains.
  if (diagnosisFilter || diagnosisLatFilter) {
    const dxConds: any[] = [];
    if (diagnosisFilter)    dxConds.push({ description: { contains: diagnosisFilter,  mode: "insensitive" as const } });
    if (diagnosisLatFilter) dxConds.push({ laterality: diagnosisLatFilter });
    listConds.push({
      visits: { some: { diagnoses: { some: dxConds.length === 1 ? dxConds[0] : { AND: dxConds } } } },
    });
  }
  if (complaintFilter || complaintLatFilter) {
    const ccConds: any[] = [];
    if (complaintFilter)    ccConds.push({ chiefComplaint: { contains: complaintFilter,     mode: "insensitive" as const } });
    if (complaintLatFilter) ccConds.push({
      OR: [
        { chiefComplaint: { contains: `[${complaintLatFilter}]`, mode: "insensitive" as const } },
        { chiefComplaint: { contains: `${complaintLatFilter} |`,  mode: "insensitive" as const } },
      ],
    });
    listConds.push({
      visits: { some: { generalExam: ccConds.length === 1 ? ccConds[0] : { AND: ccConds } } },
    });
  }
  const listToday    = startOfDay(new Date());
  const listTodayEnd = new Date(listToday); listTodayEnd.setHours(23, 59, 59, 999);
  if (opStatusFilter === "dispensed") {
    listConds.push({ appointments: { some: { status: "DISPENSED", dateTime: { gte: listToday, lte: listTodayEnd } } } });
  }
  if (opStatusFilter === "totaldispensed") {
    // Patients with at least one completed consultation who are NOT currently in queue today
    listConds.push({
      AND: [
        { appointments: { some: { status: "DISPENSED" } } },
        { appointments: { none: { status: { in: ["CONFIRMED", "PARTIAL_DISPENSE"] }, dateTime: { gte: listToday, lte: listTodayEnd } } } },
      ],
    });
  }
  if (opStatusFilter === "noshowreg") {
    listConds.push({ appointments: { some: {
      dateTime: { gte: listToday, lte: listTodayEnd },
      status:   { in: ["CONFIRMED", "PARTIAL_DISPENSE"] },
      OR: [{ isWalkIn: true }, { arrivedAt: { not: null } }],
    }}});
  }

  const listWhere: any = listConds.length > 0 ? { AND: listConds } : {};

  // Filter options come from scopeWhere, not listWhere: they must stay stable
  // as filters are applied, otherwise picking a diagnosis empties the complaint
  // list and the user cannot get back. Capped so a large practice cannot build
  // a thousand-row <select>.
  const OPTION_CAP = 200;
  const [diagnosisRows, complaintRows] = await Promise.all([
    prisma.diagnosis.findMany({
      where: { visit: { patient: scopeWhere } },
      select: { description: true },
      distinct: ["description"],
      orderBy: { description: "asc" },
      take: OPTION_CAP,
    }),
    prisma.generalExamination.findMany({
      where: { chiefComplaint: { not: null }, visit: { patient: scopeWhere } },
      select: { chiefComplaint: true },
      distinct: ["chiefComplaint"],
      take: OPTION_CAP * 3,
    }),
  ]);
  const diagnosisOptions = diagnosisRows.map(d => d.description).filter(Boolean);
  // Reduce "RE | Since: 3 days | Eye Pain Severe" to "Eye Pain Severe" so the
  // dropdown lists complaints rather than one entry per laterality/duration
  // permutation. The stored value still matches via `contains`.
  const complaintOptions = [...new Set(
    complaintRows
      .map(r => complaintText(r.chiefComplaint))
      .filter((t): t is string => !!t),
  )].sort((a, b) => a.localeCompare(b)).slice(0, OPTION_CAP);
  const orderBy: any   =
    sortBy === "oldest" ? { createdAt: "asc"  } :
    sortBy === "name"   ? { name:      "asc"  } :
                          { createdAt: "desc" };

  const patientInclude = {
    registeredAt: { select: { name: true } },
    visits: {
      orderBy: { date: "desc" as const },
      take: 1,
      select: {
        id: true,
        date: true,
        finalizedAt: true,
        generalExam: { select: { chiefComplaint: true } },
        appointment: { select: { id: true, arrivedAt: true, status: true, consultationStatus: true } },
        diagnoses: { select: { description: true, laterality: true }, orderBy: { createdAt: "asc" as const }, take: 4 },
      },
    },
  };

  // For lastvisit sort: fetch all IDs+dates, sort in JS, then paginate
  let total: number;
  let patients: Awaited<ReturnType<typeof prisma.patient.findMany<{ include: typeof patientInclude }>>>;

  if (sortBy === "lastvisit") {
    const allSlim = await prisma.patient.findMany({
      where:  listWhere,
      select: { id: true, visits: { orderBy: { date: "desc" }, take: 1, select: { date: true } } },
    });
    allSlim.sort((a, b) => (b.visits[0]?.date?.getTime() ?? 0) - (a.visits[0]?.date?.getTime() ?? 0));
    total = allSlim.length;
    const pageIds = allSlim.slice((page - 1) * pageSize, page * pageSize).map(p => p.id);
    const pageRows = await prisma.patient.findMany({ where: { id: { in: pageIds } }, include: patientInclude });
    patients = pageIds.map(id => pageRows.find(p => p.id === id)!).filter(Boolean) as typeof pageRows;
  } else {
    [total, patients] = await Promise.all([
      prisma.patient.count({ where: listWhere }),
      prisma.patient.findMany({ where: listWhere, orderBy, include: patientInclude, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
  }

  const today     = startOfDay(new Date());
  const weekStart = subDays(today, 6);
  const doctorId  = user.role === "DOCTOR" ? scopeDoctorId(user) : null;
  const apptScope = isHospital
    ? { hospitalId: user.hospitalId! }
    : doctorId
    ? { doctorId }
    : {};

  const todayEnd = new Date(today); todayEnd.setHours(23, 59, 59, 999);

  const [
    totalDispensed,
    insurancePatients,
    todayDispensed,
    catGroups,
    trendRaw,
    recentReg,
    noShowReg,
  ] = await Promise.all([
    // All-time dispensed: completed at least one consultation ever AND not currently in queue today
    prisma.patient.count({
      where: {
        AND: [
          ...scopeConds,
          { appointments: { some:  { status: "DISPENSED" } } },
          { appointments: { none:  { status: { in: ["CONFIRMED", "PARTIAL_DISPENSE"] }, dateTime: { gte: today, lte: todayEnd } } } },
        ],
      },
    }),
    prisma.patient.count({ where: { AND: [...scopeConds, { category: { in: ["ECHS", "INSURANCE"] } }] } }),
    prisma.patient.count({
      where: { AND: [...scopeConds, { appointments: { some: { status: "DISPENSED", dateTime: { gte: today, lte: todayEnd } } } }] },
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
    // Patients who physically arrived today but didn't complete consultation.
    // Walk-ins skip the arrivedAt flow so match on isWalkIn; regular appointments
    // need arrivedAt set (meaning they were actually moved into the queue).
    prisma.appointment.findMany({
      where: {
        ...apptScope,
        dateTime: { gte: today, lte: todayEnd },
        status:   { in: ["CONFIRMED", "PARTIAL_DISPENSE"] },
        OR: [
          { isWalkIn: true },
          { arrivedAt: { not: null } },
        ],
      },
      include: {
        patient: { select: { name: true, udid: true, uhid: true, age: true, sex: true, mobile: true, photoUrl: true } },
      },
      orderBy: { arrivedAt: "asc" },
    }),
  ]);

  // 7-day registration trend — single-pass bucket reduce (O(N) not O(7N))
  const trendBuckets: Record<string, number> = {};
  for (const p of trendRaw) {
    const key = format(new Date(p.createdAt), "yyyy-MM-dd");
    trendBuckets[key] = (trendBuckets[key] ?? 0) + 1;
  }
  const trendData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    const dayStr = format(d, "yyyy-MM-dd");
    return {
      label:   i === 6 ? "Today" : format(d, "EEE"),
      count:   trendBuckets[dayStr] ?? 0,
      isToday: i === 6,
    };
  });

  // dispensedApptId comes from the visit's linked appointment (already fetched above).
  // This ensures Undo targets the exact appointment tied to the finalized visit,
  // not an unrelated appointment that also happens to be DISPENSED today.

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
    queueTime:     p.visits[0]?.appointment?.arrivedAt?.toISOString() ?? null,
    finalizeTime:  p.visits[0]?.finalizedAt?.toISOString() ?? null,
    chiefComplaint: p.visits[0]?.generalExam?.chiefComplaint ?? (p as any).complaint ?? null,
    photoUrl:      p.photoUrl ?? null,
    dispensedApptId: (
      p.visits[0]?.appointment?.status === "DISPENSED" &&
      p.visits[0]?.appointment?.consultationStatus === "FINALIZED" &&
      p.visits[0]?.finalizedAt != null
    ) ? (p.visits[0].appointment?.id ?? null) : null,
    diagnoses: (p.visits[0] as any)?.diagnoses?.map((d: any) => ({ description: d.description, laterality: d.laterality ?? null })) ?? [],
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

  const noShowRegSerialized = noShowReg.map((a) => ({
    id:        a.id,
    arrivedAt: a.arrivedAt?.toISOString() ?? null,
    status:    a.status,
    isWalkIn:  a.isWalkIn,
    patient: {
      name:     a.patient.name,
      udid:     a.patient.udid ?? "",
      uhid:     a.patient.uhid ?? "",
      age:      a.patient.age,
      sex:      a.patient.sex,
      mobile:   a.patient.mobile,
      photoUrl: a.patient.photoUrl ?? null,
    },
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
        diagnosisFilter={diagnosisFilter}
        diagnosisLatFilter={diagnosisLatFilter}
        complaintFilter={complaintFilter}
        complaintLatFilter={complaintLatFilter}
        diagnosisOptions={diagnosisOptions}
        complaintOptions={complaintOptions}
        opStatusFilter={rawOpStatus}
        doctorHospitals={doctorHospitals}
        sortBy={sortBy}
        isHospital={isHospital}
        activeCard={activeCard}
        kpis={{ totalDispensed, insurancePatients, todayDispensed }}
        trendData={trendData}
        catDist={catGroups.map(g => ({ category: g.category, count: g._count.id }))}
        recentReg={recentSerialized}
        noShowReg={noShowRegSerialized}
      />
    </div>
  );
}
