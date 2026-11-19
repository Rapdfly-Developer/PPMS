-- Doctor's notes: the signed note's own copy of the EMR
ALTER TABLE "IpdDoctorNote" ADD COLUMN "data" TEXT;
ALTER TABLE "IpdDoctorNote" ADD COLUMN "editedAt" TIMESTAMP(3);
