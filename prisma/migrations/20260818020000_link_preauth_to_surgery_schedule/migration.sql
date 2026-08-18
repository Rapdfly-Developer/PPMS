-- Add preAuthId to SurgerySchedule (optional, unique — one pre-auth per surgery)
ALTER TABLE "SurgerySchedule" ADD COLUMN "preAuthId" TEXT;
CREATE UNIQUE INDEX "SurgerySchedule_preAuthId_key" ON "SurgerySchedule"("preAuthId");
ALTER TABLE "SurgerySchedule" ADD CONSTRAINT "SurgerySchedule_preAuthId_fkey"
    FOREIGN KEY ("preAuthId") REFERENCES "InsurancePreAuthorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
