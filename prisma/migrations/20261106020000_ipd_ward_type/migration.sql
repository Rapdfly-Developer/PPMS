-- IPD: male / female / other ward
ALTER TABLE "IpdAdmission" ADD COLUMN IF NOT EXISTS "wardType" TEXT;
