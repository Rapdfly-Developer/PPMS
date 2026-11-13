-- Counselling sheets: implant details, consents and education & diet (JSON text)
ALTER TABLE "CounsellingRecord" ADD COLUMN "implantDetails" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "CounsellingRecord" ADD COLUMN "consents" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "CounsellingRecord" ADD COLUMN "education" TEXT NOT NULL DEFAULT '{}';
