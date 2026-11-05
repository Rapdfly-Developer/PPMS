-- Phase 2 IPD module (new tables only; the legacy Admission tables stay removed)
CREATE TABLE IF NOT EXISTS "IpdAdmission" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "admissionType" TEXT NOT NULL,
    "admissionTypeOther" TEXT,
    "admittedOn" TIMESTAMP(3) NOT NULL,
    "expectedDischarge" TIMESTAMP(3),
    "ward" TEXT,
    "floor" TEXT,
    "fileNo" TEXT,
    "admittedByName" TEXT,
    "counsellingVisitId" TEXT,
    "surgery" TEXT,
    "laterality" TEXT,
    "implant" TEXT,
    "anaesthesia" TEXT,
    "surgeryDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ADMITTED',
    "shiftedToOtAt" TIMESTAMP(3),
    "shiftedToOtBy" TEXT,
    "returnedFromOtAt" TIMESTAMP(3),
    "dischargedAt" TIMESTAMP(3),
    "dischargedBy" TEXT,
    "dischargeNotes" TEXT,
    "dischargeOtp" TEXT,
    "dischargeOtpExpires" TIMESTAMP(3),
    CONSTRAINT "IpdAdmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IpdAdmission_visitId_key" ON "IpdAdmission"("visitId");
CREATE INDEX IF NOT EXISTS "IpdAdmission_patientId_idx" ON "IpdAdmission"("patientId");
CREATE INDEX IF NOT EXISTS "IpdAdmission_status_idx" ON "IpdAdmission"("status");
CREATE INDEX IF NOT EXISTS "IpdAdmission_admittedOn_idx" ON "IpdAdmission"("admittedOn");
ALTER TABLE "IpdAdmission" ADD CONSTRAINT "IpdAdmission_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "IpdForm" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT '{}',
    "attachments" TEXT NOT NULL DEFAULT '[]',
    "frozen" BOOLEAN NOT NULL DEFAULT false,
    "frozenAt" TIMESTAMP(3),
    "frozenBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IpdForm_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IpdForm_admissionId_key_key" ON "IpdForm"("admissionId", "key");
ALTER TABLE "IpdForm" ADD CONSTRAINT "IpdForm_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "IpdAdmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "IpdDoctorNote" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IpdDoctorNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IpdDoctorNote_admissionId_createdAt_idx" ON "IpdDoctorNote"("admissionId", "createdAt");
ALTER TABLE "IpdDoctorNote" ADD CONSTRAINT "IpdDoctorNote_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "IpdAdmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
