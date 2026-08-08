import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { format, isToday, isTomorrow, isPast, startOfDay } from "date-fns";
import Link from "next/link";
import { CalendarClock, User, ChevronRight, AlertCircle, CheckCircle2, Clock } from "lucide-react";

export default async function FollowUpsPage() {
  const user = await requirePermission("patients.view");

  const today = startOfDay(new Date());

  // Fetch visits with a follow-up date set, scoped to the doctor
  const visits = await prisma.visit.findMany({
    where: {
      doctorId: user.profileId,
      followUpDate: { not: null },
    },
    orderBy: { followUpDate: "asc" },
    select: {
      id: true,
      followUpDate: true,
      patient: { select: { name: true, udid: true } },
      diagnoses: { select: { description: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const overdue = visits.filter((v) => v.followUpDate && isPast(v.followUpDate) && !isToday(v.followUpDate!));
  const todayList = visits.filter((v) => v.followUpDate && isToday(v.followUpDate!));
  const tomorrowList = visits.filter((v) => v.followUpDate && isTomorrow(v.followUpDate!));
  const upcoming = visits.filter(
    (v) =>
      v.followUpDate &&
      !isPast(v.followUpDate) &&
      !isToday(v.followUpDate!) &&
      !isTomorrow(v.followUpDate!)
  );

  function VisitRow({ v }: { v: (typeof visits)[number] }) {
    const diag = v.diagnoses[0];
    return (
      <Link
        href={`/patients/${v.patient.udid}?returnTo=/follow-ups`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-primary-50)] transition-colors group"
      >
        <div className="w-8 h-8 rounded-full bg-[var(--color-primary-100)] flex items-center justify-center shrink-0">
          <User size={14} className="text-[var(--color-primary-700)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-ink-900)] truncate">{v.patient.name}</p>
          <p className="text-xs text-[var(--color-ink-400)] truncate">
            UHID: {v.patient.udid}
            {diag ? ` · ${diag.description}` : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-medium text-[var(--color-ink-700)]">
            {format(v.followUpDate!, "d MMM yyyy")}
          </p>
        </div>
        <ChevronRight size={14} className="text-[var(--color-ink-300)] group-hover:text-[var(--color-primary-600)] shrink-0" />
      </Link>
    );
  }

  function Section({
    id,
    title,
    icon,
    color,
    items,
  }: {
    id: string;
    title: string;
    icon: React.ReactNode;
    color: string;
    items: typeof visits;
  }) {
    if (items.length === 0) return null;
    return (
      <div id={id} className="surface-card overflow-hidden scroll-mt-4">
        <div className={`flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)] ${color}`}>
          {icon}
          <span className="text-sm font-semibold">{title}</span>
          <span className="ml-auto text-xs font-medium bg-white/50 px-2 py-0.5 rounded-full">{items.length}</span>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {items.map((v) => (
            <VisitRow key={v.id} v={v} />
          ))}
        </div>
      </div>
    );
  }

  /* Summary cards — jump to the matching section. A count of zero has no
     section to scroll to, so it renders as plain text rather than a dead link. */
  function SummaryCard({
    href,
    label,
    count,
    icon,
    accent,
    iconBg,
  }: {
    href: string;
    label: string;
    count: number;
    icon: React.ReactNode;
    accent: string;
    iconBg: string;
  }) {
    const inner = (
      <>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className={`text-2xl font-bold leading-none tabular-nums ${count > 0 ? accent : "text-[var(--color-ink-300)]"}`}>
            {count}
          </p>
          <p className="text-xs text-[var(--color-ink-500)] mt-1 truncate">{label}</p>
        </div>
      </>
    );

    const base = "flex items-center gap-3 px-4 py-4 rounded-xl border bg-white transition-all";

    if (count === 0) {
      return (
        <div className={`${base} border-[var(--color-border)] opacity-60`}>{inner}</div>
      );
    }

    return (
      <a
        href={href}
        className={`${base} border-[var(--color-border)] hover:border-[var(--color-primary-300)] hover:shadow-sm hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)]`}
      >
        {inner}
      </a>
    );
  }

  return (
    <div className="fade-in pb-24">
      <div className="flex items-center gap-3 mb-6">
        <CalendarClock size={20} className="text-[var(--color-primary-600)]" />
        <div>
          <h1 className="text-lg font-bold text-[var(--color-ink-900)]">Follow Ups</h1>
          <p className="text-xs text-[var(--color-ink-400)]">Patients scheduled for follow-up visits</p>
        </div>
      </div>

      {visits.length === 0 ? (
        <div className="surface-card flex flex-col items-center gap-3 py-16 text-center">
          <CalendarClock size={32} className="text-[var(--color-ink-200)]" />
          <p className="text-sm text-[var(--color-ink-400)]">No follow-up dates set yet.</p>
          <p className="text-xs text-[var(--color-ink-300)]">Set a follow-up date in the EMR to see patients here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard
              href="#overdue"
              label="Overdue"
              count={overdue.length}
              icon={<AlertCircle size={17} className="text-red-600" />}
              accent="text-red-700"
              iconBg="bg-red-50"
            />
            <SummaryCard
              href="#today"
              label="Today"
              count={todayList.length}
              icon={<CheckCircle2 size={17} className="text-emerald-600" />}
              accent="text-emerald-700"
              iconBg="bg-emerald-50"
            />
            <SummaryCard
              href="#tomorrow"
              label="Tomorrow"
              count={tomorrowList.length}
              icon={<Clock size={17} className="text-amber-600" />}
              accent="text-amber-700"
              iconBg="bg-amber-50"
            />
            <SummaryCard
              href="#upcoming"
              label="Upcoming"
              count={upcoming.length}
              icon={<CalendarClock size={17} className="text-[var(--color-primary-600)]" />}
              accent="text-[var(--color-primary-700)]"
              iconBg="bg-[var(--color-primary-50)]"
            />
          </div>

          <div className="flex flex-col gap-4">
            <Section
              id="overdue"
              title="Overdue"
              icon={<AlertCircle size={15} className="text-red-600" />}
              color="bg-red-50 text-red-800"
              items={overdue}
            />
            <Section
              id="today"
              title="Today"
              icon={<CheckCircle2 size={15} className="text-emerald-600" />}
              color="bg-emerald-50 text-emerald-800"
              items={todayList}
            />
            <Section
              id="tomorrow"
              title="Tomorrow"
              icon={<Clock size={15} className="text-amber-600" />}
              color="bg-amber-50 text-amber-800"
              items={tomorrowList}
            />
            <Section
              id="upcoming"
              title="Upcoming"
              icon={<CalendarClock size={15} className="text-[var(--color-primary-600)]" />}
              color="bg-[var(--color-primary-50)] text-[var(--color-primary-800)]"
              items={upcoming}
            />
          </div>
        </div>
      )}
    </div>
  );
}
