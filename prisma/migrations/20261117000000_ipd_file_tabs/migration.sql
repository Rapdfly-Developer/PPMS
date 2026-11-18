-- Patient file tabs chosen when the file is created
ALTER TABLE "IpdAdmission" ADD COLUMN "fileTabs" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "IpdAdmission" ADD COLUMN "fileCreatedAt" TIMESTAMP(3);

-- Files that already exist keep every tab they had
UPDATE "IpdAdmission" SET
  "fileCreatedAt" = "createdAt",
  "fileTabs" = CASE WHEN "admissionType" = 'PRE_OP'
    THEN ARRAY['summary','investigations','implant','consents','checklist','education','treatment','nurse','otNotes','discharge','postOpNotes']
    ELSE ARRAY['summary','investigations','education','treatment','nurse','discharge','postOpNotes'] END;
