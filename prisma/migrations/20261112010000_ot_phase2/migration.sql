-- Phase 2 OT schedule: one OT case per IPD admission
CREATE TABLE IF NOT EXISTS "OtCase" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "verified" TEXT NOT NULL DEFAULT '{}',
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "begunAt" TIMESTAMP(3),
    "begunBy" TEXT,
    "anaesthesiaAt" TIMESTAMP(3),
    "anaesthesiaBy" TEXT,
    "anaesthesiaDelayReason" TEXT,
    "endedAt" TIMESTAMP(3),
    "endedBy" TEXT,
    "abortedAt" TIMESTAMP(3),
    "abortedBy" TEXT,
    "abortReason" TEXT,
    "abortStep" TEXT,
    "outcomeSavedAt" TIMESTAMP(3),
    "eventful" BOOLEAN NOT NULL DEFAULT false,
    "eventReason" TEXT,
    "eventStep" TEXT,
    "intraOpManagement" TEXT,
    "postOpManagement" TEXT,
    "otNotesChoice" TEXT,
    "wardNotesChoice" TEXT,
    "otNotes" TEXT,
    "otNotesSavedAt" TIMESTAMP(3),
    "otNotesSavedBy" TEXT,
    "shiftedToWardAt" TIMESTAMP(3),
    "shiftedToWardBy" TEXT,
    "shiftDelayReason" TEXT,
    "dischargedFromOt" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OtCase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OtCase_admissionId_key" ON "OtCase"("admissionId");
CREATE INDEX IF NOT EXISTS "OtCase_sequence_idx" ON "OtCase"("sequence");
DO $$ BEGIN
  ALTER TABLE "OtCase" ADD CONSTRAINT "OtCase_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "IpdAdmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
