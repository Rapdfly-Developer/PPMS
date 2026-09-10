-- DPDP Act 2023: PatientConsent and DataRightsRequest tables
-- Written idempotently because db push already applied the schema;
-- migrate deploy runs this SQL and must not fail on a clean prod DB.

CREATE TABLE IF NOT EXISTS "PatientConsent" (
    "id"          TEXT NOT NULL,
    "patientId"   TEXT NOT NULL,
    "purpose"     TEXT NOT NULL DEFAULT 'TREATMENT',
    "method"      TEXT NOT NULL DEFAULT 'ELECTRONIC',
    "status"      TEXT NOT NULL DEFAULT 'GRANTED',
    "noticeText"  TEXT,
    "capturedBy"  TEXT,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatientConsent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DataRightsRequest" (
    "id"          TEXT NOT NULL,
    "patientId"   TEXT NOT NULL,
    "type"        TEXT NOT NULL,
    "description" TEXT,
    "status"      TEXT NOT NULL DEFAULT 'PENDING',
    "resolution"  TEXT,
    "resolvedBy"  TEXT,
    "resolvedAt"  TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DataRightsRequest_pkey" PRIMARY KEY ("id")
);

-- Add FK constraints only if they don't already exist (idempotent)
DO $$ BEGIN
  ALTER TABLE "PatientConsent" ADD CONSTRAINT "PatientConsent_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DataRightsRequest" ADD CONSTRAINT "DataRightsRequest_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "PatientConsent_patientId_status_idx"      ON "PatientConsent"("patientId", "status");
CREATE INDEX IF NOT EXISTS "PatientConsent_patientId_consentedAt_idx"  ON "PatientConsent"("patientId", "consentedAt");
CREATE INDEX IF NOT EXISTS "DataRightsRequest_patientId_type_idx"      ON "DataRightsRequest"("patientId", "type");
CREATE INDEX IF NOT EXISTS "DataRightsRequest_status_createdAt_idx"    ON "DataRightsRequest"("status", "createdAt");
