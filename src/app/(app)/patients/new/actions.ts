"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { generateUDID, generateUHID } from "@/lib/udid";
import { encryptAadhaar } from "@/lib/crypto";
import { redirect } from "next/navigation";
import { writeAudit } from "@/lib/audit";

export type RegisterPatientState = { error?: string };

export async function registerPatientAction(_prev: RegisterPatientState, formData: FormData): Promise<RegisterPatientState> {
  const user = await requireRole("DOCTOR", "HOSPITAL");

  const name = (formData.get("name") as string).trim();
  const age = parseInt(formData.get("age") as string, 10);
  const sex = formData.get("sex") as string;
  const mobile = (formData.get("mobile") as string).trim();
  const aadhaar = (formData.get("aadhaar") as string).replace(/\s/g, "");
  const address = (formData.get("address") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim() || null;
  const state = (formData.get("state") as string)?.trim() || null;
  const pincode = (formData.get("pincode") as string)?.trim() || null;
  const category = (formData.get("category") as string) || "GENERAL";
  const complaint = (formData.get("complaint") as string)?.trim() || null;
  const hospitalId = (formData.get("hospitalId") as string) || null;

  if (!name || isNaN(age) || !sex || !mobile || !aadhaar) {
    return { error: "Please fill in all mandatory fields." };
  }
  if (!/^\d{10}$/.test(mobile)) {
    return { error: "Mobile number must be exactly 10 digits." };
  }
  if (!/^\d{12}$/.test(aadhaar)) {
    return { error: "Aadhaar number must be 12 digits." };
  }
  if (pincode && !/^\d{6}$/.test(pincode)) {
    return { error: "Pincode must be exactly 6 digits." };
  }

  let doctorId: string | null = null;
  let resolvedHospitalId: string | null = hospitalId;
  let doctorShortCode: string | null = null;
  let hospitalShortCode: string | null = null;

  if (user.role === "DOCTOR") {
    const doctor = await prisma.doctor.findUnique({ where: { userId: user.id }, select: { id: true, shortCode: true } });
    if (!doctor) return { error: "Session expired. Please sign out and sign back in." };
    doctorId = doctor.id;
    doctorShortCode = doctor.shortCode ?? null;
  } else if (user.role === "HOSPITAL") {
    const staff = await prisma.hospitalStaff.findUnique({
      where: { userId: user.id },
      select: { hospitalId: true, hospital: { select: { shortCode: true, doctorLinks: { select: { doctorId: true, doctor: { select: { shortCode: true } } }, take: 1 } } } },
    });
    if (!staff) return { error: "Session expired. Please sign out and sign back in." };
    resolvedHospitalId = hospitalId ?? staff.hospitalId;
    hospitalShortCode = staff.hospital?.shortCode ?? null;
    const link = staff.hospital?.doctorLinks[0];
    doctorId = link?.doctorId ?? null;
    doctorShortCode = link?.doctor?.shortCode ?? null;
  }

  const registeredAtId = resolvedHospitalId ?? undefined;

  // UHID uses hospital short code
  if (!hospitalShortCode && registeredAtId) {
    const hospital = await prisma.hospital.findUnique({ where: { id: registeredAtId }, select: { shortCode: true } });
    hospitalShortCode = hospital?.shortCode ?? null;
  }

  // UDID uses doctor short code; falls back to hospital code, then GEN
  const udidCode = doctorShortCode ?? hospitalShortCode ?? "GEN";
  const uhidCode = hospitalShortCode ?? doctorShortCode ?? "GEN";

  const [udid, uhid] = await Promise.all([
    generateUDID(udidCode),
    generateUHID(uhidCode),
  ]);

  const patient = await prisma.patient.create({
    data: {
      udid,
      uhid,
      doctorId,
      registeredAtId,
      name,
      age,
      sex,
      mobile,
      aadhaarEncrypted: encryptAadhaar(aadhaar),
      category,
      address,
      city,
      state,
      pincode,
      complaint,
    },
  });

  // Save uploaded prior external visit documents
  const savedFiles = formData.getAll("pastVisitFiles[]") as string[];
  if (savedFiles.length > 0) {
    await prisma.pastExternalVisit.createMany({
      data: savedFiles.map((savedName) => ({
        patientId: patient.id,
        scanFileRef: savedName,
        verificationStatus: "PENDING_REVIEW",
      })),
    });
  }

  writeAudit(user.id, "Patient", patient.id, "CREATE", { name, age, sex, udid: patient.udid, uhid: patient.uhid }, {
    moduleName: "Patient", actionType: "CREATE",
    hospitalId: resolvedHospitalId ?? undefined,
    userName: name,
  });

  redirect(`/patients/registered/${patient.udid}`);
}
