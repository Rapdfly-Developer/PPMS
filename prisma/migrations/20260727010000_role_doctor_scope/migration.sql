-- Add createdByDoctorId to Role so custom roles can be scoped per doctor.
-- NULL = system role (DOCTOR, HOSPITAL); non-null = doctor-scoped custom role.
ALTER TABLE "Role" ADD COLUMN "createdByDoctorId" TEXT;
