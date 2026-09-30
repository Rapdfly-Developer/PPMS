-- AddColumn: referral fields on Patient (idempotent — safe to apply even if columns already exist)
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "referredBy" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "referralPatientId" TEXT;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "referralRelationship" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Patient_referralPatientId_fkey'
  ) THEN
    ALTER TABLE "Patient" ADD CONSTRAINT "Patient_referralPatientId_fkey"
      FOREIGN KEY ("referralPatientId") REFERENCES "Patient"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Patient_referralPatientId_idx" ON "Patient"("referralPatientId");
