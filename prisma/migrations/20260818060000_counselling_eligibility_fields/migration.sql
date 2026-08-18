ALTER TABLE "CounsellingRecord"
  ADD COLUMN IF NOT EXISTS "additionalInvestigations" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "investigationDetails"     TEXT,
  ADD COLUMN IF NOT EXISTS "surgeryDeferred"          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deferralReason"           TEXT,
  ADD COLUMN IF NOT EXISTS "deferralNotes"            TEXT;
