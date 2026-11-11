import { redirect } from "next/navigation";
import { requirePermission, roleHome } from "@/lib/rbac";
import { istTodayStr } from "@/lib/ist";
import { parseFilters, filterParams } from "@/lib/analytics/filters";
import { resolveScope } from "@/lib/analytics/scope";
import { isCardId } from "@/lib/analytics/cards";
import { getLanding, loadCard } from "@/lib/analytics/cards-data";
import { AnalyticsShell } from "./_components/Shell";
import { CardLanding } from "./_components/cards-ui";
import { CardView } from "./_components/dashboards";
import { SectionError } from "./_components/ui";
import { APPOINTMENT_STATUSES } from "@/lib/analytics/service";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("reports.view");

  const scope = await resolveScope(user);
  if (!scope) redirect(roleHome(user.role));

  const sp = await searchParams;
  const filters = parseFilters(sp, istTodayStr());
  const params = filterParams(filters);
  const cardRaw = one(sp.card);
  // The Clinical card needs access to clinical records
  const card = isCardId(cardRaw) && !(cardRaw === "clinical" && !scope.canViewClinical) ? cardRaw : null;
  const drill = one(sp.drill)?.slice(0, 200);

  const shell = {
    filters,
    params,
    scopeLabel: scope.label,
    generatedAt: new Date().toISOString(),
    tabs: scope.tabs,
    hospitals: scope.hospitals,
    doctors: scope.doctors,
    showDoctorFilter: scope.kind === "hospital" && scope.doctors.length > 1,
    visitTypes: scope.visitTypes,
    statuses: APPOINTMENT_STATUSES,
    canExport: scope.canExport,
    card,
  };

  // The five cards stay on top; the open card's dashboard loads alongside them
  const [landing, section] = await Promise.all([
    getLanding(scope, filters),
    card ? loadCard(card, scope, filters, drill) : Promise.resolve(null),
  ]);

  return (
    <AnalyticsShell {...shell} exportData={section && section.ok ? exportShape(section.data) : null}>
      <div className="flex flex-col gap-5">
        {landing.ok ? <CardLanding cards={landing.data} params={params} active={card} /> : <SectionError message={landing.error} />}
        {card && section && (
          <CardView card={card} section={section} ctx={{ params, compareLabel: filters.compareLabel, canPrint: scope.canExport }} />
        )}
      </div>
    </AnalyticsShell>
  );
}

/** Flattens a card's data so the existing CSV / Excel export picks up every chart and table. */
function exportShape(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  const out: Record<string, unknown> = {};
  const walk = (obj: Record<string, unknown>, prefix: string) => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix} ${k}` : k;
      if (k === "drill" || k === "tiles" || k === "attention" || k === "takeaways") continue;
      if (k === "tables" && Array.isArray(v)) v.forEach((t, i) => { out[`table${i}`] = t; });
      else if (Array.isArray(v)) out[key] = v;
      else if (v && typeof v === "object") walk(v as Record<string, unknown>, key);
    }
  };
  walk(data as Record<string, unknown>, "");
  return out;
}
