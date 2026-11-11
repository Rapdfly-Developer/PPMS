-- When a patient left Partial Dispense, and how: back to the OPD queue, or finalized directly.
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "partialDispenseEndedAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "partialDispenseEndedBy" TEXT;
