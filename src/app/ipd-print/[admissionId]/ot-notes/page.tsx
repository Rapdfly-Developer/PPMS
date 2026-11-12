import { notFound } from "next/navigation";
import { requireUser, userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { visitRecordScope } from "@/lib/patient-access";
import { isOtNotesCopy } from "@/lib/ot";
import { OtNotesDocument } from "../../../(app)/ipd/[admissionId]/OtNotesDocument";
import { PrintBar } from "../PrintBar";

export const metadata = { title: "OT Notes" };

/** Printable OT notes (the copy in the patient file), outside the app shell so only the document prints. */
export default async function OtNotesPrintPage({ params, searchParams }: { params: Promise<{ admissionId: string }>; searchParams: Promise<{ print?: string }> }) {
  const { admissionId } = await params;
  const { print } = await searchParams;
  const user = await requireUser();
  if (!userCan(user, "ot.view") && !userCan(user, "ipd.view")) notFound();
  const scope = await visitRecordScope(user);
  if (!scope) notFound();

  const a = await prisma.ipdAdmission.findFirst({
    where: { id: admissionId, visit: { ...scope, finalizedAt: { not: null } } },
    include: {
      forms: { where: { key: "otFinal" } },
      otCase: { select: { otNotes: true, otNotesSavedBy: true, otNotesSavedAt: true } },
      visit: {
        select: {
          hospital: { select: { name: true, address: true, contact: true, logoUrl: true, email: true } },
          doctor: { select: { name: true, qualifications: true, medicalRegNumber: true, specialty: true } },
          patient: { select: { id: true, name: true, udid: true, uhid: true, age: true, sex: true, mobile: true } },
        },
      },
    },
  });
  if (!a) notFound();

  const parse = (s: string | null | undefined) => { if (!s) return null; try { return JSON.parse(s); } catch { return null; } };
  const form = a.forms[0];
  const notes = parse(form?.data) ?? parse(a.otCase?.otNotes);
  const v = a.visit;

  if (!isOtNotesCopy(notes)) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <p className="text-sm text-gray-600">Save the OT notes in the OT module first, then print them.</p>
      </main>
    );
  }

  const savedBy = form?.frozenBy ?? a.otCase?.otNotesSavedBy ?? null;
  const savedAt = form?.frozenAt ?? a.otCase?.otNotesSavedAt ?? null;

  return (
    <main className="min-h-screen bg-gray-100 print:bg-white">
      <style>{"@page { size: A4; margin: 10mm 0; }"}</style>
      <PrintBar autoPrint={print !== "0"} title="OT notes" />
      <div className="py-6 print:py-0">
        <div className="mx-auto w-fit shadow-sm print:shadow-none">
          <OtNotesDocument
            n={notes}
            h={{
              hospital: v.hospital.name, address: v.hospital.address, contact: v.hospital.contact, logoUrl: v.hospital.logoUrl, email: v.hospital.email,
              doctor: v.doctor.name, qualifications: v.doctor.qualifications, regNo: v.doctor.medicalRegNumber, specialty: v.doctor.specialty || null,
              patient: { name: v.patient.name, age: v.patient.age, sex: v.patient.sex, id: v.patient.uhid ?? v.patient.udid ?? v.patient.id, mobile: v.patient.mobile },
              fileNo: a.fileNo, ward: a.ward, wardType: a.wardType, floor: a.floor,
              admittedOn: a.admittedOn.toISOString(),
              saved: savedBy && savedAt ? { by: savedBy, at: savedAt.toISOString() } : null,
            }}
          />
        </div>
      </div>
    </main>
  );
}
