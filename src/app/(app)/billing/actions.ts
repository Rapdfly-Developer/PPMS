"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";

// ── Insurance Companies ────────────────────────────────────────────────────

export async function createInsuranceCompany(fd: FormData) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  const hospitalId = fd.get("hospitalId") as string;

  const company = await prisma.insuranceCompany.create({
    data: {
      hospitalId,
      name:          fd.get("name") as string,
      contactPerson: (fd.get("contactPerson") as string) || null,
      email:         (fd.get("email") as string) || null,
      phone:         (fd.get("phone") as string) || null,
      address:       (fd.get("address") as string) || null,
      tpaName:       (fd.get("tpaName") as string) || null,
    },
  });
  await writeAudit(user.id, "InsuranceCompany", company.id, "CREATE");
  revalidatePath("/billing/insurance-companies");
  return {};
}

export async function updateInsuranceCompany(id: string, fd: FormData) {
  const user = await requireRole("DOCTOR", "HOSPITAL");

  await prisma.insuranceCompany.update({
    where: { id },
    data: {
      name:          fd.get("name") as string,
      contactPerson: (fd.get("contactPerson") as string) || null,
      email:         (fd.get("email") as string) || null,
      phone:         (fd.get("phone") as string) || null,
      address:       (fd.get("address") as string) || null,
      tpaName:       (fd.get("tpaName") as string) || null,
    },
  });
  await writeAudit(user.id, "InsuranceCompany", id, "UPDATE");
  revalidatePath("/billing/insurance-companies");
  return {};
}

export async function toggleInsuranceCompany(id: string, active: boolean) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  await prisma.insuranceCompany.update({ where: { id }, data: { active } });
  await writeAudit(user.id, "InsuranceCompany", id, active ? "ACTIVATE" : "DEACTIVATE");
  revalidatePath("/billing/insurance-companies");
  return {};
}

// ── Patient Insurance ──────────────────────────────────────────────────────

export async function createPatientInsurance(fd: FormData) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  const hospitalId = fd.get("hospitalId") as string;

  const policy = await prisma.patientInsurance.create({
    data: {
      hospitalId,
      patientId:          fd.get("patientId") as string,
      insuranceCompanyId: fd.get("insuranceCompanyId") as string,
      policyNumber:       fd.get("policyNumber") as string,
      cardNumber:         (fd.get("cardNumber") as string) || null,
      coveragePercent:    parseFloat((fd.get("coveragePercent") as string) || "80"),
      validFrom:          new Date(fd.get("validFrom") as string),
      validTo:            new Date(fd.get("validTo") as string),
      status:             (fd.get("status") as string) || "ACTIVE",
      notes:              (fd.get("notes") as string) || null,
    },
  });
  await writeAudit(user.id, "PatientInsurance", policy.id, "CREATE");
  revalidatePath("/billing/patient-insurance");
  return {};
}

export async function updatePatientInsurance(id: string, fd: FormData) {
  const user = await requireRole("DOCTOR", "HOSPITAL");

  await prisma.patientInsurance.update({
    where: { id },
    data: {
      insuranceCompanyId: fd.get("insuranceCompanyId") as string,
      policyNumber:       fd.get("policyNumber") as string,
      cardNumber:         (fd.get("cardNumber") as string) || null,
      coveragePercent:    parseFloat((fd.get("coveragePercent") as string) || "80"),
      validFrom:          new Date(fd.get("validFrom") as string),
      validTo:            new Date(fd.get("validTo") as string),
      status:             (fd.get("status") as string) || "ACTIVE",
      notes:              (fd.get("notes") as string) || null,
    },
  });
  await writeAudit(user.id, "PatientInsurance", id, "UPDATE");
  revalidatePath("/billing/patient-insurance");
  return {};
}

// ── Pre-Authorization ──────────────────────────────────────────────────────

export async function createPreAuth(fd: FormData) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  const hospitalId = fd.get("hospitalId") as string;

  const preAuth = await prisma.insurancePreAuthorization.create({
    data: {
      hospitalId,
      admissionId:        (fd.get("admissionId") as string) || null,
      patientInsuranceId: fd.get("patientInsuranceId") as string,
      insuranceCompanyId: fd.get("insuranceCompanyId") as string,
      diagnosis:          fd.get("diagnosis") as string,
      plannedSurgery:     (fd.get("plannedSurgery") as string) || null,
      estimatedCost:      parseFloat(fd.get("estimatedCost") as string),
      requestedAmount:    parseFloat(fd.get("requestedAmount") as string),
      notes:              (fd.get("notes") as string) || null,
    },
  });
  await writeAudit(user.id, "InsurancePreAuthorization", preAuth.id, "CREATE");
  revalidatePath("/billing/pre-auth");
  return {};
}

export async function updatePreAuthStatus(
  id: string,
  status: string,
  data?: { approvedAmount?: number; authCode?: string; notes?: string },
) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  await prisma.insurancePreAuthorization.update({
    where: { id },
    data: {
      status,
      approvedAmount: data?.approvedAmount ?? undefined,
      authCode:       data?.authCode ?? undefined,
      notes:          data?.notes ?? undefined,
      submittedAt:    status === "PENDING" ? new Date() : undefined,
      respondedAt:    ["APPROVED", "REJECTED", "QUERY_RAISED"].includes(status) ? new Date() : undefined,
    },
  });
  await writeAudit(user.id, "InsurancePreAuthorization", id, `STATUS_${status}`);
  revalidatePath("/billing/pre-auth");
  return {};
}

// ── Insurance Claims ───────────────────────────────────────────────────────

function generateClaimNumber() {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `CLM-${date}-${rand}`;
}

export async function createClaim(fd: FormData) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  const hospitalId = fd.get("hospitalId") as string;

  const roomCharges     = parseFloat((fd.get("roomCharges") as string) || "0");
  const surgeryCharges  = parseFloat((fd.get("surgeryCharges") as string) || "0");
  const pharmacyCharges = parseFloat((fd.get("pharmacyCharges") as string) || "0");
  const labCharges      = parseFloat((fd.get("labCharges") as string) || "0");
  const miscCharges     = parseFloat((fd.get("miscCharges") as string) || "0");
  const totalBillAmount = roomCharges + surgeryCharges + pharmacyCharges + labCharges + miscCharges;

  const claim = await prisma.insuranceClaim.create({
    data: {
      claimNumber:       generateClaimNumber(),
      hospitalId,
      patientInsuranceId: fd.get("patientInsuranceId") as string,
      insuranceCompanyId: fd.get("insuranceCompanyId") as string,
      preAuthId:          (fd.get("preAuthId") as string) || null,
      admissionId:        (fd.get("admissionId") as string) || null,
      roomCharges,
      surgeryCharges,
      pharmacyCharges,
      labCharges,
      miscCharges,
      totalBillAmount,
    },
  });
  await writeAudit(user.id, "InsuranceClaim", claim.id, "CREATE");
  revalidatePath("/billing/claims");
  return { id: claim.id };
}

export async function updateClaimBill(id: string, fd: FormData) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  const roomCharges     = parseFloat((fd.get("roomCharges") as string) || "0");
  const surgeryCharges  = parseFloat((fd.get("surgeryCharges") as string) || "0");
  const pharmacyCharges = parseFloat((fd.get("pharmacyCharges") as string) || "0");
  const labCharges      = parseFloat((fd.get("labCharges") as string) || "0");
  const miscCharges     = parseFloat((fd.get("miscCharges") as string) || "0");
  const totalBillAmount = roomCharges + surgeryCharges + pharmacyCharges + labCharges + miscCharges;

  await prisma.insuranceClaim.update({
    where: { id },
    data: { roomCharges, surgeryCharges, pharmacyCharges, labCharges, miscCharges, totalBillAmount },
  });
  await writeAudit(user.id, "InsuranceClaim", id, "UPDATE_BILL");
  revalidatePath("/billing/claims");
  return {};
}

export async function advanceClaimStatus(id: string, status: string) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  const extra: any = {};
  if (status === "CLAIM_SUBMITTED") extra.submittedAt = new Date();
  if (status === "APPROVED")        extra.approvedAt  = new Date();
  if (status === "CLOSED")          extra.closedAt    = new Date();

  await prisma.insuranceClaim.update({ where: { id }, data: { status, ...extra } });
  await writeAudit(user.id, "InsuranceClaim", id, `STATUS_${status}`);
  revalidatePath("/billing/claims");
  return {};
}

export async function setClaimApproval(id: string, approvedAmount: number) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  const claim = await prisma.insuranceClaim.findUnique({ where: { id } });
  if (!claim) return { error: "Claim not found" };
  const patientResponsibility = Math.max(0, claim.totalBillAmount - approvedAmount);

  await prisma.insuranceClaim.update({
    where: { id },
    data: { approvedAmount, patientResponsibility, status: "APPROVED", approvedAt: new Date() },
  });
  await writeAudit(user.id, "InsuranceClaim", id, "APPROVED");
  revalidatePath("/billing/claims");
  return {};
}

// ── Documents ──────────────────────────────────────────────────────────────

export async function addClaimDocument(fd: FormData) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  const claimId = fd.get("claimId") as string;

  await prisma.insuranceClaimDocument.create({
    data: {
      claimId,
      docType:    fd.get("docType") as string,
      fileName:   fd.get("fileName") as string,
      fileUrl:    fd.get("fileUrl") as string,
      uploadedBy: user.id,
    },
  });

  // Advance status if still at CREATED
  const claim = await prisma.insuranceClaim.findUnique({ where: { id: claimId } });
  if (claim?.status === "CREATED") {
    await prisma.insuranceClaim.update({ where: { id: claimId }, data: { status: "DOCUMENTS_UPLOADED" } });
  }

  await writeAudit(user.id, "InsuranceClaimDocument", claimId, "UPLOAD");
  revalidatePath("/billing/claims");
  return {};
}

export async function deleteClaimDocument(docId: string) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  const doc = await prisma.insuranceClaimDocument.findUnique({ where: { id: docId } });
  if (!doc) return { error: "Document not found" };
  await prisma.insuranceClaimDocument.delete({ where: { id: docId } });
  await writeAudit(user.id, "InsuranceClaimDocument", docId, "DELETE");
  revalidatePath("/billing/claims");
  return {};
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function raiseQuery(fd: FormData) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  const claimId = fd.get("claimId") as string;

  await prisma.insuranceQuery.create({
    data: {
      claimId,
      queryBy:   fd.get("queryBy") as string,
      queryText: fd.get("queryText") as string,
    },
  });
  await prisma.insuranceClaim.update({ where: { id: claimId }, data: { status: "QUERY_RAISED" } });
  await writeAudit(user.id, "InsuranceQuery", claimId, "QUERY_RAISED");
  revalidatePath("/billing/claims");
  revalidatePath("/billing/queries");
  return {};
}

export async function respondToQuery(queryId: string, responseText: string) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  await prisma.insuranceQuery.update({
    where: { id: queryId },
    data: { responseText, status: "RESPONDED", respondedAt: new Date() },
  });
  await writeAudit(user.id, "InsuranceQuery", queryId, "RESPONDED");
  revalidatePath("/billing/queries");
  revalidatePath("/billing/claims");
  return {};
}

export async function closeQuery(queryId: string) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  await prisma.insuranceQuery.update({ where: { id: queryId }, data: { status: "CLOSED" } });
  await writeAudit(user.id, "InsuranceQuery", queryId, "CLOSED");
  revalidatePath("/billing/queries");
  return {};
}

// ── Settlement ─────────────────────────────────────────────────────────────

export async function recordSettlement(fd: FormData) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  const claimId = fd.get("claimId") as string;

  const settlement = await prisma.insuranceSettlement.create({
    data: {
      claimId,
      settledAmount:   parseFloat(fd.get("settledAmount") as string),
      settledDate:     new Date(fd.get("settledDate") as string),
      referenceNumber: (fd.get("referenceNumber") as string) || null,
      notes:           (fd.get("notes") as string) || null,
    },
  });

  // Record payment
  await prisma.insurancePayment.create({
    data: {
      claimId,
      settlementId:    settlement.id,
      amount:          parseFloat(fd.get("settledAmount") as string),
      paymentDate:     new Date(fd.get("settledDate") as string),
      paymentMode:     (fd.get("paymentMode") as string) || "BANK_TRANSFER",
      referenceNumber: (fd.get("referenceNumber") as string) || null,
      notes:           (fd.get("notes") as string) || null,
      postedBy:        user.id,
    },
  });

  // Update claim status to PAYMENT_RECEIVED
  await prisma.insuranceClaim.update({
    where: { id: claimId },
    data: { status: "PAYMENT_RECEIVED" },
  });

  await writeAudit(user.id, "InsuranceSettlement", claimId, "SETTLEMENT_RECORDED");
  revalidatePath("/billing/settlement");
  revalidatePath("/billing/claims");
  return {};
}

export async function closeClaim(id: string) {
  const user = await requireRole("DOCTOR", "HOSPITAL");
  await prisma.insuranceClaim.update({
    where: { id },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  await writeAudit(user.id, "InsuranceClaim", id, "CLOSED");
  revalidatePath("/billing/claims");
  revalidatePath("/billing/settlement");
  return {};
}
