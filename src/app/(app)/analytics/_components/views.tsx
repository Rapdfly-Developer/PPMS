"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowRight, Building2, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { COLORS, type SeriesDef } from "@/lib/analytics/definitions";
import { buildQuery } from "@/lib/analytics/filters";
import type {
  OverviewData, PatientsData, AppointmentsData, ClinicalData, InvestigationsData,
  SurgeryData, FollowUpsData, HospitalsData, OperationsData, ActivityData,
} from "@/lib/analytics/service";
import { BarList, ColumnChart, Donut, Heatmap, Pipeline, TrendChart, ChartEmpty } from "./charts";
import { DataTable, Grid2, Grid3, KpiGrid, Panel, SectionHeading } from "./ui";

export interface ViewCtx {
  compareLabel: string;
  print?: boolean;
  /** Current filter params, used to build pagination / drill-down links. */
  params: Record<string, string | undefined>;
}

const s = (key: string, label: string, color: string): SeriesDef => ({ key, label, color });

/* ═══ Overview ═════════════════════════════════════════════════════════════ */

export function OverviewView({ data, ctx }: { data: OverviewData; ctx: ViewCtx }) {
  return (
    <div className="flex flex-col gap-4">
      <KpiGrid kpis={data.kpis} compareLabel={ctx.compareLabel} />

      <Panel title="Patient & appointment activity" subtitle="Appointments by scheduled date; consultations and patients by visit date">
        <TrendChart
          title="Patient and appointment activity"
          points={data.activity}
          series={[
            s("appointments", "Appointments", COLORS.primary),
            s("completed", "Completed", COLORS.completed),
            s("consultations", "Consultations", COLORS.info),
            s("seen", "Patients seen", COLORS.secondary),
            s("newPatients", "New patients", COLORS.pending),
            s("cancelled", "Cancelled / no-show", COLORS.cancelled),
          ]}
          height={ctx.print ? 220 : 280}
        />
      </Panel>

      <Grid2>
        <Panel title="Appointment status" subtitle="All appointments in the period">
          <Donut data={data.status} title="Appointment status" centerLabel="Appointments" />
        </Panel>
        <Panel title="Visit types" subtitle="Appointments by visit type">
          <BarList data={data.visitTypes} />
        </Panel>
      </Grid2>

      <Grid2>
        <Panel title="Current workload" subtitle="Items needing attention now">
          <BarList data={data.workload} showShare={false} />
        </Panel>
        <Panel title="Insights" subtitle="Plain descriptions of the recorded activity">
          {data.insights.length === 0 ? (
            <ChartEmpty height={120} message="No activity recorded for this period." />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {data.insights.map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-[var(--color-ink-700)]">
                  <Lightbulb size={14} className="mt-0.5 shrink-0 text-[var(--color-primary-600)]" aria-hidden="true" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </Grid2>

      {data.recent && (
        <Panel
          title="Recent activity"
          subtitle="Latest entries from the audit log"
          action={!ctx.print ? (
            <Link href={`/analytics${buildQuery(ctx.params, { tab: "activity" })}`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--color-primary-700)] hover:underline">
              Full audit trail <ArrowRight size={12} />
            </Link>
          ) : undefined}
        >
          <DataTable
            searchable={false}
            exportable={false}
            print={ctx.print}
            table={{
              title: "Recent activity",
              columns: [{ key: "time", label: "Time" }, { key: "activity", label: "Activity" }, { key: "user", label: "User" }, { key: "module", label: "Module" }],
              rows: data.recent.map((r) => ({
                time: new Date(r.time).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }),
                activity: r.activity, user: r.user, module: r.module,
              })),
            }}
          />
        </Panel>
      )}
    </div>
  );
}

/* ═══ Patients ═════════════════════════════════════════════════════════════ */

export function PatientsView({ data, ctx }: { data: PatientsData; ctx: ViewCtx }) {
  return (
    <div className="flex flex-col gap-4">
      <KpiGrid kpis={data.kpis} compareLabel={ctx.compareLabel} />
      <Panel title="Patient growth" subtitle="New registrations and patients seen in each period">
        <TrendChart
          title="Patient growth"
          points={data.growth}
          series={[s("seen", "Patients seen", COLORS.primary), s("returning", "Returning", COLORS.info), s("newPatients", "New registrations", COLORS.pending)]}
        />
      </Panel>
      <Grid3>
        <Panel title="Age groups" subtitle="Patients seen in the period">
          <ColumnChart title="Age groups" data={data.ageGroups} />
        </Panel>
        <Panel title="Sex" subtitle="Patients seen in the period">
          <Donut data={data.sex} title="Sex distribution" centerLabel="Patients" />
        </Panel>
        <Panel title="New and returning" subtitle="Registered before the period vs first seen in it">
          <Donut data={data.newVsReturning} title="New and returning patients" centerLabel="Patients" />
        </Panel>
      </Grid3>
      <Grid3>
        <Panel title="By hospital" subtitle="Distinct patients seen">
          <BarList data={data.byHospital} />
        </Panel>
        <Panel title="By visit type" subtitle="Consultations">
          <BarList data={data.byVisitType} />
        </Panel>
        <Panel title="Visit frequency" subtitle="Consultations per patient in the period">
          <ColumnChart title="Visit frequency" data={data.frequency} />
        </Panel>
      </Grid3>
      <Grid2>
        <Panel title="Patient category" subtitle="Patients seen in the period">
          <Donut data={data.category} title="Patient category" centerLabel="Patients" />
        </Panel>
        <Panel title={data.table.title}>
          <DataTable table={data.table} print={ctx.print} />
        </Panel>
      </Grid2>
    </div>
  );
}

/* ═══ Appointments ═════════════════════════════════════════════════════════ */

export function AppointmentsView({ data, ctx }: { data: AppointmentsData; ctx: ViewCtx }) {
  return (
    <div className="flex flex-col gap-4">
      <KpiGrid kpis={data.kpis} compareLabel={ctx.compareLabel} />
      <Panel title="Appointment activity" subtitle="By scheduled date">
        <TrendChart
          title="Appointment activity"
          points={data.activity}
          series={[
            s("total", "Total", COLORS.primary), s("completed", "Completed", COLORS.completed),
            s("pending", "Pending", COLORS.pending), s("cancelled", "Cancelled", COLORS.cancelled),
            s("noShow", "No-show", COLORS.neutral),
          ]}
          height={ctx.print ? 220 : 280}
        />
      </Panel>
      <Grid2>
        <Panel title="Appointment status"><Donut data={data.status} title="Appointment status" centerLabel="Appointments" /></Panel>
        <Panel title="Booking source" subtitle="Booked in advance vs walk-in"><Donut data={data.bookingSource} title="Booking source" centerLabel="Appointments" /></Panel>
      </Grid2>
      <Grid2>
        <Panel title="By day of week" subtitle="IST"><ColumnChart title="Appointments by day of week" data={data.byWeekday} /></Panel>
        <Panel title="By hour of day" subtitle="Scheduled hour, IST"><ColumnChart title="Appointments by hour" data={data.byHour} /></Panel>
      </Grid2>
      <Grid3>
        <Panel title="By hospital"><BarList data={data.byHospital} /></Panel>
        <Panel title="By visit type"><BarList data={data.byVisitType} /></Panel>
        {data.byDoctor.length > 0 && <Panel title="By doctor"><BarList data={data.byDoctor} /></Panel>}
      </Grid3>
      <Panel title={data.table.title}>
        <DataTable table={data.table} print={ctx.print} />
      </Panel>
    </div>
  );
}

/* ═══ Clinical ═════════════════════════════════════════════════════════════ */

export function ClinicalView({ data, ctx }: { data: ClinicalData; ctx: ViewCtx }) {
  return (
    <div className="flex flex-col gap-4">
      <SectionHeading title="Clinical encounters" subtitle="EMR consultations opened in the period" />
      <KpiGrid kpis={data.kpis} compareLabel={ctx.compareLabel} />
      <Panel title="Clinical activity">
        <TrendChart
          title="Clinical activity"
          points={data.activity}
          series={[s("consultations", "Consultations", COLORS.primary), s("finalized", "Finalized", COLORS.completed), s("prescriptions", "With prescription", COLORS.info)]}
        />
      </Panel>
      <Grid3>
        <Panel title="Documentation status"><Donut data={data.documentation} title="Documentation status" centerLabel="Consultations" /></Panel>
        <Panel title="By hospital" subtitle="Consultations"><BarList data={data.byHospital} /></Panel>
        {data.byDoctor.length > 0 && <Panel title="By doctor" subtitle="Consultations, workload view"><BarList data={data.byDoctor} /></Panel>}
      </Grid3>

      <SectionHeading title="Diagnoses" subtitle="Describes what was recorded. It does not imply clinical trends or causes." />
      <KpiGrid kpis={data.diagnosisKpis} compareLabel={ctx.compareLabel} />
      <Grid2>
        <Panel title="Diagnosis records over time">
          <TrendChart title="Diagnoses over time" points={data.diagnosisTrend} series={[s("diagnoses", "Recorded", COLORS.primary), s("confirmed", "Confirmed", COLORS.completed)]} height={220} />
        </Panel>
        <Panel title="Most recorded diagnoses" subtitle="By ICD-10 code"><BarList data={data.topDiagnoses} /></Panel>
      </Grid2>
      <Grid2>
        <Panel title="Diagnoses by hospital"><BarList data={data.diagnosesByHospital} /></Panel>
        <Panel title={data.diagnosisTable.title}><DataTable table={data.diagnosisTable} pageSize={8} print={ctx.print} /></Panel>
      </Grid2>

      <SectionHeading title="Prescriptions" subtitle="Prescribing volume only. No safety or appropriateness conclusions are drawn." />
      <KpiGrid kpis={data.prescriptionKpis} compareLabel={ctx.compareLabel} />
      <Grid2>
        <Panel title="Most prescribed medications"><BarList data={data.topMedications} /></Panel>
        <Panel title="Prescriptions by hospital"><BarList data={data.prescriptionsByHospital} /></Panel>
      </Grid2>
      <Panel title={data.medicationTable.title}><DataTable table={data.medicationTable} print={ctx.print} /></Panel>
    </div>
  );
}

/* ═══ Investigations ═══════════════════════════════════════════════════════ */

export function InvestigationsView({ data, ctx }: { data: InvestigationsData; ctx: ViewCtx }) {
  return (
    <div className="flex flex-col gap-4">
      <KpiGrid kpis={data.kpis} compareLabel={ctx.compareLabel} />
      <Panel title="Investigation volume" subtitle="Orders placed in each period and how many of them are reviewed">
        <TrendChart title="Investigation volume" points={data.volume} series={[s("ordered", "Ordered", COLORS.primary), s("reviewed", "Reviewed", COLORS.completed)]} />
      </Panel>
      <Grid2>
        <Panel title="Status" subtitle="Orders placed in the period"><Donut data={data.status} title="Investigation status" centerLabel="Orders" /></Panel>
        <Panel title="Awaiting review by age" subtitle={`All ${data.openTotal.toLocaleString("en-IN")} open orders, regardless of period`}>
          <ColumnChart title="Open investigation aging" data={data.aging} />
        </Panel>
      </Grid2>
      <Grid3>
        <Panel title="By category"><BarList data={data.byCategory} /></Panel>
        <Panel title="Most ordered tests"><BarList data={data.topTests} /></Panel>
        <Panel title="By hospital"><BarList data={data.byHospital} /></Panel>
      </Grid3>
      <div id="pending" className="scroll-mt-24">
        <Panel title={data.openTable.title} subtitle="Oldest first">
          <DataTable table={data.openTable} print={ctx.print} />
        </Panel>
      </div>
    </div>
  );
}

/* ═══ Surgery ══════════════════════════════════════════════════════════════ */

export function SurgeryView({ data, ctx }: { data: SurgeryData; ctx: ViewCtx }) {
  return (
    <div className="flex flex-col gap-4">
      <KpiGrid kpis={data.kpis} compareLabel={ctx.compareLabel} />
      <Panel title="Surgical pipeline" subtitle="Records created in the period at each stage">
        <Pipeline steps={data.pipeline} />
      </Panel>
      <Panel title="Surgery trend">
        <TrendChart title="Surgery trend" points={data.trend} series={[s("advised", "Advised", COLORS.primary), s("counselled", "Counselled", COLORS.info), s("scheduled", "Scheduled", COLORS.pending)]} />
      </Panel>
      <Grid3>
        <Panel title="Advised procedures"><BarList data={data.topProcedures} /></Panel>
        <Panel title="By hospital" subtitle="Surgery advised"><BarList data={data.byHospital} /></Panel>
        <Panel title="Eye"><Donut data={data.eye} title="Eye" centerLabel="Advised" /></Panel>
      </Grid3>
      <Grid2>
        <Panel title="Scheduled surgery status" subtitle="Surgeries planned within the period">
          {data.scheduleStatus.length ? <Donut data={data.scheduleStatus} title="Scheduled surgery status" centerLabel="Scheduled" /> : <ChartEmpty height={150} message="No surgeries scheduled for this period." />}
        </Panel>
        <Panel title={data.table.title}><DataTable table={data.table} pageSize={8} print={ctx.print} /></Panel>
      </Grid2>
    </div>
  );
}

/* ═══ Follow-ups ═══════════════════════════════════════════════════════════ */

export function FollowUpsView({ data, ctx }: { data: FollowUpsData; ctx: ViewCtx }) {
  return (
    <div className="flex flex-col gap-4">
      <KpiGrid kpis={data.kpis} compareLabel={ctx.compareLabel} />
      <Panel title="Follow-ups by due date">
        <TrendChart title="Follow-ups by due date" points={data.trend} series={[s("completed", "Completed", COLORS.completed), s("pending", "Pending", COLORS.primary), s("overdue", "Overdue / missed", COLORS.cancelled)]} />
      </Panel>
      <Grid2>
        <Panel title="Status"><Donut data={data.status} title="Follow-up status" centerLabel="Follow-ups" /></Panel>
        <Panel title="Overdue by days past due"><ColumnChart title="Overdue follow-ups" data={data.aging} /></Panel>
      </Grid2>
      <Grid2>
        <Panel title="By hospital"><BarList data={data.byHospital} /></Panel>
        {data.byDoctor.length > 0 ? <Panel title="By doctor"><BarList data={data.byDoctor} /></Panel> : <div className="hidden xl:block" />}
      </Grid2>
      <Panel
        title={data.table.title}
        action={!ctx.print ? <Link href="/follow-ups" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--color-primary-700)] hover:underline">Open Follow-ups <ArrowRight size={12} /></Link> : undefined}
      >
        <DataTable table={data.table} print={ctx.print} />
      </Panel>
    </div>
  );
}

/* ═══ Hospitals ════════════════════════════════════════════════════════════ */

export function HospitalsView({ data, ctx }: { data: HospitalsData; ctx: ViewCtx }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-4 gap-3">
        {data.cards.map((h) => {
          const body = (
            <>
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"><Building2 size={15} /></span>
                <p className="min-w-0 truncate text-[14px] font-semibold text-[var(--color-ink-900)]">{h.name}</p>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
                {[
                  ["Appointments", h.appointments.toLocaleString("en-IN")],
                  ["Consultations", h.consultations.toLocaleString("en-IN")],
                  ["Patients seen", h.patientsSeen.toLocaleString("en-IN")],
                  ["Completion", h.completionRate === null ? "—" : `${h.completionRate}%`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[var(--color-ink-400)]">{k}</dt>
                    <dd className="font-semibold tabular-nums text-[var(--color-ink-900)]">{v}</dd>
                  </div>
                ))}
              </dl>
            </>
          );
          return ctx.print ? (
            <div key={h.id} className="rounded-xl border border-[var(--color-border)] bg-white p-4">{body}</div>
          ) : (
            <Link key={h.id} href={h.href} className="rounded-xl border border-[var(--color-border)] bg-white p-4 transition-[border-color,box-shadow] hover:border-[var(--color-primary-400)] hover:shadow-[0_4px_16px_rgba(21,122,115,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]">
              {body}
              <p className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--color-primary-700)]">View this hospital <ArrowRight size={11} /></p>
            </Link>
          );
        })}
      </div>
      <Grid2>
        <Panel title="Appointments by hospital"><BarList data={data.appointments} showShare={false} /></Panel>
        <Panel title="Consultations by hospital"><BarList data={data.consultations} showShare={false} /></Panel>
      </Grid2>
      <Panel title={data.table.title}><DataTable table={data.table} searchable={false} print={ctx.print} /></Panel>
    </div>
  );
}

/* ═══ Operations ═══════════════════════════════════════════════════════════ */

export function OperationsView({ data, ctx }: { data: OperationsData; ctx: ViewCtx }) {
  return (
    <div className="flex flex-col gap-4">
      <KpiGrid kpis={data.kpis} compareLabel={ctx.compareLabel} />
      <Panel title="Scheduled appointments by day and hour" subtitle="IST · darker cells hold more appointments">
        <Heatmap title="Appointments by weekday and hour" days={data.heatmap.days} hours={data.heatmap.hours} values={data.heatmap.values} />
      </Panel>
      <Grid2>
        <Panel title="Arrivals by hour" subtitle="When patients were marked arrived"><ColumnChart title="Arrivals by hour" data={data.arrivalsByHour} /></Panel>
        <Panel title="Waiting time" subtitle="Arrival to consultation opened"><Donut data={data.waitBuckets} title="Waiting time distribution" centerLabel="Visits" /></Panel>
      </Grid2>
      <Panel title="Daily workload">
        <TrendChart title="Daily workload" points={data.daily} series={[s("appointments", "Scheduled", COLORS.primary), s("arrived", "Arrived", COLORS.info), s("completed", "Completed", COLORS.completed)]} />
      </Panel>
      <Grid2>
        <Panel title="Workload by hospital" subtitle="Appointments"><BarList data={data.byHospital} /></Panel>
        <Panel title="Pending workload" subtitle="Current outstanding items"><BarList data={data.workload} showShare={false} /></Panel>
      </Grid2>
    </div>
  );
}

/* ═══ Activity & audit ═════════════════════════════════════════════════════ */

function AuditFilters({ data, ctx }: { data: ActivityData; ctx: ViewCtx }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (key: string, value: string) => {
    start(() => router.push(`/analytics${buildQuery(ctx.params, { tab: "activity", [key]: value || undefined, page: undefined })}`, { scroll: false }));
  };
  const select = "rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]";
  return (
    <div className={`mb-3 flex flex-wrap gap-2 ${pending ? "opacity-60" : ""}`}>
      <label className="sr-only" htmlFor="audit-action">Action</label>
      <select id="audit-action" className={select} value={ctx.params.auditAction ?? ""} onChange={(e) => go("auditAction", e.target.value)}>
        <option value="">All actions</option>
        {data.options.actions.map((a) => <option key={a} value={a}>{a.charAt(0) + a.slice(1).toLowerCase()}</option>)}
      </select>
      <label className="sr-only" htmlFor="audit-module">Module</label>
      <select id="audit-module" className={select} value={ctx.params.auditModule ?? ""} onChange={(e) => go("auditModule", e.target.value)}>
        <option value="">All modules</option>
        {data.options.modules.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <label className="sr-only" htmlFor="audit-user">User</label>
      <select id="audit-user" className={select} value={ctx.params.auditUser ?? ""} onChange={(e) => go("auditUser", e.target.value)}>
        <option value="">All users</option>
        {data.options.users.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
    </div>
  );
}

export function ActivityView({ data, ctx }: { data: ActivityData; ctx: ViewCtx }) {
  const pageHref = (p: number) => `/analytics${buildQuery(ctx.params, { tab: "activity", page: p > 1 ? p : undefined })}#audit`;
  return (
    <div className="flex flex-col gap-4">
      <KpiGrid kpis={data.kpis} compareLabel={ctx.compareLabel} />
      <Grid2>
        <Panel title="Accounts by role" subtitle="Users in your practice"><Donut data={data.staff} title="Accounts by role" centerLabel="Users" /></Panel>
        <Panel title="Sign-ins by role" subtitle="Successful sign-ins in the period"><BarList data={data.loginsByRole} /></Panel>
      </Grid2>
      <Grid2>
        <Panel title="Sign-in activity">
          <TrendChart title="Sign-in activity" points={data.logins} series={[s("logins", "Successful", COLORS.primary), s("failed", "Failed", COLORS.cancelled)]} height={220} />
        </Panel>
        <Panel title="Recorded activity">
          <TrendChart title="Recorded activity" points={data.auditTrend} series={[s("activities", "Audit entries", COLORS.info)]} height={220} />
        </Panel>
      </Grid2>
      <Grid3>
        <Panel title="Actions"><BarList data={data.actionTypes} /></Panel>
        <Panel title="Most used modules" subtitle="By recorded activity"><BarList data={data.modules} /></Panel>
        <Panel title="Activity volume by user" subtitle="Records processed, not a performance measure"><BarList data={data.byUser} /></Panel>
      </Grid3>
      <div id="audit" className="scroll-mt-24">
        <Panel title="Audit trail" subtitle={`${data.auditTotal.toLocaleString("en-IN")} matching entries`}>
          {!ctx.print && <AuditFilters data={data} ctx={ctx} />}
          <DataTable
            table={data.audit}
            searchable={false}
            print={ctx.print}
            footer={!ctx.print && data.pages > 1 ? (
              <nav aria-label="Audit trail pages" className="flex items-center gap-1">
                {data.page > 1
                  ? <Link href={pageHref(data.page - 1)} scroll={false} aria-label="Previous page" className="rounded-md border border-[var(--color-border)] bg-white p-1"><ChevronLeft size={14} /></Link>
                  : <span className="rounded-md border border-[var(--color-border)] bg-white p-1 opacity-40"><ChevronLeft size={14} /></span>}
                <span className="px-2 tabular-nums">Page {data.page} of {data.pages}</span>
                {data.page < data.pages
                  ? <Link href={pageHref(data.page + 1)} scroll={false} aria-label="Next page" className="rounded-md border border-[var(--color-border)] bg-white p-1"><ChevronRight size={14} /></Link>
                  : <span className="rounded-md border border-[var(--color-border)] bg-white p-1 opacity-40"><ChevronRight size={14} /></span>}
              </nav>
            ) : undefined}
          />
        </Panel>
      </div>
    </div>
  );
}
