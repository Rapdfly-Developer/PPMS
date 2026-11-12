import { notFound } from "next/navigation";
import { requirePermission, userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { loadIpdFileData } from "@/lib/ipd-file-data";
import { formsFor, isCustomKey } from "@/lib/ipd";
import { isV2, type OtNotesData } from "@/lib/ipd-forms";
import { isOtNotesCopy, parseVerified } from "@/lib/ot";
import { OtFile, type OtCaseData } from "./OtFile";

export const metadata = { title: "OT File" };

export default async function OtFilePage({ params }: { params: Promise<{ admissionId: string }> }) {
  const { admissionId } = await params;
  const user = await requirePermission("ot.view");
  const d = await loadIpdFileData(admissionId, user, "/ot");
  // Only files that were shifted to OT open here (Upcoming are placeholders)
  if (!d || !d.shiftedToOtAt) notFound();

  const c = await prisma.otCase.upsert({ where: { admissionId }, create: { admissionId }, update: {} });
  const discharge = await prisma.ipdForm.findUnique({ where: { admissionId_key: { admissionId, key: "discharge" } }, select: { updatedAt: true } });

  const parse = (s: string | null) => { if (!s) return null; try { return JSON.parse(s); } catch { return null; } };
  const notes = parse(c.otNotes);
  const draftRow = d.forms.find((f) => f.key === "otNotes")?.data;
  const preset = d.defaults.otNotes as OtNotesData;
  const draft: OtNotesData = isV2(draftRow) ? { ...preset, ...(draftRow as OtNotesData) } : preset;

  const iso = (x: Date | null) => x?.toISOString() ?? null;
  const oc: OtCaseData = {
    verified: parseVerified(c.verified),
    confirmedAt: iso(c.confirmedAt), confirmedBy: c.confirmedBy,
    begunAt: iso(c.begunAt), begunBy: c.begunBy,
    anaesthesiaAt: iso(c.anaesthesiaAt), anaesthesiaBy: c.anaesthesiaBy, anaesthesiaDelayReason: c.anaesthesiaDelayReason,
    endedAt: iso(c.endedAt), endedBy: c.endedBy,
    abortedAt: iso(c.abortedAt), abortedBy: c.abortedBy, abortReason: c.abortReason, abortStep: c.abortStep,
    outcomeSavedAt: iso(c.outcomeSavedAt),
    eventful: c.eventful, eventReason: c.eventReason ?? "", eventStep: c.eventStep ?? "",
    intraOp: c.intraOpManagement ?? "", postOp: c.postOpManagement ?? "",
    otNotesChoice: c.otNotesChoice, wardNotesChoice: c.wardNotesChoice,
    otNotes: isOtNotesCopy(notes) ? notes : null, otNotesSavedAt: iso(c.otNotesSavedAt), otNotesSavedBy: c.otNotesSavedBy,
    shiftedToWardAt: iso(c.shiftedToWardAt), shiftedToWardBy: c.shiftedToWardBy, shiftDelayReason: c.shiftDelayReason,
    dischargedFromOt: c.dischargedFromOt,
    dischargeSavedInOt: !!(discharge && c.endedAt && discharge.updatedAt > c.endedAt),
  };

  // The forms to verify again: the file's forms for its admission type, plus custom ones
  const items = [
    ...formsFor(d.type).map((f) => ({ key: f.key as string, title: f.title, display: !!f.display })),
    ...d.forms.filter((f) => isCustomKey(f.key)).map((f) => ({ key: f.key, title: f.title, display: false })),
  ];

  return (
    <OtFile
      d={d}
      oc={oc}
      items={items}
      draft={draft}
      can={{
        verify: userCan(user, "ot.verify"),
        operate: userCan(user, "ot.operate"),
        notes: userCan(user, "ot.notes"),
        shiftWard: userCan(user, "ot.shiftWard"),
        discharge: userCan(user, "ipd.discharge"),
        ipd: userCan(user, "ipd.view"),
        profile: userCan(user, "patients.view"),
      }}
    />
  );
}
