import { redirect } from "next/navigation";
import { requireUser, roleHome, userCan } from "@/lib/rbac";
import { istTodayStr } from "@/lib/ist";
import { TABS, type TabId } from "@/lib/analytics/definitions";
import { parseFilters, filterParams } from "@/lib/analytics/filters";
import { resolveScope } from "@/lib/analytics/scope";
import { loadSection } from "@/lib/analytics/sections";
import { SectionView } from "../_components/SectionView";
import { ReportToolbar } from "../_components/ReportToolbar";

export default async function AnalyticsReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  if (user.role !== "DOCTOR" && user.role !== "HOSPITAL" && !userCan(user, "reports.view")) redirect(roleHome(user.role));
  const scope = await resolveScope(user);
  if (!scope) redirect(roleHome(user.role));
  if (!scope.canExport) redirect("/analytics");

  const sp = await searchParams;
  const filters = parseFilters(sp, istTodayStr());
  const requested = String(Array.isArray(sp.sections) ? sp.sections[0] : sp.sections ?? "overview").split(",");
  const sections = TABS.map((t) => t.id).filter((id): id is TabId => requested.includes(id) && scope.tabs.includes(id));
  if (sections.length === 0) sections.push("overview");

  // Sections are independent; load them together.
  const results = await Promise.all(sections.map((tab) => loadSection(tab, scope, { ...filters, tab, page: 1 })));
  const hospital = scope.hospitals.find((h) => h.id === filters.hospitalId)?.name ?? "All hospitals";
  const doctor = scope.doctors.find((d) => d.id === filters.doctorId)?.name
    ?? (scope.kind === "hospital" && scope.doctors.length > 1 ? "All doctors" : scope.doctors[0]?.name ?? "—");
  const generated = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
  const title = sections.length === scope.tabs.length ? "Complete healthcare analytics report" : `${sections.map((s) => TABS.find((t) => t.id === s)!.label).join(", ")} report`;
  const params = filterParams(filters);

  return (
    <div className="mx-auto max-w-[720px] bg-white sm:rounded-2xl sm:border sm:border-[var(--color-border)] p-5 sm:p-8 print:max-w-none print:border-0 print:p-0">
      <ReportToolbar />

      <div className="border-b border-[var(--color-border)] pb-5">
        <p className="text-caption font-semibold uppercase tracking-[0.14em] text-[var(--color-primary-700)]">RF Health · Analytics &amp; Intelligence</p>
        <h1 className="mt-1.5 text-heading-lg font-bold tracking-tight text-[var(--color-ink-900)]">{title}</h1>
        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-label">
          {[
            ["Reporting period", filters.periodLabel],
            ["Compared with", filters.compareLabel],
            ["Scope", scope.label],
            ["Hospital", hospital],
            ["Doctor", doctor],
            ["Generated", `${generated} IST`],
            ...(filters.visitType ? [["Visit type", filters.visitType]] : []),
            ...(filters.patientType ? [["Patients", filters.patientType === "new" ? "New only" : "Returning only"]] : []),
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="w-32 shrink-0 text-[var(--color-ink-400)]">{k}</dt>
              <dd className="font-medium text-[var(--color-ink-800)]">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {sections.map((tab, i) => (
        <section key={tab} className={`pt-6 ${i > 0 ? "break-before-page" : ""}`}>
          <h2 className="mb-4 text-heading-md font-semibold tracking-tight text-[var(--color-ink-900)]">
            {TABS.find((t) => t.id === tab)!.label}
          </h2>
          <SectionView tab={tab} section={results[i]} ctx={{ compareLabel: filters.compareLabel, params, print: true }} />
        </section>
      ))}

      <p className="mt-8 border-t border-[var(--color-border)] pt-3 text-caption text-[var(--color-ink-400)]">
        Generated from records you are authorised to view. Figures describe recorded activity and are not clinical conclusions.
      </p>
    </div>
  );
}
