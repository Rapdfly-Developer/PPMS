-- Implant chosen in the EMR Surgical Counselling card
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "advisedSurgeryImplant" TEXT;
