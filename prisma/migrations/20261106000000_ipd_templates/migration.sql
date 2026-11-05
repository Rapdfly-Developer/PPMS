-- IPD: doctors' own OT note templates and patient-education sets
CREATE TABLE IF NOT EXISTS "IpdTemplate" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surgery" TEXT,
    "items" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IpdTemplate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IpdTemplate_doctorId_kind_idx" ON "IpdTemplate"("doctorId", "kind");
