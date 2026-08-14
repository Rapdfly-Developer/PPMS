-- Extended fields for the full Surgical Counselling page
ALTER TABLE "SurgicalCounselling" ADD COLUMN "paymentNotes"     TEXT;
ALTER TABLE "SurgicalCounselling" ADD COLUMN "advanceAmount"    DOUBLE PRECISION;
ALTER TABLE "SurgicalCounselling" ADD COLUMN "advanceReceipt"   TEXT;
ALTER TABLE "SurgicalCounselling" ADD COLUMN "counsellingNotes" TEXT;
