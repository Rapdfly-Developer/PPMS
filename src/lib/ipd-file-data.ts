// Server-only: builds the IPD patient file (shared by the IPD file page and the OT file page).
import { prisma } from "@/lib/prisma";
import { istTodayStr } from "@/lib/ist";
import { visitRecordScope } from "@/lib/patient-access";
import type { SessionUser } from "@/lib/rbac";
import { admissionTypeText, buildDischargeDraft, otTemplateSteps } from "@/lib/ipd";
import {
  defaultChecklist, defaultConsents, defaultEducation, defaultImplant, defaultNurse, defaultOtNotes, defaultPostOp,
  completeEducation, defaultTreatment, educationAdvice, educationStage, emrMedsToOrders, isV2, type EducationData, type FormContext,
  upgradeConsents,
} from "@/lib/ipd-forms";
import { getOwnerDoctorId } from "@/lib/role-permissions";
import { allergyLine, latestDrugAllergy } from "@/lib/care-sync";
import { implantFromCounselling, parseCounsellingConsents, parseCounsellingEducation, parseCounsellingImplant } from "@/lib/counselling-sheets";
import { CASHLESS_TYPES, paymentLabel, parsePaymentDocs, SUPERSEDED } from "@/lib/counselling";
import type { FileData } from "@/app/(app)/ipd/[admissionId]/PatientFile";

/** Category shown as the coloured badge, as on the patient Time Stamp. */
const ACTIVITY_KIND: Record<string, "admission" | "form" | "update" | "ot" | "discharge" | "note" | "dose"> = {
  DETAILS_UPDATED: "update",
  SURGERY_DETAILS_CHANGED: "update",
  TYPE_CHANGED: "update",
  FORM_FROZEN: "form",
  FORM_ADDED: "form",
  FORM_REMOVED: "form",
  FILE_CREATED: "form",
  PHOTO_ADDED: "form",
  SHIFTED_TO_OT: "ot",
  OT_FORM_VERIFIED: "ot",
  OT_CONFIRMED: "ot",
  OT_BEGUN: "ot",
  OT_ANAESTHESIA: "ot",
  OT_ENDED: "ot",
  OT_ABORTED: "ot",
  OT_OUTCOME: "ot",
  OT_NOTES_SAVED: "ot",
  OT_SHIFTED_TO_WARD: "ot",
  DISCHARGED: "discharge",
};

const ACTIVITY_TEXT: Record<string, string> = {
  DETAILS_UPDATED: "Ward / floor / file details updated",
  SURGERY_DETAILS_CHANGED: "Surgery details changed",
  TYPE_CHANGED: "Type of admission changed",
  FORM_FROZEN: "Form frozen",
  FORM_ADDED: "Form added",
  FORM_REMOVED: "Tab removed",
  FILE_CREATED: "Patient file created",
  PHOTO_ADDED: "Photo attached",
  SHIFTED_TO_OT: "Shifted to OT",
  OT_FORM_VERIFIED: "Form verified in OT",
  OT_CONFIRMED: "Everything confirmed and verified in OT",
  OT_BEGUN: "Operation begun",
  OT_ANAESTHESIA: "Anaesthesia administered",
  OT_ENDED: "Operation ended",
  OT_ABORTED: "Operation aborted",
  OT_OUTCOME: "Operation status recorded",
  OT_NOTES_SAVED: "OT notes saved",
  OT_SHIFTED_TO_WARD: "Shifted to ward from OT",
  DISCHARGED: "Discharged · summary signed with OTP",
};

/** The patient file for an admission in the user's scope, or null. */
export async function loadIpdFileData(admissionId: string, user: SessionUser, returnTo?: string): Promise<FileData | null> {
  const scope = await visitRecordScope(user);
  if (!scope) return null;

  const a = await prisma.ipdAdmission.findFirst({
    where: { id: admissionId, visit: { ...scope, finalizedAt: { not: null } } },
    include: {
      forms: true,
      doctorNotes: { orderBy: { createdAt: "desc" } },
      visit: {
        select: {
          id: true, date: true, finalizedAt: true, status: true,
          followUpDate: true,
          hospitalId: true,
          hospital: { select: { name: true, address: true, contact: true, logoUrl: true } },
          doctor: { select: { name: true, qualifications: true, medicalRegNumber: true } },
          patient: { select: { id: true, name: true, udid: true, uhid: true, age: true, sex: true, mobile: true, photoUrl: true } },
          generalExam: { select: { chiefComplaint: true } },
          diagnoses: { select: { description: true, laterality: true }, orderBy: { createdAt: "asc" } },
          medications: { select: { id: true, drugName: true, dosage: true, frequency: true, duration: true, route: true, laterality: true, instructions: true }, orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!a) return null;
  const v = a.visit;
  const udid = v.patient.udid ?? v.patient.id;

  // Investigation reports: every order for this patient within the user's scope
  const orders = await prisma.investigationOrder.findMany({
    // Reports replaced by a No Show retake are history (as in Counselling)
    where: { visit: { patientId: v.patient.id, ...scope }, status: { not: SUPERSEDED } },
    orderBy: { createdAt: "desc" },
    select: { id: true, testName: true, laterality: true, notes: true, resultRef: true, resultAt: true, extraResultRefs: true, updatedAt: true, createdAt: true, priority: true, doctorNotes: true, status: true },
  });

  // EMR details for the discharge draft: the admitting visit first, then the
  // patient's most recent earlier visit that has them (e.g. the counselling visit)
  const emrVisits = await prisma.visit.findMany({
    where: { patientId: v.patient.id, ...scope, date: { lte: v.date } },
    orderBy: { date: "desc" },
    take: 8,
    select: {
      id: true,
      generalExam: { select: { chiefComplaint: true, pastMedicalHistory: true, pmhOtherText: true, familyHistory: true, allergies: true, nkda: true } },
      diagnoses: { select: { description: true, laterality: true, status: true }, orderBy: { createdAt: "asc" } },
      visualAcuity: { select: { re: true, le: true } },
      iopReadings: { select: { re: true, le: true }, orderBy: { takenAt: "desc" }, take: 1 },
      anteriorSegment: { select: { re: true, le: true } },
      posteriorSegment: { select: { re: true, le: true } },
    },
  });
  // The doctor's notes of this admission are the latest word: newest first, then the admitting visit, then older visits
  const noteVisits = a.doctorNotes
    .map((n) => { try { return n.data ? (JSON.parse(n.data) as { v?: number; visit?: unknown } | null) : null; } catch { return null; } })
    .filter((x): x is { v: number; visit: Record<string, unknown> } => !!x && x.v === 2 && typeof x.visit === "object")
    .map((x) => x.visit as unknown as (typeof emrVisits)[number]);
  const ordered = [...noteVisits, ...emrVisits.filter((x) => x.id === v.id), ...emrVisits.filter((x) => x.id !== v.id)];
  const firstWith = <T,>(pick: (x: (typeof emrVisits)[number]) => T | null | undefined, ok: (t: T) => boolean = () => true): T | null => {
    for (const x of ordered) { const t = pick(x); if (t != null && ok(t)) return t; }
    return null;
  };
  const vaHas = (r: { re: string | null; le: string | null }) => /\d|PL|HM|CF/.test(`${r.re ?? ""}${r.le ?? ""}`);
  const segHas = (r: { re: string | null; le: string | null }) => /:"[^"]+"/.test(`${r.re ?? ""}${r.le ?? ""}`);

  // Drug allergy: the patient's latest EMR entry (also edits made in Counselling)
  const drugAllergy = await latestDrugAllergy(v.patient.id, scope);

  const counselling = a.counsellingVisitId
    ? await prisma.counsellingRecord.findUnique({
        where: { visitId: a.counsellingVisitId },
        select: {
          paymentType: true, paymentMode: true, schemeName: true, policyNumber: true, eligibleByName: true, confirmedAt: true, implantDetails: true, consents: true, education: true,
          implant: true, dateOfSurgery: true, paymentDocs: true, estimateAmount: true, advancePaid: true, advanceReceived: true,
          fitForSurgery: true, fitByName: true, doctorReviewedAt: true,
          visit: { select: { advisedSurgeryName: true, advisedSurgeryEye: true, advisedSurgeryNotes: true, advisedSurgeryAnaesthesia: true, advisedSurgeryImplant: true, advisedSurgeryDate: true } },
        },
      })
    : null;

  // The Counselling module's sheet (surgery, implant details, payment), shown as a tab of the file
  const rupees = (n: unknown) => (n == null ? "" : `₹${Number(n).toLocaleString("en-IN")}`);
  const counsellingSheet = counselling ? (() => {
    const cv = counselling.visit;
    const cashless = CASHLESS_TYPES.find((t) => t.value === counselling.paymentType);
    return {
      surgery: cv.advisedSurgeryName ?? a.surgery ?? "",
      laterality: cv.advisedSurgeryEye ?? a.laterality,
      anaesthesia: cv.advisedSurgeryAnaesthesia ?? a.anaesthesia,
      surgeryNotes: cv.advisedSurgeryNotes,
      implant: counselling.implant ?? cv.advisedSurgeryImplant ?? "",
      dateOfSurgery: (counselling.dateOfSurgery ?? cv.advisedSurgeryDate)?.toISOString() ?? "",
      implantInfo: parseCounsellingImplant(counselling.implantDetails),
      payment: paymentLabel(counselling.paymentMode, counselling.paymentType),
      payerLabel: cashless?.nameLabel ?? "", payer: cashless ? counselling.schemeName ?? "" : "",
      idLabel: cashless?.idLabel ?? "", payerId: cashless ? counselling.policyNumber ?? "" : "",
      docs: cashless ? parsePaymentDocs(counselling.paymentDocs) : [],
      estimate: rupees(counselling.estimateAmount),
      advance: counselling.advancePaid != null ? rupees(counselling.advancePaid) : counselling.advanceReceived ? "Received" : "",
      fit: counselling.fitForSurgery, fitBy: counselling.fitByName, fitAt: counselling.doctorReviewedAt?.toISOString() ?? null,
    };
  })() : null;

  const audit = await prisma.auditLog.findMany({
    where: { entityType: "IpdAdmission", entityId: a.id },
    orderBy: { timestamp: "desc" },
    take: 200,
    select: { action: true, newValue: true, userName: true, timestamp: true },
  });
  // Notes and doses are kept in the forms themselves: each one is a timestamped line of the activity
  const parseJson = (s: string) => { try { return JSON.parse(s); } catch { return {}; } };
  const noteEvents = [
    ...a.doctorNotes.flatMap((n) => [
      { at: n.createdAt.toISOString(), by: n.byName, text: "Doctor's note added", detail: "", kind: "note" as const, form: "doctorNotes" },
      ...(n.editedAt ? [{ at: n.editedAt.toISOString(), by: n.byName, text: "Doctor's note edited", detail: "", kind: "note" as const, form: "doctorNotes" }] : []),
    ]),
    ...(((parseJson(a.forms.find((f) => f.key === "nurse")?.data ?? "{}").entries ?? []) as { at?: string; by?: string; editedAt?: string }[]).flatMap((e) => [
      ...(e.at ? [{ at: e.at, by: e.by ?? "", text: "Nurse note added", detail: "", kind: "note" as const, form: "nurse" }] : []),
      ...(e.editedAt ? [{ at: e.editedAt, by: e.by ?? "", text: "Nurse note edited", detail: "", kind: "note" as const, form: "nurse" }] : []),
    ])),
    ...(((parseJson(a.forms.find((f) => f.key === "treatment")?.data ?? "{}").log ?? []) as { at?: string; by?: string; text?: string; kind?: string }[])
      .filter((e) => e.kind === "dose" && e.at)
      .map((e) => ({ at: e.at as string, by: e.by ?? "", text: "Dose given", detail: String(e.text ?? "").replace(/ given/, ""), kind: "dose" as const, form: "treatment" }))),
  ];
  const activity = [
    ...noteEvents,
    ...audit.map((l) => {
      let detail = "";
      try {
        const nv = l.newValue ? JSON.parse(l.newValue) : null;
        if (l.action === "FORM_FROZEN" || l.action === "FORM_ADDED" || l.action === "FORM_REMOVED") detail = nv?.title ?? "";
        if (l.action === "FILE_CREATED" && Array.isArray(nv?.tabs)) detail = nv.tabs.join(", ");
        if (l.action === "PHOTO_ADDED") detail = nv?.name ?? "";
        if (typeof nv?.detail === "string" && l.action.startsWith("OT_")) detail = nv.detail;
        if (l.action === "TYPE_CHANGED") detail = `${admissionTypeText(nv?.from ?? "")} → ${admissionTypeText(nv?.to ?? "", nv?.other)}`;
        if (l.action === "DETAILS_UPDATED") {
          detail = [nv?.ward && `Ward ${nv.ward}`, nv?.floor && `Floor ${nv.floor}`, nv?.fileNo && `File ${nv.fileNo}`].filter(Boolean).join(" · ");
        }
      } catch { /* ignore */ }
      let form = "";
      try { const nv = l.newValue ? JSON.parse(l.newValue) : null; if (typeof nv?.key === "string") form = nv.key; } catch { /* ignore */ }
      return { at: l.timestamp.toISOString(), by: l.userName ?? "", text: ACTIVITY_TEXT[l.action] ?? l.action, detail, kind: ACTIVITY_KIND[l.action] ?? "update", form };
    }),
    { at: (v.finalizedAt ?? a.createdAt).toISOString(), by: v.doctor.name, text: "Admitted (EMR finalized & signed)", detail: admissionTypeText(a.admissionType, a.admissionTypeOther), kind: "admission" as const },
    ...(a.returnedFromOtAt ? [{ at: a.returnedFromOtAt.toISOString(), by: "", text: "Back to ward (post-op)", detail: "", kind: "ot" as const }] : []),
  ].sort((x, y) => y.at.localeCompare(x.at));

  const parse = (s: string) => { try { return JSON.parse(s); } catch { return {}; } };

  // The colours given to the tabs, shared by everyone in the hospital
  const colourRows = await prisma.chipOption.findMany({ where: { category: "ipd_tab_colour", hospitalId: v.hospitalId, active: true }, select: { value: true, label: true } });
  const tabColours: Record<string, string> = Object.fromEntries(colourRows.map((r) => [r.value, r.label]));

  // The doctor's own OT templates and education sets (staff use their doctor's)
  const ownerId = user.role === "DOCTOR" ? user.profileId : await getOwnerDoctorId(user.id);
  const templates = ownerId
    ? (await prisma.ipdTemplate.findMany({ where: { doctorId: ownerId }, orderBy: { updatedAt: "desc" } })).map((t) => ({
        id: t.id, kind: t.kind, name: t.name, surgery: t.surgery,
        items: (() => { const x = parse(t.items); return Array.isArray(x) ? x.filter((i): i is string => typeof i === "string") : []; })(),
      }))
    : [];
  const ctx: FormContext = {
    patientName: v.patient.name, age: v.patient.age, sex: v.patient.sex, patientId: v.patient.uhid ?? udid,
    hospital: v.hospital.name, doctor: v.doctor.name,
    surgery: a.surgery, eye: a.laterality, implant: a.implant, anaesthesia: a.anaesthesia,
    surgeryDate: a.surgeryDate?.toISOString() ?? null, type: a.admissionType,
  };
  const savedEducation = (() => { const t = a.forms.find((f) => f.key === "education"); const x = t ? parse(t.data) : null; return isV2(x) ? (x as EducationData) : null; })();
  // A Pre-op file starts from the sheets filled at counselling (until the ward saves its own)
  const education = completeEducation(savedEducation ?? (counselling && parseCounsellingEducation(counselling.education)) ?? defaultEducation(ctx), ctx);
  const defaults: Record<string, unknown> = {
    implant: counselling ? implantFromCounselling(counselling.implantDetails) : defaultImplant(),
    counselling: { v: 1, verify: { patient: null, eye: null, implant: null, power: null, expiry: null } },
    consents: upgradeConsents((counselling && parseCounsellingConsents(counselling.consents)) ?? defaultConsents(ctx), ctx),
    checklist: defaultChecklist(),
    education,
    // The treatment chart starts with the EMR prescription; after that the doctor's notes add or stop medicines
    treatment: { ...defaultTreatment(), drugs: emrMedsToOrders(v.medications, a.admittedOn) },
    nurse: defaultNurse(a.admissionType),
    otNotes: defaultOtNotes(ctx, otTemplateSteps(a)),
    postOpNotes: defaultPostOp(),
    discharge: buildDischargeDraft({
      type: a.admissionType,
      doctor: v.doctor.name,
      admittedOn: a.admittedOn,
      expectedDischarge: a.expectedDischarge,
      surgery: a.surgery, laterality: a.laterality, implant: a.implant, anaesthesia: a.anaesthesia, surgeryDate: a.surgeryDate,
      complaint: firstWith((x) => x.generalExam?.chiefComplaint, (t) => !!t.trim()),
      diagnoses: firstWith((x) => x.diagnoses, (t) => t.length > 0) ?? [],
      pastHistory: firstWith((x) => x.generalExam?.pastMedicalHistory, (t) => t !== "[]"),
      pmhOther: firstWith((x) => x.generalExam?.pmhOtherText, (t) => !!t.trim()),
      familyHistory: firstWith((x) => x.generalExam?.familyHistory, (t) => !!t.trim()),
      allergies: drugAllergy.text || null,
      nkda: drugAllergy.nkda,
      va: firstWith((x) => x.visualAcuity, vaHas),
      iop: firstWith((x) => x.iopReadings[0], (r) => r.re != null || r.le != null),
      anterior: firstWith((x) => x.anteriorSegment, segHas),
      posterior: firstWith((x) => x.posteriorSegment, segHas),
      orders: orders.map((o) => ({ id: o.id, testName: o.testName, laterality: o.laterality, resultAt: o.resultRef ? (o.resultAt ?? o.updatedAt) : null, createdAt: o.createdAt })),
      doctorNotes: a.doctorNotes.map((n) => ({ text: n.text, at: n.createdAt })),
      drugs: (() => {
        const t = a.forms.find((f) => f.key === "treatment");
        const x = t ? parse(t.data) : {};
        const chart = Array.isArray(x.drugs) ? x.drugs.filter((dr: { stopped?: boolean }) => !dr.stopped) : [];
        // Post-op medicines from the education sheet that are not on the chart yet
        const named = new Set(chart.map((dr: { name?: string }) => (dr.name ?? "").trim().toLowerCase()));
        const post = (education.meds ?? []).filter((m) => m.name.trim() && !named.has(m.name.trim().toLowerCase()))
          .map((m) => ({ name: m.name, dose: m.dose, eye: m.eye, frequency: m.frequency }));
        return [...chart, ...post];
      })(),
      education: [educationAdvice(education), firstWith((x) => (x as { adviseNotes?: string | null }).adviseNotes, (t) => !!String(t).trim())?.trim()].filter(Boolean).join("\n"),
      diet: education.meals.filter((m) => m.diet.trim()).map((m) => ({ time: m.meal, item: m.diet })),
      followUpDate: (firstWith((x) => (x as { followUpDate?: unknown }).followUpDate, (t) => !!t) as Date | string | null) ?? v.followUpDate,
      ot: (() => {
        const row = a.forms.find((f) => f.key === "otFinal") ?? a.forms.find((f) => f.key === "otNotes");
        const x = row ? parse(row.data) : null;
        return x && x.v === 2 ? { surgeon: x.surgeon, anaesthesia: x.anaesthesia, eye: x.eye, implant: x.implant, procedure: x.procedure, complications: x.complications } : null;
      })(),
    }),
  };

  const data: FileData = {
    id: a.id,
    visitId: v.id,
    // As in the EMR: a closed visit stays editable until midnight (IST) of the day it was finalized
    visitOpen: v.status !== "CLOSED" || (!!v.finalizedAt && istTodayStr(v.finalizedAt) === istTodayStr()),
    udid,
    returnTo: returnTo && returnTo.startsWith("/") ? returnTo : `/patients/${udid}?source=ipd&returnTo=${encodeURIComponent("/ipd")}`,
    patient: { name: v.patient.name, age: v.patient.age, sex: v.patient.sex, id: v.patient.uhid ?? udid, mobile: v.patient.mobile, photoUrl: v.patient.photoUrl },
    doctor: v.doctor.name,
    hospital: v.hospital.name,
    letterhead: {
      hospital: v.hospital.name, address: v.hospital.address, contact: v.hospital.contact, logoUrl: v.hospital.logoUrl,
      doctor: v.doctor.name, qualifications: v.doctor.qualifications, regNo: v.doctor.medicalRegNumber,
    },
    complaint: v.generalExam?.chiefComplaint ?? null,
    diagnoses: v.diagnoses,
    type: a.admissionType,
    typeOther: a.admissionTypeOther,
    reason: a.admissionReason,
    surgery: a.surgery,
    laterality: a.laterality,
    implant: a.implant,
    anaesthesia: a.anaesthesia,
    surgeryDate: a.surgeryDate?.toISOString() ?? null,
    admittedOn: a.admittedOn.toISOString(),
    expectedDischarge: a.expectedDischarge?.toISOString() ?? null,
    ward: a.ward,
    wardType: a.wardType,
    floor: a.floor,
    fileNo: a.fileNo,
    status: a.status,
    fileTabs: a.fileTabs,
    tabColours,
    counsellingVisitId: a.counsellingVisitId,
    fileCreated: !!a.fileCreatedAt,
    visitDate: v.date.toISOString(),
    counsellingSheet,
    shiftedToOtAt: a.shiftedToOtAt?.toISOString() ?? null,
    returnedFromOtAt: a.returnedFromOtAt?.toISOString() ?? null,
    dischargedAt: a.dischargedAt?.toISOString() ?? null,
    dischargedBy: a.dischargedBy,
    dischargeNotes: a.dischargeNotes,
    payment: counselling
      ? {
          type: counselling.paymentType, mode: counselling.paymentMode, scheme: counselling.schemeName, policy: counselling.policyNumber,
          eligibleBy: counselling.eligibleByName, eligibleAt: counselling.confirmedAt?.toISOString() ?? null,
        }
      : null,
    drugAllergy,
    forms: a.forms.map((f) => ({
      key: f.key,
      title: f.title,
      // The discharge allergy follows the EMR / Counselling until the patient is discharged
      data: f.key === "discharge" && a.status !== "DISCHARGED" ? { ...parse(f.data), allergies: allergyLine(drugAllergy) } : parse(f.data),
      attachments: (() => { const x = parse(f.attachments); return Array.isArray(x) ? x : []; })(),
      frozen: f.frozen,
      frozenAt: f.frozenAt?.toISOString() ?? null,
      frozenBy: f.frozenBy,
    })),
    defaults,
    orders: orders.map((o) => ({
      id: o.id, testName: o.testName, laterality: o.laterality, notes: o.notes, resultRef: o.resultRef,
      resultAt: o.resultRef ? (o.resultAt ?? o.updatedAt).toISOString() : null, createdAt: o.createdAt.toISOString(),
      extraResultRefs: o.extraResultRefs, priority: o.priority, doctorNotes: o.doctorNotes, status: o.status,
    })),
    doctorNotes: a.doctorNotes.map((n) => ({ id: n.id, text: n.text, by: n.byName, at: n.createdAt.toISOString(), editedAt: n.editedAt?.toISOString() ?? null, data: n.data ? parse(n.data) : null })),
    activity,
    me: user.name,
    templates,
    ctx,
    postOpMeds: (education.meds ?? []).filter((m) => m.name.trim()).map((m) => [m.name.trim(), m.dose, m.eye, m.frequency].filter(Boolean).join(" ")),
    emrMeds: v.medications.map((m) => ({ name: m.drugName, dose: m.dosage ?? "", frequency: m.frequency ?? "", route: m.route ?? "", eye: m.laterality ?? "", instructions: m.instructions ?? "" })),
  };

  return data;
}
