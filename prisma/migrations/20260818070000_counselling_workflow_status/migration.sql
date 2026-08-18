ALTER TABLE "CounsellingRecord"
  ADD COLUMN IF NOT EXISTS "status"              TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "submittedAt"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "doctorDecision"      TEXT,
  ADD COLUMN IF NOT EXISTS "doctorDecisionNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "doctorReviewedAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "confirmedAt"         TIMESTAMP(3);
