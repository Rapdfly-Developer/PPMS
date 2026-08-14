-- Doctor review workflow fields for SurgicalCounselling
ALTER TABLE "SurgicalCounselling" ADD COLUMN "reviewStatus"     TEXT;
ALTER TABLE "SurgicalCounselling" ADD COLUMN "doctorReviewNote" TEXT;
ALTER TABLE "SurgicalCounselling" ADD COLUMN "doctorReviewedAt" TIMESTAMP(3);
ALTER TABLE "SurgicalCounselling" ADD COLUMN "confirmedFitAt"   TIMESTAMP(3);
