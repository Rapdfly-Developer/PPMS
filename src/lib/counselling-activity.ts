// Full counselling timeline for one visit, built from the audit log (every
// counselling action is audited) plus the timestamps stored on the records.
import { prisma } from "@/lib/prisma";

export type ActivityTone = "primary" | "amber" | "emerald" | "orange" | "slate" | "red";
export type ActivityEvent = { at: string; title: string; detail?: string; by?: string; tone: ActivityTone };

const parse = (raw: string | null): Record<string, unknown> => {
  if (!raw) return {};
  try { const v = JSON.parse(raw); return v && typeof v === "object" ? v as Record<string, unknown> : {}; } catch { return {}; }
};
const rupees = (n: unknown) => (typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : null);
const day = (v: unknown) => {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
};

export async function getCounsellingActivity(input: {
  visitId: string;
  visitDate: Date;
  finalizedAt: Date | null;
  doctorName: string;
  surgery: string;
  orders: { id: string; testName: string; createdAt: Date; resultAt: Date | null }[];
  rec: {
    createdAt: Date;
    fitForSurgery: boolean; doctorReviewedAt: Date | null; fitByName: string | null;
    eligibleForSurgery: boolean; confirmedAt: Date | null; eligibleByName: string | null;
    surgeryDeferred: boolean; postponedAt: Date | null;
  } | null;
  preOp: { dateTime: Date } | null;
}): Promise<ActivityEvent[]> {
  const { visitId, orders, rec } = input;
  const orderIds = orders.map((o) => o.id);
  const testName = new Map(orders.map((o) => [o.id, o.testName]));

  const logs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: "CounsellingRecord", entityId: visitId },
        { entityType: "Visit", entityId: visitId, action: { in: ["SURGICAL_COUNSELLING_SAVE", "SURGICAL_COUNSELLING_CLEAR"] } },
        ...(orderIds.length ? [{ entityType: "InvestigationOrder", entityId: { in: orderIds }, action: { in: ["RESULT_ATTACHED", "RESULT_REMOVED"] } }] : []),
      ],
    },
    orderBy: { timestamp: "asc" },
    select: {
      entityType: true, entityId: true, action: true, newValue: true, timestamp: true, userName: true,
      user: { select: { username: true, doctor: { select: { name: true } }, hospitalStaff: { select: { name: true } }, refractionist: { select: { name: true } } } },
    },
  });

  const ev: ActivityEvent[] = [];
  const at = (d: Date) => d.toISOString();
  const seen = new Set<string>();

  // EMR origin
  ev.push({ at: at(input.visitDate), title: "Surgery advised in the EMR visit", detail: input.surgery, by: `Dr. ${input.doctorName}`, tone: "slate" });
  if (input.finalizedAt) {
    ev.push({ at: at(input.finalizedAt), title: "Visit finalized & signed — added to Counselling", tone: "slate" });
  }

  let detailsStarted = false;
  for (const l of logs) {
    const by = l.userName ?? l.user.doctor?.name ?? l.user.hospitalStaff?.name ?? l.user.refractionist?.name ?? l.user.username;
    const v = parse(l.newValue);
    const t = at(l.timestamp);
    switch (`${l.entityType}:${l.action}`) {
      case "Visit:SURGICAL_COUNSELLING_SAVE":
        ev.push({ at: t, title: "Surgical counselling saved in the EMR", detail: [v.advisedSurgeryEye, v.advisedSurgeryName].filter(Boolean).join(" ") || undefined, by, tone: "slate" });
        break;
      case "Visit:SURGICAL_COUNSELLING_CLEAR":
        ev.push({ at: t, title: "Surgical counselling removed in the EMR", by, tone: "red" });
        break;
      case "CounsellingRecord:UPDATE":
        // Details auto-save on every change; only the first save is a milestone.
        if (!detailsStarted) { detailsStarted = true; ev.push({ at: t, title: "Counselling started — details being filled", by, tone: "primary" }); }
        break;
      case "CounsellingRecord:ADD_INVESTIGATIONS": {
        const names = Array.isArray(v.names) ? (v.names as string[]).join(", ") : "";
        ev.push({ at: t, title: "Additional investigations ordered", detail: [names, v.inViewOf ? `In view of: ${v.inViewOf}` : ""].filter(Boolean).join(" · ") || undefined, by, tone: "primary" });
        break;
      }
      case "InvestigationOrder:RESULT_ATTACHED":
        seen.add(`report:${l.entityId}`);
        ev.push({ at: t, title: `Report uploaded: ${testName.get(l.entityId) ?? "investigation"}`, by, tone: "primary" });
        break;
      case "InvestigationOrder:RESULT_REMOVED":
        ev.push({ at: t, title: `Report removed: ${testName.get(l.entityId) ?? "investigation"}`, by, tone: "red" });
        break;
      case "CounsellingRecord:FIT_FOR_SURGERY":
        seen.add("fit");
        ev.push({ at: t, title: "Marked fit for surgery", detail: v.validUntil ? `Reports valid till ${day(v.validUntil)}` : undefined, by, tone: "amber" });
        break;
      case "CounsellingRecord:REOPEN":
        ev.push({ at: t, title: "Counselling reopened — reports to be redone", by, tone: "red" });
        break;
      case "CounsellingRecord:POSTPONE":
        seen.add("postpone");
        ev.push({
          at: t, title: "Surgery date not confirmed",
          detail: [v.postponedIndefinitely ? "Not decided yet" : v.postponedUntil ? `Expected ${day(v.postponedUntil)}` : "", v.deferralNotes as string].filter(Boolean).join(" · ") || undefined,
          by, tone: "orange",
        });
        break;
      case "CounsellingRecord:RESUME":
        ev.push({ at: t, title: "Counselling resumed", by, tone: "primary" });
        break;
      case "CounsellingRecord:ADVANCE":
        seen.add("advance");
        ev.push({ at: t, title: v.advancePaid != null ? `Advance recorded: ${rupees(Number(v.advancePaid))}` : v.advanceReceived ? "Advance marked as received" : "Advance cleared", by, tone: "primary" });
        break;
      case "CounsellingRecord:ELIGIBLE_FOR_SURGERY":
        seen.add("eligible");
        ev.push({ at: t, title: "Confirmation done — eligible for surgery", detail: "Date, implant and surgery verified twice", by, tone: "emerald" });
        break;
    }
  }

  // Older records saved before every step was audited
  for (const o of orders) {
    if (o.resultAt && !seen.has(`report:${o.id}`)) ev.push({ at: at(o.resultAt), title: `Report uploaded: ${o.testName}`, tone: "primary" });
  }
  if (rec) {
    if (!detailsStarted) ev.push({ at: at(rec.createdAt), title: "Counselling started — details being filled", tone: "primary" });
    if (rec.fitForSurgery && rec.doctorReviewedAt && !seen.has("fit")) ev.push({ at: at(rec.doctorReviewedAt), title: "Marked fit for surgery", by: rec.fitByName ?? undefined, tone: "amber" });
    if (rec.surgeryDeferred && rec.postponedAt && !seen.has("postpone")) ev.push({ at: at(rec.postponedAt), title: "Surgery date not confirmed", tone: "orange" });
    if (rec.eligibleForSurgery && rec.confirmedAt && !seen.has("eligible")) ev.push({ at: at(rec.confirmedAt), title: "Confirmation done — eligible for surgery", by: rec.eligibleByName ?? undefined, tone: "emerald" });
    if (rec.eligibleForSurgery && rec.confirmedAt && input.preOp) {
      ev.push({ at: at(new Date(rec.confirmedAt.getTime() + 1)), title: "Pre-op appointment booked", detail: input.preOp.dateTime.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }), tone: "emerald" });
    }
  }

  return ev.sort((a, b) => b.at.localeCompare(a.at));
}
