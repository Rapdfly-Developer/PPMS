-- IPD: reason for admission (asked when the doctor clicks Admit)
ALTER TABLE "IpdAdmission" ADD COLUMN IF NOT EXISTS "admissionReason" TEXT;
