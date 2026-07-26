-- MonthlyAvailability: date-range recurring plans
CREATE TABLE IF NOT EXISTS "MonthlyAvailability" (
  "id"          TEXT         NOT NULL,
  "doctorId"    TEXT         NOT NULL,
  "hospitalId"  TEXT         NOT NULL,
  "validFrom"   TIMESTAMP(3) NOT NULL,
  "validTo"     TIMESTAMP(3) NOT NULL,
  "weekdays"    TEXT         NOT NULL,
  "startTime"   TEXT         NOT NULL,
  "endTime"     TEXT         NOT NULL,
  "slotMins"    INTEGER      NOT NULL DEFAULT 15,
  "maxPatients" INTEGER      NOT NULL DEFAULT 5,
  "label"       TEXT,
  "status"      TEXT         NOT NULL DEFAULT 'ACTIVE',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MonthlyAvailability_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MonthlyAvailability"
  ADD CONSTRAINT "MonthlyAvailability_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MonthlyAvailability"
  ADD CONSTRAINT "MonthlyAvailability_hospitalId_fkey"
  FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- IndividualDayAvailability: specific date overrides
CREATE TABLE IF NOT EXISTS "IndividualDayAvailability" (
  "id"          TEXT         NOT NULL,
  "doctorId"    TEXT         NOT NULL,
  "hospitalId"  TEXT         NOT NULL,
  "date"        TIMESTAMP(3) NOT NULL,
  "startTime"   TEXT         NOT NULL,
  "endTime"     TEXT         NOT NULL,
  "slotMins"    INTEGER      NOT NULL DEFAULT 15,
  "maxPatients" INTEGER      NOT NULL DEFAULT 5,
  "reason"      TEXT,
  "status"      TEXT         NOT NULL DEFAULT 'ACTIVE',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IndividualDayAvailability_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "IndividualDayAvailability"
  ADD CONSTRAINT "IndividualDayAvailability_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IndividualDayAvailability"
  ADD CONSTRAINT "IndividualDayAvailability_hospitalId_fkey"
  FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DoctorLeave: highest-priority schedule block
CREATE TABLE IF NOT EXISTS "DoctorLeave" (
  "id"         TEXT         NOT NULL,
  "doctorId"   TEXT         NOT NULL,
  "hospitalId" TEXT,
  "date"       TIMESTAMP(3) NOT NULL,
  "leaveType"  TEXT         NOT NULL DEFAULT 'FULL_DAY',
  "halfPeriod" TEXT,
  "reason"     TEXT,
  "status"     TEXT         NOT NULL DEFAULT 'APPROVED',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DoctorLeave_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DoctorLeave"
  ADD CONSTRAINT "DoctorLeave_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DoctorLeave"
  ADD CONSTRAINT "DoctorLeave_hospitalId_fkey"
  FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;
