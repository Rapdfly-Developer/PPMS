-- Cashfree monthly auto-pay: additive, nullable columns only.
ALTER TABLE "TenantLicense" ADD COLUMN "cashfreeSubscriptionId" TEXT;
ALTER TABLE "TenantLicense" ADD COLUMN "autopayStatus" TEXT;
ALTER TABLE "TenantLicense" ADD COLUMN "autopayPlan" TEXT;
ALTER TABLE "TenantLicense" ADD COLUMN "autopayNextChargeAt" TIMESTAMP(3);
