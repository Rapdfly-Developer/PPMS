-- Counselling: payment documents (insurance card, pre-authorisation, scheme card, letter) as JSON text
ALTER TABLE "CounsellingRecord" ADD COLUMN "paymentDocs" TEXT NOT NULL DEFAULT '[]';
