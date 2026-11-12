/**
 * The five Analytics cards and the shapes their dashboards are built from.
 * Client-safe (no server imports).
 */
import type { Cat, SeriesPoint, TableData } from "./definitions";

export type CardId = "clinical" | "surgery" | "social" | "financial" | "pulse";

export interface CardMeta {
  id: CardId;
  label: string;
  /** One line under the title: what this card answers. */
  tagline: string;
  /** Gradient stops for the card and its dashboard header. */
  from: string;
  to: string;
  /** Soft tint used behind icons and highlights. */
  tint: string;
  ink: string;
}

export const CARDS: CardMeta[] = [
  { id: "clinical",  label: "Clinical",       tagline: "What you are treating, and how well it is going",    from: "#0F766E", to: "#14B8A6", tint: "#E6F6F4", ink: "#0F5F59" },
  { id: "surgery",   label: "Surgery",        tagline: "Procedures, outcomes and theatre use",               from: "#6D28D9", to: "#A78BFA", tint: "#F1ECFE", ink: "#5B21B6" },
  { id: "social",    label: "Social",         tagline: "Who your patients are and who sends them to you",     from: "#1D4ED8", to: "#60A5FA", tint: "#EAF1FE", ink: "#1E40AF" },
  { id: "financial", label: "Financial",      tagline: "Insurance claims, money billed and money received",  from: "#B45309", to: "#F59E0B", tint: "#FEF3E2", ink: "#92400E" },
  { id: "pulse",     label: "Practice Pulse", tagline: "How smoothly the day runs, from booking to sign-off", from: "#BE185D", to: "#F472B6", tint: "#FDECF4", ink: "#9D174D" },
];

export const cardMeta = (id: CardId) => CARDS.find((c) => c.id === id)!;
export const isCardId = (v: string | undefined): v is CardId => !!v && CARDS.some((c) => c.id === v);

/** A headline number. `band` compares it with the practice's own usual range. */
export interface Tile {
  label: string;
  value: string;
  /** Small line under the value. */
  hint?: string;
  /** Change vs the comparison period, as a percentage (already rounded). */
  changePct?: number | null;
  /** Whether a rise is good news (drives the colour of the change chip). */
  upIsGood?: boolean;
  band?: { text: string; state: "above" | "below" | "typical" } | null;
  spark?: number[];
  href?: string;
}

/** Something to act on today. */
export interface AttentionItem {
  text: string;
  detail?: string;
  severity: "high" | "medium" | "low";
  /** Opens the list of patients behind it. */
  href?: string;
}

/** The patients behind a chart bar or an attention item. */
export interface DrillData {
  title: string;
  subtitle: string;
  table: TableData;
}

/** Share of patients in three states, per group (e.g. vision improved / same / worse by diagnosis). */
export interface OutcomeRow {
  label: string;
  better: number;
  same: number;
  worse: number;
}

export interface JourneyStep {
  label: string;
  count: number;
  /** Average minutes spent before reaching the next step; null when not measured. */
  minutes: number | null;
  /** What the minutes measure, e.g. "waiting". */
  minutesLabel?: string;
}

export interface CardSummary {
  id: CardId;
  /** Headline number on the landing card. */
  headline: string;
  headlineLabel: string;
  /** One plain sentence. */
  line: string;
  spark: number[];
  changePct: number | null;
  locked?: boolean;
}

export interface CardCommon {
  takeaways: string[];
  attention: AttentionItem[];
  tiles: Tile[];
  drill: DrillData | null;
}

export interface ClinicalCard extends CardCommon {
  activity: SeriesPoint[];
  topComplaints: Cat[];
  topDiagnoses: Cat[];
  diagnosisTrend: SeriesPoint[];
  topMedications: Cat[];
  documentation: Cat[];
  byDoctor: Cat[];
  byHospital: Cat[];
  vision: { total: number; overall: OutcomeRow; byDiagnosis: OutcomeRow[] };
  iop: { patients: number; controlled: number; uncontrolled: number; trend: SeriesPoint[] };
  protocols: { confirmed: number; withProtocol: number; top: Cat[] };
  followUps: { status: Cat[]; trend: SeriesPoint[]; aging: Cat[]; adherence: Cat[] } | null;
  investigations: { status: Cat[]; topTests: Cat[]; aging: Cat[]; volume: SeriesPoint[]; openTotal: number } | null;
  tables: TableData[];
}

export interface SocialCard extends CardCommon {
  growth: SeriesPoint[];
  newVsReturning: Cat[];
  ageGroups: Cat[];
  sex: Cat[];
  frequency: Cat[];
  occupations: Cat[];
  categories: Cat[];
  categoryTrend: SeriesPoint[];
  categoryKeys: { key: string; label: string; color: string }[];
  referralSources: Cat[];
  topReferrers: Cat[];
  referredShare: { referred: number; total: number };
  tables: TableData[];
}

export interface FinancialCard extends CardCommon {
  hasClaims: boolean;
  money: { billed: number; approved: number; received: number; pending: number };
  claimStatus: Cat[];
  billBreakdown: Cat[];
  byInsurer: Cat[];
  paymentModes: Cat[];
  moneyTrend: SeriesPoint[];
  preAuthStatus: Cat[];
  claimAging: Cat[];
  categories: Cat[];
  insuranceShare: SeriesPoint[];
  tables: TableData[];
}

export interface PulseCard extends CardCommon {
  journey: JourneyStep[];
  dropouts: Cat[];
  stepTimes: Cat[];
  activity: SeriesPoint[];
  status: Cat[];
  byWeekday: Cat[];
  byHour: Cat[];
  bookingSource: Cat[];
  heatmap: { days: string[]; hours: string[]; values: number[][] };
  waitBuckets: Cat[];
  hospitals: { name: string; appointments: number; consultations: number; patientsSeen: number; completionRate: number | null }[];
  staff: { staff: Cat[]; byUser: Cat[]; modules: Cat[]; logins: SeriesPoint[] } | null;
  tables: TableData[];
}

/** One step from surgery advised to discharge; `days` is the average wait since the step before. */
export interface SurgeryStep {
  label: string;
  count: number;
  days: number | null;
}

export interface SurgeryCard extends CardCommon {
  operated: number;
  inOt: number;
  outcome: Cat[];
  bySurgery: Cat[];
  eventReasons: Cat[];
  abortSteps: Cat[];
  abortReasons: Cat[];
  delays: {
    anaesthesia: { avg: number | null; over: number; total: number; limit: number };
    shift: { avg: number | null; over: number; total: number; limit: number };
    opTime: number | null;
  };
  delayReasons: Cat[];
  stageTimes: Cat[];
  journey: SurgeryStep[];
  trend: SeriesPoint[];
  tables: TableData[];
}

export type CardData = ClinicalCard | SocialCard | FinancialCard | PulseCard | SurgeryCard;
