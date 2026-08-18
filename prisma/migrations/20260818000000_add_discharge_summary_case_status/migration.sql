-- Add dischargeCondition to Admission
ALTER TABLE "Admission" ADD COLUMN "dischargeCondition" TEXT;

-- Add caseStatus and caseClosedAt to SurgerySchedule
ALTER TABLE "SurgerySchedule" ADD COLUMN "caseStatus" TEXT;
ALTER TABLE "SurgerySchedule" ADD COLUMN "caseClosedAt" TIMESTAMP(3);

-- Create DischargeSummary table
CREATE TABLE "DischargeSummary" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "surgeryPerformed" TEXT,
    "operatingEye" TEXT,
    "anesthesiaUsed" TEXT,
    "iolDetails" TEXT,
    "postOpDiagnosis" TEXT,
    "intraopComplications" TEXT,
    "postOpCourse" TEXT,
    "conditionAtDischarge" TEXT NOT NULL DEFAULT 'STABLE',
    "dischargeMedications" TEXT,
    "dischargeInstructions" TEXT,
    "activityRestrictions" TEXT,
    "dietAdvice" TEXT,
    "woundCareInstructions" TEXT,
    "followUpDate" TIMESTAMP(3),
    "followUpInstructions" TEXT,
    "admissionDate" TIMESTAMP(3),
    "dischargeDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DischargeSummary_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on admissionId (one summary per admission)
CREATE UNIQUE INDEX "DischargeSummary_admissionId_key" ON "DischargeSummary"("admissionId");

-- Foreign keys
ALTER TABLE "DischargeSummary" ADD CONSTRAINT "DischargeSummary_admissionId_fkey"
    FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DischargeSummary" ADD CONSTRAINT "DischargeSummary_doctorId_fkey"
    FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
