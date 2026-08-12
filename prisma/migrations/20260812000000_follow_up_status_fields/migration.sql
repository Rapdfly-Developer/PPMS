-- Add follow-up completion and cancellation tracking to Visit
ALTER TABLE "Visit" ADD COLUMN "followUpCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Visit" ADD COLUMN "followUpCancelledAt" TIMESTAMP(3);
