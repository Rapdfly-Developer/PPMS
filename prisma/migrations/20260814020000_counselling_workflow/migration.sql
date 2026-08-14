-- Surgical Counselling Workflow — additive layer.
-- Creates three new tables only. No existing table is altered, so every
-- existing surgery record and screen continues to behave exactly as before.

-- CreateTable
CREATE TABLE "RolePermissionSeed" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "seededAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermissionSeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RolePermissionSeed_role_permissionKey_key" ON "RolePermissionSeed"("role", "permissionKey");

-- CreateTable
CREATE TABLE "CounsellingWorkflow" (
    "id" TEXT NOT NULL,
    "surgicalCounsellingId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'PENDING_COUNSELING',
    "eyeLaterality" TEXT,
    "diagnosisText" TEXT,
    "procedureExplanation" TEXT,
    "benefits" TEXT,
    "risks" TEXT,
    "recoveryInfo" TEXT,
    "patientQuestions" TEXT,
    "estimatedCost" DOUBLE PRECISION,
    "paymentMode" TEXT,
    "insuranceApproval" TEXT,
    "packageStatus" TEXT,
    "requiredInvestigations" TEXT,
    "investigationStatus" TEXT,
    "consentStatus" TEXT,
    "counsellingNotes" TEXT,
    "counselledBy" TEXT,
    "counselledByName" TEXT,
    "counselledAt" TIMESTAMP(3),
    "decision" TEXT,
    "decisionReason" TEXT,
    "decisionInvestigations" TEXT,
    "decidedBy" TEXT,
    "decidedByName" TEXT,
    "decidedAt" TIMESTAMP(3),
    "confirmedSections" TEXT,
    "confirmationNotes" TEXT,
    "patientReady" BOOLEAN NOT NULL DEFAULT false,
    "consentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedBy" TEXT,
    "confirmedByName" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CounsellingWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CounsellingVersion" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedByName" TEXT,
    "snapshot" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CounsellingVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtSlotRequest" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "surgeryScheduleId" TEXT,
    "hospitalId" TEXT NOT NULL,
    "otRoom" TEXT,
    "requestedDate" TIMESTAMP(3) NOT NULL,
    "timeSlot" TEXT,
    "doctorId" TEXT NOT NULL,
    "surgeryName" TEXT NOT NULL,
    "equipment" TEXT,
    "staff" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "doctorNote" TEXT,
    "suggestedDateTime" TIMESTAMP(3),
    "respondedBy" TEXT,
    "respondedAt" TIMESTAMP(3),
    "requestedBy" TEXT NOT NULL,
    "requestedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtSlotRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CounsellingWorkflow_surgicalCounsellingId_key" ON "CounsellingWorkflow"("surgicalCounsellingId");

-- CreateIndex
CREATE INDEX "CounsellingWorkflow_stage_idx" ON "CounsellingWorkflow"("stage");

-- CreateIndex
CREATE INDEX "CounsellingVersion_workflowId_createdAt_idx" ON "CounsellingVersion"("workflowId", "createdAt");

-- CreateIndex
CREATE INDEX "OtSlotRequest_workflowId_idx" ON "OtSlotRequest"("workflowId");

-- CreateIndex
CREATE INDEX "OtSlotRequest_status_idx" ON "OtSlotRequest"("status");

-- CreateIndex
CREATE INDEX "OtSlotRequest_doctorId_status_idx" ON "OtSlotRequest"("doctorId", "status");

-- AddForeignKey
ALTER TABLE "CounsellingWorkflow" ADD CONSTRAINT "CounsellingWorkflow_surgicalCounsellingId_fkey" FOREIGN KEY ("surgicalCounsellingId") REFERENCES "SurgicalCounselling"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CounsellingVersion" ADD CONSTRAINT "CounsellingVersion_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "CounsellingWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtSlotRequest" ADD CONSTRAINT "OtSlotRequest_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "CounsellingWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
