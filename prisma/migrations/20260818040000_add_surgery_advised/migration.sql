-- Add surgical counselling fields to Visit
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "surgeryAdvised" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "advisedSurgeryName" TEXT;
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "advisedSurgeryEye" TEXT;
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "advisedSurgeryNotes" TEXT;
