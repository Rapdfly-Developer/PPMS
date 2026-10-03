-- AlterTable: add optional dateOfBirth to Patient
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "dateOfBirth" DATE;
