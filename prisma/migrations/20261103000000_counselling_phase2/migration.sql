-- Phase 2 Counselling module
ALTER TABLE "CounsellingRecord" ADD COLUMN IF NOT EXISTS "implant" TEXT;
ALTER TABLE "CounsellingRecord" ADD COLUMN IF NOT EXISTS "advanceReceived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CounsellingRecord" ADD COLUMN IF NOT EXISTS "postponedUntil" TIMESTAMP(3);
ALTER TABLE "CounsellingRecord" ADD COLUMN IF NOT EXISTS "postponedIndefinitely" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CounsellingRecord" ADD COLUMN IF NOT EXISTS "postponedAt" TIMESTAMP(3);
ALTER TABLE "CounsellingRecord" ADD COLUMN IF NOT EXISTS "reportsValidUntil" TIMESTAMP(3);
ALTER TABLE "CounsellingRecord" ADD COLUMN IF NOT EXISTS "fitByName" TEXT;
ALTER TABLE "CounsellingRecord" ADD COLUMN IF NOT EXISTS "eligibleByName" TEXT;
ALTER TABLE "CounsellingRecord" ADD COLUMN IF NOT EXISTS "preOpAppointmentId" TEXT;

-- Upload time of investigation results (report expiry is counted from the oldest one)
ALTER TABLE "InvestigationOrder" ADD COLUMN IF NOT EXISTS "resultAt" TIMESTAMP(3);
UPDATE "InvestigationOrder" SET "resultAt" = "updatedAt" WHERE "resultRef" IS NOT NULL AND "resultAt" IS NULL;

-- Surgical Counselling tab (EMR Patient Disposition)
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "advisedSurgeryAnaesthesia" TEXT;
