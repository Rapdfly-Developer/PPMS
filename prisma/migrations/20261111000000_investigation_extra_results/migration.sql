-- Further report files added to an investigation with "Add more" (JSON list).
ALTER TABLE "InvestigationOrder" ADD COLUMN IF NOT EXISTS "extraResultRefs" TEXT;
