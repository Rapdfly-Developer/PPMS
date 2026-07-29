-- GeneratedSchedule: monthly calendar slots produced from the weekly template
CREATE TABLE IF NOT EXISTS "GeneratedSchedule" (
  "id"          TEXT         NOT NULL,
  "doctorId"    TEXT         NOT NULL,
  "date"        TIMESTAMP(3) NOT NULL,
  "hospitalId"  TEXT         NOT NULL,
  "startTime"   TEXT         NOT NULL,
  "endTime"     TEXT         NOT NULL,
  "slotMins"    INTEGER      NOT NULL DEFAULT 15,
  "maxPatients" INTEGER      NOT NULL DEFAULT 5,
  "isModified"  BOOLEAN      NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeneratedSchedule_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GeneratedSchedule"
  ADD CONSTRAINT "GeneratedSchedule_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GeneratedSchedule"
  ADD CONSTRAINT "GeneratedSchedule_hospitalId_fkey"
  FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "GeneratedSchedule_doctorId_date_idx" ON "GeneratedSchedule"("doctorId", "date");

-- ScheduleException: leave, extra OP, recurring blocks
CREATE TABLE IF NOT EXISTS "ScheduleException" (
  "id"               TEXT         NOT NULL,
  "doctorId"         TEXT         NOT NULL,
  "date"             TIMESTAMP(3) NOT NULL,
  "type"             TEXT         NOT NULL,
  "hospitalId"       TEXT,
  "startTime"        TEXT,
  "endTime"          TEXT,
  "slotMins"         INTEGER,
  "maxPatients"      INTEGER,
  "reason"           TEXT,
  "halfPeriod"       TEXT,
  "isRecurring"      BOOLEAN      NOT NULL DEFAULT false,
  "recurringGroupId" TEXT,
  "status"           TEXT         NOT NULL DEFAULT 'ACTIVE',
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduleException_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ScheduleException"
  ADD CONSTRAINT "ScheduleException_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScheduleException"
  ADD CONSTRAINT "ScheduleException_hospitalId_fkey"
  FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ScheduleException_doctorId_date_idx" ON "ScheduleException"("doctorId", "date");
