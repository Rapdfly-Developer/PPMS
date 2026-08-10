-- AlterTable
ALTER TABLE "SurgicalCounselling"
  ADD COLUMN "insuranceType"     TEXT,
  ADD COLUMN "counselingDone"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "investigationDone" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "fitForSurgery"     BOOLEAN;
