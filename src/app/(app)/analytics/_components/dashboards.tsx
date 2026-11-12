"use client";

import {
  Activity, Banknote, Building2, CalendarClock, ClipboardCheck, Clock, Eye, FileText, FlaskConical, Footprints, Gauge, HandCoins,
  LineChart, MessageSquareText, Pill, Route, ShieldCheck, Table2, Tags, TrendingUp, UserCheck, UserPlus, Users,
} from "lucide-react";
import { COLORS, type Section, type SeriesDef, type TableData } from "@/lib/analytics/definitions";
import { buildQuery } from "@/lib/analytics/filters";
import { cardMeta, type CardCommon, type CardId, type ClinicalCard, type FinancialCard, type PulseCard, type SocialCard, type SurgeryCard, type SurgeryStep } from "@/lib/analytics/cards";
import { BarList, ChartEmpty, ColumnChart, Donut, Heatmap, TrendChart } from "./charts";
import { DataTable, Grid2, Grid3, Panel, SectionError } from "./ui";
import {
  AttentionStrip, DashHeader, DrillPanel, JourneyFlow, MoneyFlow, OutcomeBars, Squares, StoryHero, Takeaways, TileGrid, TopicTabs, ValueBars, type Lead, type TopicDef,
} from "./cards-ui";

export interface CardCtx {
  params: Record<string, string | undefined>;
  compareLabel: string;
  canPrint: boolean;
  /** One-page summary: takeaways, tiles and the key charts only. */
  print?: boolean;
}

const s = (key: string, label: string, color: string): SeriesDef => ({ key, label, color });
const pct = (v: number) => `${v}%`;
const minutes = (v: number) => (v >= 60 ? `${Math.floor(v / 60)} h ${v % 60} min` : `${v} min`);
const rupees = (v: number) => `₹${v.toLocaleString("en-IN")}`;
const CHART_H = 200;
const n = (v: number) => v.toLocaleString("en-IN");
const sum = (cats: { value: number }[]) => cats.reduce((a, c) => a + c.value, 0);
const share = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const top = <T extends { value: number }>(cats: T[]): T | undefined => [...cats].sort((a, b) => b.value - a.value)[0];
const times = (v: number) => (v === 1 ? "time" : "times");
const fmtMin = (m: number | null) => (m === null ? "No data" : m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`);

export function CardView({ card, section, ctx }: { card: CardId; section: Section<unknown>; ctx: CardCtx }) {
  return (
    <div id="dashboard" className="flex scroll-mt-24 flex-col gap-3">
      <DashHeader card={card} params={ctx.params} canPrint={ctx.canPrint} print={ctx.print} />
      {!section.ok ? <SectionError message={section.error} />
        : card === "surgery" ? <Surgery d={section.data as SurgeryCard} ctx={ctx} />
        : card === "clinical" ? <Clinical d={section.data as ClinicalCard} ctx={ctx} />
        : card === "social" ? <Social d={section.data as SocialCard} ctx={ctx} />
        : card === "financial" ? <Financial d={section.data as FinancialCard} ctx={ctx} />
        : <Pulse d={section.data as PulseCard} ctx={ctx} />}
    </div>
  );
}

/** The same compact top for every card, then one topic at a time. */
function Board({ card, d, ctx, topics, note }: { card: CardId; d: CardCommon; ctx: CardCtx; topics: TopicDef[]; note?: React.ReactNode }) {
  return (
    <>
      {d.drill && !ctx.print && <DrillPanel drill={d.drill} closeHref={`/analytics${buildQuery(ctx.params, { card })}`} />}
      {d.takeaways[0] && <StoryHero text={d.takeaways[0]} card={card} />}
      <TileGrid tiles={d.tiles} card={card} />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Takeaways items={d.takeaways.slice(1)} card={card} />
        <AttentionStrip items={d.attention} print={ctx.print} />
      </div>
      {note}
      <TopicTabs topics={topics} card={card} print={ctx.print} />
    </>
  );
}

function tablesTopic(tables: TableData[]): TopicDef[] {
  if (tables.length === 0) return [];
  return [{
    id: "tables", label: "Every row", title: "The full lists behind the charts", subtitle: "Search, sort and export them.", icon: Table2,
    content: <>{tables.map((t) => <Panel key={t.title} title={t.title}><DataTable table={t} pageSize={8} /></Panel>)}</>,
  }];
}

/* ═══ Clinical ═════════════════════════════════════════════════════════════ */

function Clinical({ d, ctx }: { d: ClinicalCard; ctx: CardCtx }) {
  const m = cardMeta("clinical");
  const protocolShare = d.protocols.confirmed ? Math.round((d.protocols.withProtocol / d.protocols.confirmed) * 100) : null;

  const v = d.vision;
  const outcomesLead: Lead = v.total
    ? {
        headline: `Vision improved in [[${share(v.overall.better, v.total)}%]] of the eyes you measured more than once, and got worse in [[${share(v.overall.worse, v.total)}%]].`,
        facts: [{ value: n(v.overall.better), label: "eyes improved" }, { value: n(v.overall.same), label: "stayed the same" }, { value: n(v.overall.worse), label: "got worse" }],
      }
    : { headline: "There are not enough repeat vision readings yet to say whether patients are improving.", note: "Record vision at follow-up visits and this chapter fills in on its own." };

  const topDx = d.topDiagnoses[0];
  const conditionsLead: Lead = topDx
    ? {
        headline: `[[${topDx.label.split(" · ").pop()}]] is what you treat most: [[${n(topDx.value)}]] of the ${n(sum(d.topDiagnoses))} diagnoses in your top list.`,
        facts: [
          { value: n(d.topDiagnoses.length), label: "different diagnoses shown" },
          ...(d.topComplaints[0] ? [{ value: d.topComplaints[0].label, label: "most common complaint" }] : []),
        ],
      }
    : { headline: "No diagnoses were recorded in this period." };

  const topMed = d.topMedications[0];
  const treatmentLead: Lead = topMed
    ? {
        headline: `[[${topMed.label}]] is your most prescribed medicine, written [[${n(topMed.value)}]] ${times(topMed.value)}.`,
        facts: [
          { value: protocolShare === null ? "No data" : `${protocolShare}%`, label: "diagnoses with a protocol" },
          { value: n(d.topMedications.length), label: "medicines in your top list" },
        ],
      }
    : { headline: "No prescriptions were written in this period." };

  const fuOf = (prefix: string) => sum((d.followUps?.status ?? []).filter((c) => c.label.startsWith(prefix)));
  const kept = fuOf("Completed");
  const overdue = fuOf("Overdue");
  const missed = fuOf("Missed");
  const followLead: Lead = kept + overdue + missed > 0
    ? {
        headline: `Of the follow-ups that have fallen due, [[${share(kept, kept + overdue + missed)}%]] were kept. [[${n(overdue + missed)}]] ${overdue + missed === 1 ? "patient has" : "patients have"} not come back.`,
        facts: [{ value: n(kept), label: "came back" }, { value: n(overdue), label: "up to 2 weeks late" }, { value: n(missed), label: "over 2 weeks late" }],
      }
    : { headline: "No follow-ups have fallen due in this period yet." };

  const open = d.investigations?.openTotal ?? 0;
  const topTest = d.investigations?.topTests[0];
  const invLead: Lead = {
    headline: open > 0
      ? `[[${n(open)}]] test ${open === 1 ? "order is" : "orders are"} still waiting for a report or a review.`
      : "Every test ordered has its report reviewed.",
    facts: topTest ? [{ value: topTest.label, label: "most ordered test" }, { value: n(topTest.value), label: "times ordered" }] : undefined,
  };

  const days = d.activity.filter((pt) => (pt.values.consultations ?? 0) > 0);
  const totalConsults = d.activity.reduce((a, pt) => a + (pt.values.consultations ?? 0), 0);
  const peak = [...days].sort((a, b) => b.values.consultations - a.values.consultations)[0];
  const signed = d.documentation.find((c) => c.label === "Finalized")?.value ?? 0;
  const workloadLead: Lead = totalConsults
    ? {
        headline: `You held [[${n(totalConsults)}]] consultations, about [[${Math.round(totalConsults / Math.max(1, days.length))}]] on each working day${peak ? `. The busiest was ${peak.label} with ${n(peak.values.consultations)}` : ""}.`,
        facts: [{ value: n(days.length), label: "days with consultations" }, { value: `${share(signed, sum(d.documentation))}%`, label: "records signed" }],
      }
    : { headline: "No consultations were recorded in this period." };

  const topics: TopicDef[] = [
    {
      id: "outcomes", label: "Outcomes", title: "Are patients getting better?", icon: TrendingUp, summary: true, lead: outcomesLead,
      subtitle: "Patients measured more than once: first recorded value against the latest in this period.",
      content: (
        <Grid3>
          <Panel title="Did vision improve?" subtitle={d.vision.total ? `${d.vision.total.toLocaleString("en-IN")} eyes measured at two or more visits` : undefined} icon={Eye}>
            {d.vision.total === 0 ? <ChartEmpty message="Not enough repeat vision readings yet" /> : <OutcomeBars rows={[d.vision.overall, ...d.vision.byDiagnosis]} unit="eyes" />}
          </Panel>
          <Panel title="Is eye pressure under control?" subtitle="Glaucoma patients at their last reading. Under control is 21 mmHg or less." icon={Gauge}>
            {d.iop.patients === 0 ? <ChartEmpty message="No pressure readings for glaucoma patients" /> : (
              <Squares unit="glaucoma patients" data={[
                { label: "Under control", value: d.iop.controlled, color: COLORS.completed },
                { label: "Above 21 mmHg", value: d.iop.uncontrolled, color: COLORS.cancelled },
              ].filter((x) => x.value > 0)} />
            )}
          </Panel>
          <Panel title="How has average eye pressure moved?" subtitle="All readings, in mmHg" icon={LineChart}>
            <TrendChart title="Average eye pressure" points={d.iop.trend} series={[s("avg", "Average pressure (mmHg)", m.from)]} height={CHART_H} />
          </Panel>
        </Grid3>
      ),
    },
    {
      id: "conditions", label: "Conditions", title: "What are you treating?", subtitle: "Click any bar to see the patients behind it.", icon: Activity, summary: true, lead: conditionsLead,
      content: (
        <Grid3>
          <Panel title="Which diagnoses come up most?" subtitle="By ICD-10 code"><BarList data={d.topDiagnoses} limit={8} /></Panel>
          <Panel title="Why do patients come in?" subtitle="Chief complaints" icon={MessageSquareText}>
            {d.topComplaints.length ? <BarList data={d.topComplaints} limit={8} color={COLORS.info} /> : <ChartEmpty height={120} />}
          </Panel>
          <Panel title="Are diagnoses rising or falling?" icon={LineChart}>
            <TrendChart title="Diagnoses over time" points={d.diagnosisTrend} series={[s("diagnoses", "Recorded", COLORS.primary), s("confirmed", "Confirmed", COLORS.completed)]} height={CHART_H} />
          </Panel>
        </Grid3>
      ),
    },
    {
      id: "treatment", label: "Treatment", title: "How are you treating it?", subtitle: "Prescribing and protocol use. Volume only, no safety conclusions are drawn.", icon: Pill, lead: treatmentLead,
      content: (
        <Grid2>
          <Panel title="Which medicines are prescribed most?" subtitle="Click a bar to see the patients"><BarList data={d.topMedications} limit={8} color={COLORS.secondary} /></Panel>
          <Panel
            title="How often is a protocol used?"
            subtitle={protocolShare === null ? "Confirmed diagnoses in this period" : `Applied to ${protocolShare}% of ${d.protocols.confirmed.toLocaleString("en-IN")} confirmed diagnoses`}
            icon={ClipboardCheck}
          >
            {d.protocols.confirmed === 0 ? <ChartEmpty height={120} message="No confirmed diagnoses in this period" /> : (
              <div className="flex flex-col gap-4">
                <ValueBars format={(v) => v.toLocaleString("en-IN")} max={d.protocols.confirmed} data={[
                  { label: "With a protocol", value: d.protocols.withProtocol, color: COLORS.completed },
                  { label: "Without a protocol", value: d.protocols.confirmed - d.protocols.withProtocol, color: COLORS.neutral },
                ]} />
                {d.protocols.top.length > 0 && (
                  <div>
                    <p className="mb-2 text-caption font-semibold text-[var(--color-ink-500)]">Most used protocols</p>
                    <BarList data={d.protocols.top} limit={5} showShare={false} />
                  </div>
                )}
              </div>
            )}
          </Panel>
        </Grid2>
      ),
    },
    ...(d.followUps ? [{
      id: "followups", label: "Follow-ups", title: "Do patients come back?", subtitle: "Follow-ups due in this period.", icon: CalendarClock, summary: true, lead: followLead,
      content: (
        <>
          <Grid2>
            <Panel title="What happened to the follow-ups?"><Donut data={d.followUps.status} title="Follow-up status" centerLabel="Follow-ups" /></Panel>
            <Panel title="Which conditions do patients return for?" subtitle="Share of due follow-ups that were kept" icon={UserCheck}>
              {d.followUps.adherence.length ? <ValueBars data={d.followUps.adherence} format={pct} max={100} color={COLORS.completed} /> : <ChartEmpty height={120} message="Not enough due follow-ups yet" />}
            </Panel>
          </Grid2>
          {!ctx.print && (
            <Grid2>
              <Panel title="When are follow-ups due?"><TrendChart title="Follow-ups by due date" points={d.followUps.trend} series={[s("completed", "Completed", COLORS.completed), s("pending", "Pending", COLORS.primary), s("overdue", "Overdue / missed", COLORS.cancelled)]} height={CHART_H} /></Panel>
              <Panel title="How late are the overdue ones?" subtitle="Days past the due date"><ColumnChart title="Overdue follow-ups" data={d.followUps.aging} color={COLORS.pending} height={CHART_H} /></Panel>
            </Grid2>
          )}
        </>
      ),
    } satisfies TopicDef] : []),
    ...(d.investigations ? [{
      id: "investigations", label: "Investigations", title: "Are test results coming back?", icon: FlaskConical, lead: invLead,
      content: (
        <>
          <Grid3>
            <Panel title="Where do orders stand?"><Donut data={d.investigations.status} title="Investigation status" centerLabel="Orders" /></Panel>
            <Panel title="How long have open orders waited?"><ColumnChart title="Open investigation aging" data={d.investigations.aging} color={COLORS.pending} height={CHART_H} /></Panel>
            <Panel title="Which tests are ordered most?"><BarList data={d.investigations.topTests} limit={8} color={COLORS.info} /></Panel>
          </Grid3>
          <Panel title="How many tests are ordered and reviewed?" icon={LineChart}>
            <TrendChart title="Investigation volume" points={d.investigations.volume} series={[s("ordered", "Ordered", COLORS.primary), s("reviewed", "Reviewed", COLORS.completed)]} height={CHART_H} />
          </Panel>
        </>
      ),
    } satisfies TopicDef] : []),
    {
      id: "workload", label: "Workload", title: "How busy has the clinic been?", icon: LineChart, lead: workloadLead,
      content: (
        <>
          <Panel title="How many consultations each day?" subtitle="Consultations, signed records and prescriptions">
            <TrendChart title="Clinical activity" points={d.activity} series={[s("consultations", "Consultations", COLORS.primary), s("finalized", "Signed", COLORS.completed), s("prescriptions", "With prescription", COLORS.info)]} height={220} />
          </Panel>
          <Grid3>
            <Panel title="Are records being signed?"><Squares data={d.documentation} unit="consultations" /></Panel>
            <Panel title="Which hospital sees the most?"><BarList data={d.byHospital} limit={6} /></Panel>
            {d.byDoctor.length > 0 && <Panel title="Which doctor sees the most?"><BarList data={d.byDoctor} limit={6} /></Panel>}
          </Grid3>
        </>
      ),
    },
    ...tablesTopic(d.tables),
  ];

  return <Board card="clinical" d={d} ctx={ctx} topics={topics} />;
}

/* ═══ Social ═══════════════════════════════════════════════════════════════ */

function Social({ d, ctx }: { d: SocialCard; ctx: CardCtx }) {
  const m = cardMeta("social");
  const referredPct = d.referredShare.total ? Math.round((d.referredShare.referred / d.referredShare.total) * 100) : 0;

  const seen = sum(d.newVsReturning);
  const firstTime = d.newVsReturning.find((c) => c.label.startsWith("First"))?.value ?? 0;
  const growthLead: Lead = seen
    ? {
        headline: `[[${n(seen)}]] patients came in, and [[${n(firstTime)}]] of them registered during this period.`,
        facts: [{ value: `${share(firstTime, seen)}%`, label: "new to the practice" }, { value: n(seen - firstTime), label: "were already your patients" }],
      }
    : { headline: "No patients were seen in this period." };

  const topAge = top(d.ageGroups);
  const topSex = top(d.sex);
  const topCat = top(d.categories);
  const whoLead: Lead = topAge?.value
    ? {
        headline: `Your most common patient is [[${topAge.label} years old]]${topSex ? ` and [[${topSex.label.toLowerCase()}]]` : ""}.`,
        facts: [
          { value: `${share(topAge.value, sum(d.ageGroups))}%`, label: `aged ${topAge.label}` },
          ...(topSex ? [{ value: `${share(topSex.value, sum(d.sex))}%`, label: topSex.label.toLowerCase() }] : []),
          ...(topCat ? [{ value: topCat.label, label: "largest category" }] : []),
        ],
      }
    : { headline: "No patient details to show for this period." };

  const referralLead: Lead = {
    headline: d.referredShare.total
      ? `[[${referredPct}%]] of your patients came because someone sent them.`
      : "No patients were seen in this period.",
    facts: [
      ...(d.referralSources[0] ? [{ value: d.referralSources[0].label, label: "top referral source" }] : []),
      ...(d.topReferrers[0] ? [{ value: d.topReferrers[0].label, label: `referred ${n(d.topReferrers[0].value)} patients` }] : []),
    ],
    note: "Sources are as written at registration, so the same source spelt two ways shows twice.",
  };

  const topics: TopicDef[] = [
    {
      id: "growth", label: "Growth", title: "Is the practice growing?", icon: TrendingUp, summary: true, lead: growthLead,
      content: (
        <>
          <Panel title="How many patients, new and returning?" icon={UserPlus}>
            <TrendChart title="Patient growth" points={d.growth} series={[s("seen", "Patients seen", m.from), s("newPatients", "New registrations", COLORS.pending), s("returning", "Returning", COLORS.completed)]} height={220} />
          </Panel>
          {!ctx.print && (
            <Grid2>
              <Panel title="First visit or coming back?"><Squares data={d.newVsReturning} unit="patients" /></Panel>
              <Panel title="How often does a patient visit?" subtitle="Visits per patient in this period"><ColumnChart title="Visit frequency" data={d.frequency} color={m.from} height={CHART_H} /></Panel>
            </Grid2>
          )}
        </>
      ),
    },
    {
      id: "who", label: "Who they are", title: "Who are your patients?", subtitle: "Click a bar to see the patients.", icon: Users, summary: true, lead: whoLead,
      content: (
        <>
          <Grid3>
            <Panel title="How old are they?"><ColumnChart title="Age groups" data={d.ageGroups} color={m.from} height={CHART_H} /></Panel>
            <Panel title="Men or women?"><Squares data={d.sex} unit="patients" /></Panel>
            <Panel title="Which category?"><BarList data={d.categories} color={m.from} /></Panel>
          </Grid3>
          {!ctx.print && (
            <Grid2>
              <Panel title="What do they do for a living?" icon={Tags}>
                {d.occupations.length ? <BarList data={d.occupations} limit={8} color={COLORS.secondary} /> : <ChartEmpty height={120} message="No occupations recorded" />}
              </Panel>
              <Panel title="Is the category mix changing?" subtitle="Visits by patient category" icon={LineChart}>
                <TrendChart title="Category mix" points={d.categoryTrend} series={d.categoryKeys} height={CHART_H} />
              </Panel>
            </Grid2>
          )}
        </>
      ),
    },
    {
      id: "referrals", label: "Referrals", title: "Who sends patients to you?", icon: Footprints, lead: referralLead,
      content: (
        <Grid2>
          <Panel title="Which referral sources bring the most?" subtitle="As written at registration. Click a bar to see the patients.">
            {d.referralSources.length ? <BarList data={d.referralSources} limit={8} color={COLORS.completed} /> : <ChartEmpty height={120} message="No referral sources recorded" />}
          </Panel>
          <Panel title="Which patients refer others?" subtitle="Patients who brought in the most new patients, all time">
            {d.topReferrers.length ? <BarList data={d.topReferrers} showShare={false} color={COLORS.secondary} /> : <ChartEmpty height={120} message="No patient-to-patient referrals yet" />}
          </Panel>
        </Grid2>
      ),
    },
    ...tablesTopic(d.tables),
  ];

  return <Board card="social" d={d} ctx={ctx} topics={topics} />;
}

/* ═══ Financial ════════════════════════════════════════════════════════════ */

function Financial({ d, ctx }: { d: FinancialCard; ctx: CardCtx }) {
  const per100 = (v: number) => (d.money.billed ? Math.round((v / d.money.billed) * 100) : 0);
  const moneyLead: Lead = d.hasClaims
    ? {
        headline: `For every [[₹100]] claimed, insurers approved [[₹${per100(d.money.approved)}]] and have paid [[₹${per100(d.money.received)}]] so far.`,
        facts: [{ value: rupees(Math.round(d.money.billed)), label: "claimed" }, { value: rupees(Math.round(d.money.received)), label: "received" }, { value: rupees(Math.round(d.money.pending)), label: "still to come" }],
      }
    : { headline: "No insurance claims were raised in this period.", note: "Once claims are created in the app, this chapter shows what was claimed, approved and paid." };

  const openClaims = sum(d.claimAging);
  const oldClaims = sum(d.claimAging.filter((c) => c.label.startsWith("31") || c.label.startsWith("Over")));
  const claimsLead: Lead = {
    headline: openClaims
      ? `[[${n(openClaims)}]] ${openClaims === 1 ? "claim is" : "claims are"} still open, and [[${n(oldClaims)}]] ${oldClaims === 1 ? "has" : "have"} waited more than 30 days.`
      : "No claims are open: everything raised in this period is settled or closed.",
    facts: d.byInsurer[0] ? [{ value: d.byInsurer[0].label, label: "largest insurer by amount" }] : undefined,
  };

  const insured = d.insuranceShare.reduce((a, pt) => a + (pt.values.insurance ?? 0), 0);
  const others = d.insuranceShare.reduce((a, pt) => a + (pt.values.other ?? 0), 0);
  const topCategory = top(d.categories);
  const mixLead: Lead = insured + others
    ? {
        headline: `[[${share(insured, insured + others)}%]] of visits were by patients in the Insurance category.`,
        facts: [{ value: n(insured), label: "insured visits" }, { value: n(others), label: "all other visits" }, ...(topCategory ? [{ value: topCategory.label, label: "largest category" }] : [])],
      }
    : { headline: "No visits were recorded in this period." };

  const topics: TopicDef[] = [
    {
      id: "money", label: "Money", title: "How much money is moving?", subtitle: "Claims raised in this period.", icon: Banknote, summary: true, lead: moneyLead,
      content: d.hasClaims ? (
        <>
          <Grid2>
            <Panel title="Claimed, approved and received" icon={HandCoins}><MoneyFlow money={d.money} /></Panel>
            <Panel title="What makes up the bills?" subtitle="Amounts in rupees" icon={Tags}>
              {d.billBreakdown.length ? <Donut data={d.billBreakdown} title="Bill breakdown" centerLabel="Rupees" /> : <ChartEmpty height={150} />}
            </Panel>
          </Grid2>
          {!ctx.print && (
            <Panel title="Is money coming in as fast as it is claimed?" subtitle="In rupees" icon={LineChart}>
              <TrendChart title="Claimed and received" points={d.moneyTrend} series={[s("billed", "Claimed", "#B45309"), s("received", "Received", COLORS.completed)]} height={220} />
            </Panel>
          )}
        </>
      ) : <Panel title="Claimed, approved and received"><ChartEmpty message="No insurance claims in this period" /></Panel>,
    },
    ...(d.hasClaims ? [{
      id: "claims", label: "Claims", title: "Where are the claims stuck?", subtitle: "Click a stage to see its claims.", icon: ShieldCheck, summary: true, lead: claimsLead,
      content: (
        <>
          <Grid2>
            <Panel title="What stage is each claim at?"><BarList data={d.claimStatus} /></Panel>
            <Panel title="How long have open claims waited?" subtitle="Since the claim was submitted"><ColumnChart title="Open claim aging" data={d.claimAging} color={COLORS.pending} height={CHART_H} /></Panel>
          </Grid2>
          {!ctx.print && (
            <Grid3>
              <Panel title="Which insurer owes the most?" subtitle="Amount claimed"><ValueBars data={d.byInsurer} format={rupees} color="#B45309" /></Panel>
              <Panel title="How do insurers pay?" subtitle="Amount received by payment mode">
                {d.paymentModes.length ? <ValueBars data={d.paymentModes} format={rupees} color={COLORS.completed} /> : <ChartEmpty height={120} message="No payments received yet" />}
              </Panel>
              <Panel title="Are pre-authorisations approved?">
                {d.preAuthStatus.length ? <Donut data={d.preAuthStatus} title="Pre-authorisation status" centerLabel="Requests" /> : <ChartEmpty height={150} message="No pre-authorisations in this period" />}
              </Panel>
            </Grid3>
          )}
        </>
      ),
    } satisfies TopicDef] : []),
    {
      id: "mix", label: "Patient mix", title: "Who pays, and how?", subtitle: "Useful even without billing: the mix of patient categories.", icon: Users, summary: true, lead: mixLead,
      content: (
        <Grid2>
          <Panel title="Which categories do patients fall in?"><Squares data={d.categories} unit="patients" /></Panel>
          <Panel title="How many visits are insured?" subtitle="Insurance-category patients against all others" icon={LineChart}>
            <TrendChart title="Insured visits" points={d.insuranceShare} series={[s("insurance", "Insurance", "#B45309"), s("other", "All others", COLORS.neutral)]} height={CHART_H} />
          </Panel>
        </Grid2>
      ),
    },
    ...tablesTopic(d.hasClaims ? d.tables : []),
  ];

  const note = (
    <p className="flex items-start gap-2 rounded-xl border border-[#FEDF89] bg-[#FFFAEB] px-3.5 py-2.5 text-caption leading-relaxed text-[#93370D]">
      <FileText size={14} className="mt-0.5 shrink-0" />
      <span>This card shows <span className="font-semibold">insurance money only</span>. Consultation fees, bills and collections are not recorded in the app yet, so total revenue cannot be shown.</span>
    </p>
  );
  return <Board card="financial" d={d} ctx={ctx} topics={topics} note={note} />;
}

/* ═══ Practice Pulse ═══════════════════════════════════════════════════════ */

function Pulse({ d, ctx }: { d: PulseCard; ctx: CardCtx }) {
  const m = cardMeta("pulse");

  const booked = d.journey[0]?.count ?? 0;
  const arrived = d.journey[1]?.count ?? 0;
  const signedOff = d.journey[3]?.count ?? 0;
  const journeyLead: Lead = booked
    ? {
        headline: `Of [[${n(booked)}]] booked patients, [[${n(signedOff)}]] finished with a signed consultation. [[${n(booked - signedOff)}]] dropped out along the way.`,
        facts: [{ value: `${share(arrived, booked)}%`, label: "turned up" }, { value: fmtMin(d.journey[1]?.minutes ?? null), label: "average wait" }, { value: fmtMin(d.journey[3]?.minutes ?? null), label: "whole visit" }],
      }
    : { headline: "No appointments were booked in this period." };

  // Busiest single cell of the weekday-by-hour grid
  let busiest = { day: "", hour: "", count: 0 };
  d.heatmap.values.forEach((row, di) => row.forEach((count, hi) => {
    if (count > busiest.count) busiest = { day: d.heatmap.days[di], hour: d.heatmap.hours[hi], count };
  }));
  const topDay = top(d.byWeekday);
  const topHour = top(d.byHour);
  const demandLead: Lead = busiest.count
    ? {
        headline: `[[${busiest.day}]] around [[${busiest.hour}]] is your busiest time, with ${n(busiest.count)} appointments in this period.`,
        facts: [...(topDay ? [{ value: topDay.label, label: "busiest day overall" }] : []), ...(topHour ? [{ value: topHour.label, label: "busiest hour overall" }] : [])],
        note: "Spreading bookings away from this slot is the quickest way to shorten the wait.",
      }
    : { headline: "No appointments to map in this period." };

  const topStatus = top(d.status);
  const topSource = top(d.bookingSource);
  const bookingsLead: Lead = topStatus
    ? {
        headline: `Most appointments ended as [[${topStatus.label.toLowerCase()}]]: [[${share(topStatus.value, sum(d.status))}%]] of the ${n(sum(d.status))} booked.`,
        facts: topSource ? [{ value: `${share(topSource.value, sum(d.bookingSource))}%`, label: topSource.label.toLowerCase() }] : undefined,
      }
    : { headline: "No appointments were booked in this period." };

  const topHospital = [...d.hospitals].sort((a, b) => b.appointments - a.appointments)[0];
  const hospitalsLead: Lead | undefined = topHospital
    ? { headline: `[[${topHospital.name}]] is your busiest hospital, with [[${n(topHospital.appointments)}]] appointments.` }
    : undefined;
  const topUser = d.staff?.byUser[0];
  const staffLead: Lead | undefined = topUser
    ? { headline: `[[${topUser.label}]] recorded the most activity: [[${n(topUser.value)}]] actions in this period.` }
    : undefined;

  const topics: TopicDef[] = [
    {
      id: "journey", label: "Patient journey", title: "What happens to a booked patient?", icon: Route, summary: true, lead: journeyLead,
      content: (
        <>
          <JourneyFlow steps={d.journey} color={m.from} />
          <Grid2>
            <Panel title="Why did some not finish?" subtitle="Click a bar to see the patients" icon={Footprints}>
              {d.dropouts.length ? <BarList data={d.dropouts} showShare={false} /> : <ChartEmpty height={120} message="Every booked patient finished their visit" />}
            </Panel>
            <Panel title="Where does the time go?" subtitle="Average time at each stage of a visit" icon={Clock}>
              {d.stepTimes.length ? <ValueBars data={d.stepTimes} format={minutes} /> : <ChartEmpty height={120} message="No visit timings recorded" />}
            </Panel>
          </Grid2>
        </>
      ),
    },
    {
      id: "demand", label: "Busy times", title: "When is the clinic busiest?", icon: Gauge, summary: true, lead: demandLead,
      content: (
        <>
          {d.heatmap.days.length > 0 && (
            <Panel title="Which day and hour fill up?" subtitle="Darker cells hold more appointments">
              <Heatmap title="Appointments by weekday and hour" days={d.heatmap.days} hours={d.heatmap.hours} values={d.heatmap.values} />
            </Panel>
          )}
          {!ctx.print && (
            <Grid2>
              <Panel title="Which weekday is busiest?"><ColumnChart title="Appointments by weekday" data={d.byWeekday} color={m.from} height={CHART_H} /></Panel>
              <Panel title="Which hour is busiest?"><ColumnChart title="Appointments by hour" data={d.byHour} color={m.from} height={CHART_H} /></Panel>
            </Grid2>
          )}
        </>
      ),
    },
    {
      id: "bookings", label: "Bookings and waiting", title: "How do bookings turn out?", icon: CalendarClock, lead: bookingsLead,
      content: (
        <>
          <Grid3>
            <Panel title="How did appointments end?"><Donut data={d.status} title="Appointment status" centerLabel="Appointments" /></Panel>
            <Panel title="Booked ahead or walked in?"><Squares data={d.bookingSource} unit="appointments" /></Panel>
            <Panel title="How long is the wait?" subtitle="Before being seen"><Donut data={d.waitBuckets} title="Waiting time" centerLabel="Visits" /></Panel>
          </Grid3>
          <Panel title="How did each day go?" subtitle="Appointments by outcome" icon={LineChart}>
            <TrendChart title="Appointments over time" points={d.activity} series={[s("total", "Booked", m.from), s("completed", "Completed", COLORS.completed), s("cancelled", "Cancelled", COLORS.cancelled), s("noShow", "Did not come", COLORS.neutral)]} height={220} />
          </Panel>
        </>
      ),
    },
    ...(d.hospitals.length > 1 ? [{
      id: "hospitals", label: "Hospitals", title: "How do your hospitals compare?", icon: Building2, lead: hospitalsLead,
      content: (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {d.hospitals.map((h) => (
            <div key={h.name} className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
              <p className="truncate text-label font-semibold text-[var(--color-ink-900)]" title={h.name}>{h.name}</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
                {[["Appointments", h.appointments.toLocaleString("en-IN")], ["Consultations", h.consultations.toLocaleString("en-IN")], ["Patients seen", h.patientsSeen.toLocaleString("en-IN")], ["Completed", h.completionRate === null ? "No data" : `${Math.round(h.completionRate)}%`]].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-caption text-[var(--color-ink-400)]">{k}</dt>
                    <dd className="text-heading-sm font-bold tabular-nums text-[var(--color-ink-900)]">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      ),
    } satisfies TopicDef] : []),
    ...(d.staff ? [{
      id: "staff", label: "Staff", title: "What is the team doing?", subtitle: "Logins and recorded actions by staff.", icon: Users, lead: staffLead,
      content: (
        <>
          <Grid3>
            <Panel title="Who is on the team?"><BarList data={d.staff.staff} showShare={false} /></Panel>
            <Panel title="Who is most active?" subtitle="Recorded actions"><BarList data={d.staff.byUser} limit={6} color={COLORS.secondary} /></Panel>
            <Panel title="Which parts of the app are used most?"><BarList data={d.staff.modules} limit={6} color={COLORS.info} /></Panel>
          </Grid3>
          <Panel title="How often does the team log in?" icon={LineChart}>
            <TrendChart title="Logins" points={d.staff.logins} series={[s("logins", "Successful", m.from), s("failed", "Failed", COLORS.cancelled)]} height={CHART_H} />
          </Panel>
        </>
      ),
    } satisfies TopicDef] : []),
    ...tablesTopic(d.tables),
  ];

  return <Board card="pulse" d={d} ctx={ctx} topics={topics} />;
}

/* ═══ Surgery ══════════════════════════════════════════════════════════════ */

const fmtDays = (d: number | null) => (d === null ? "-" : d < 1 ? "Same day" : `${Math.round(d * 10) / 10} days`);

/** From surgery advised to discharge: how many reach each step and the average wait before it. */
function SurgeryJourney({ steps, color }: { steps: SurgeryStep[]; color: string }) {
  const start = Math.max(1, steps[0]?.count ?? 1);
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
      {steps.map((st, i) => {
        const pctReached = Math.round((st.count / start) * 100);
        return (
          <li key={st.label} className="flex flex-col rounded-xl border border-[var(--color-border)] bg-white p-3">
            <p className="text-micro font-semibold uppercase tracking-wide text-[var(--color-ink-500)]">{i + 1}. {st.label}</p>
            <p className="mt-1 text-[22px] font-bold leading-none tabular-nums text-[var(--color-ink-900)]">{st.count.toLocaleString("en-IN")}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
              <div className="h-full rounded-full" style={{ width: `${pctReached}%`, background: color }} />
            </div>
            <p className="mt-1.5 text-micro text-[var(--color-ink-400)]">{i === 0 ? "Everyone advised surgery" : `${pctReached}% reached · ${fmtDays(st.days)} wait`}</p>
          </li>
        );
      })}
    </ol>
  );
}

function Surgery({ d, ctx }: { d: SurgeryCard; ctx: CardCtx }) {
  const m = cardMeta("surgery");
  const closed = sum(d.outcome.filter((o) => o.label !== "Still in OT"));
  const uneventful = d.outcome.find((o) => o.label === "Uneventful")?.value ?? 0;
  const outcomeLead: Lead = closed
    ? {
        headline: `[[${share(uneventful, closed)}%]] of ${n(closed)} operations were uneventful.`,
        facts: d.outcome.filter((o) => o.label !== "Uneventful").map((o) => ({ value: n(o.value), label: o.label.toLowerCase() })),
        note: d.eventReasons[0] ? `Most common eventful reason: ${d.eventReasons[0].label.toLowerCase()}.` : undefined,
      }
    : { headline: d.inOt ? `${n(d.inOt)} in OT now; no operations finished in this period yet.` : "No operations in this period." };

  const an = d.delays.anaesthesia, sh = d.delays.shift;
  const delayLead: Lead = an.total || sh.total
    ? {
        headline: `Anaesthesia followed the start after [[${fmtMin(an.avg)}]] on average; patients left OT [[${fmtMin(sh.avg)}]] after the end.`,
        facts: [
          { value: n(an.over), label: `over ${an.limit} min to anaesthesia` },
          { value: n(sh.over), label: `over ${sh.limit} min to shift` },
          { value: fmtMin(d.delays.opTime), label: "average operation" },
        ],
        note: "A reason is recorded every time these limits are crossed; the most common ones are listed below.",
      }
    : { headline: "No operation timings recorded in this period." };

  const reached = d.journey[0]?.count ?? 0;
  const operatedStep = d.journey.find((j) => j.label === "Operated");
  const journeyLead: Lead = reached
    ? {
        headline: `Of [[${n(reached)}]] patients advised surgery, [[${n(operatedStep?.count ?? 0)}]] have been operated.`,
        facts: d.journey.slice(1).filter((j) => j.days !== null).slice(0, 3).map((j) => ({ value: fmtDays(j.days), label: `to ${j.label.toLowerCase()}` })),
      }
    : { headline: "No patients were advised surgery in this period." };

  const topics: TopicDef[] = [
    {
      id: "outcomes", label: "Outcomes", title: "How did the operations go?", icon: ShieldCheck, summary: true, lead: outcomeLead,
      content: (
        <>
          <Grid3>
            <Panel title="Result" subtitle="Click a slice to see the patients"><Donut data={d.outcome} title="Operation result" centerLabel="Files" /></Panel>
            <Panel title="Which surgeries?" subtitle="Files that reached OT"><BarList data={d.bySurgery} color={m.from} limit={8} /></Panel>
            <Panel title="Why eventful?">{d.eventReasons.length ? <BarList data={d.eventReasons} color={COLORS.pending} showShare={false} /> : <ChartEmpty height={120} message="No eventful operations" />}</Panel>
          </Grid3>
          {(d.abortSteps.length > 0 || d.abortReasons.length > 0) && (
            <Grid2>
              <Panel title="At which step were operations aborted?"><BarList data={d.abortSteps} color={COLORS.cancelled} showShare={false} /></Panel>
              <Panel title="Why were they aborted?"><BarList data={d.abortReasons} color={COLORS.cancelled} showShare={false} /></Panel>
            </Grid2>
          )}
          {!ctx.print && (
            <Panel title="Operations over time" icon={LineChart}>
              <TrendChart title="Operations" points={d.trend} series={[s("operated", "Operated", m.from), s("eventful", "Eventful", COLORS.pending), s("aborted", "Aborted", COLORS.cancelled)]} height={CHART_H} />
            </Panel>
          )}
        </>
      ),
    },
    {
      id: "delays", label: "OT times", title: "Where does time go in OT?", icon: Clock, summary: true, lead: delayLead,
      content: (
        <Grid2>
          <Panel title="Average time at each stage" icon={Clock}>
            {d.stageTimes.length ? <ValueBars data={d.stageTimes} format={minutes} /> : <ChartEmpty height={120} message="No timings recorded" />}
          </Panel>
          <Panel title="Reasons given for delays" subtitle="Anaesthesia and shift to ward">
            {d.delayReasons.length ? <BarList data={d.delayReasons} color={COLORS.info} showShare={false} /> : <ChartEmpty height={120} message="No delays needed a reason" />}
          </Panel>
        </Grid2>
      ),
    },
    {
      id: "journey", label: "Advised to discharge", title: "How long from surgery advised to discharge?", icon: Route, lead: journeyLead,
      content: <SurgeryJourney steps={d.journey} color={m.from} />,
    },
    ...tablesTopic(d.tables),
  ];

  return <Board card="surgery" d={d} ctx={ctx} topics={topics} />;
}
