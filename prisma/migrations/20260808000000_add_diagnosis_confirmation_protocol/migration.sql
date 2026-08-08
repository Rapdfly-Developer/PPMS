-- AlterTable
ALTER TABLE "Diagnosis" ADD COLUMN "confirmedAt" TIMESTAMP(3);
ALTER TABLE "Diagnosis" ADD COLUMN "protocolId" TEXT;
ALTER TABLE "Diagnosis" ADD COLUMN "protocolName" TEXT;
