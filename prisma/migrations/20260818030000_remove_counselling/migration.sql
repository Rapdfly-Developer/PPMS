-- Drop counselling workflow tables first (FK dependencies on CounsellingWorkflow)
DROP TABLE IF EXISTS "OtSlotRequest";
DROP TABLE IF EXISTS "CounsellingVersion";
DROP TABLE IF EXISTS "CounsellingWorkflow";

-- Drop the core counselling table (visitId FK is here, not on Visit)
DROP TABLE IF EXISTS "SurgicalCounselling";

-- Remove the unused counselling reference column from SurgerySchedule
ALTER TABLE "SurgerySchedule" DROP COLUMN IF EXISTS "surgicalCounsellingId";
