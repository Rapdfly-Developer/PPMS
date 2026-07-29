-- CreateTable
CREATE TABLE "InsuranceCompany" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "tpaName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientInsurance" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "insuranceCompanyId" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "cardNumber" TEXT,
    "coveragePercent" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "cardImageUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientInsurance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsurancePreAuthorization" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "admissionId" TEXT,
    "patientInsuranceId" TEXT NOT NULL,
    "insuranceCompanyId" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "plannedSurgery" TEXT,
    "estimatedCost" DOUBLE PRECISION NOT NULL,
    "requestedAmount" DOUBLE PRECISION NOT NULL,
    "approvedAmount" DOUBLE PRECISION,
    "authCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsurancePreAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceClaim" (
    "id" TEXT NOT NULL,
    "claimNumber" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientInsuranceId" TEXT NOT NULL,
    "insuranceCompanyId" TEXT NOT NULL,
    "preAuthId" TEXT,
    "admissionId" TEXT,
    "roomCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "surgeryCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pharmacyCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "labCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "miscCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalBillAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "approvedAmount" DOUBLE PRECISION,
    "patientResponsibility" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceClaimDocument" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsuranceClaimDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceSettlement" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "settledAmount" DOUBLE PRECISION NOT NULL,
    "settledDate" TIMESTAMP(3) NOT NULL,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsuranceSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsurancePayment" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "settlementId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentMode" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    "referenceNumber" TEXT,
    "notes" TEXT,
    "postedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsurancePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceQuery" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "queryBy" TEXT NOT NULL DEFAULT 'INSURER',
    "queryText" TEXT NOT NULL,
    "responseText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "InsuranceQuery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InsuranceCompany_hospitalId_active_idx" ON "InsuranceCompany"("hospitalId", "active");

-- CreateIndex
CREATE INDEX "PatientInsurance_hospitalId_patientId_idx" ON "PatientInsurance"("hospitalId", "patientId");

-- CreateIndex
CREATE INDEX "PatientInsurance_status_idx" ON "PatientInsurance"("status");

-- CreateIndex
CREATE INDEX "InsurancePreAuthorization_hospitalId_status_idx" ON "InsurancePreAuthorization"("hospitalId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceClaim_claimNumber_key" ON "InsuranceClaim"("claimNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceClaim_preAuthId_key" ON "InsuranceClaim"("preAuthId");

-- CreateIndex
CREATE INDEX "InsuranceClaim_hospitalId_status_idx" ON "InsuranceClaim"("hospitalId", "status");

-- CreateIndex
CREATE INDEX "InsuranceClaim_claimNumber_idx" ON "InsuranceClaim"("claimNumber");

-- CreateIndex
CREATE INDEX "InsuranceClaimDocument_claimId_idx" ON "InsuranceClaimDocument"("claimId");

-- CreateIndex
CREATE INDEX "InsuranceSettlement_claimId_idx" ON "InsuranceSettlement"("claimId");

-- CreateIndex
CREATE INDEX "InsurancePayment_claimId_idx" ON "InsurancePayment"("claimId");

-- CreateIndex
CREATE INDEX "InsuranceQuery_claimId_status_idx" ON "InsuranceQuery"("claimId", "status");

-- AddForeignKey
ALTER TABLE "InsuranceCompany" ADD CONSTRAINT "InsuranceCompany_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientInsurance" ADD CONSTRAINT "PatientInsurance_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientInsurance" ADD CONSTRAINT "PatientInsurance_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientInsurance" ADD CONSTRAINT "PatientInsurance_insuranceCompanyId_fkey" FOREIGN KEY ("insuranceCompanyId") REFERENCES "InsuranceCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsurancePreAuthorization" ADD CONSTRAINT "InsurancePreAuthorization_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsurancePreAuthorization" ADD CONSTRAINT "InsurancePreAuthorization_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsurancePreAuthorization" ADD CONSTRAINT "InsurancePreAuthorization_patientInsuranceId_fkey" FOREIGN KEY ("patientInsuranceId") REFERENCES "PatientInsurance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsurancePreAuthorization" ADD CONSTRAINT "InsurancePreAuthorization_insuranceCompanyId_fkey" FOREIGN KEY ("insuranceCompanyId") REFERENCES "InsuranceCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_patientInsuranceId_fkey" FOREIGN KEY ("patientInsuranceId") REFERENCES "PatientInsurance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_insuranceCompanyId_fkey" FOREIGN KEY ("insuranceCompanyId") REFERENCES "InsuranceCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_preAuthId_fkey" FOREIGN KEY ("preAuthId") REFERENCES "InsurancePreAuthorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaimDocument" ADD CONSTRAINT "InsuranceClaimDocument_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "InsuranceClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceSettlement" ADD CONSTRAINT "InsuranceSettlement_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "InsuranceClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsurancePayment" ADD CONSTRAINT "InsurancePayment_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "InsuranceClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsurancePayment" ADD CONSTRAINT "InsurancePayment_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "InsuranceSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceQuery" ADD CONSTRAINT "InsuranceQuery_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "InsuranceClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

