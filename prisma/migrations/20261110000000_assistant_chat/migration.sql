-- AI Chat (EMR chatbot): saved conversation per user and patient
CREATE TABLE IF NOT EXISTS "AssistantChatMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "provider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AssistantChatMessage_userId_patientId_createdAt_idx" ON "AssistantChatMessage"("userId", "patientId", "createdAt");
CREATE INDEX IF NOT EXISTS "AssistantChatMessage_patientId_idx" ON "AssistantChatMessage"("patientId");

DO $$ BEGIN
  ALTER TABLE "AssistantChatMessage" ADD CONSTRAINT "AssistantChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AssistantChatMessage" ADD CONSTRAINT "AssistantChatMessage_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
