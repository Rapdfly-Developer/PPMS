-- Add tentative date of surgery to Visit
ALTER TABLE "Visit"
  ADD COLUMN IF NOT EXISTS "advisedSurgeryDate" TIMESTAMP(3);
