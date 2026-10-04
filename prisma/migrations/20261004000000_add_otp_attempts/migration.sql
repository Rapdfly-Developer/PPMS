-- Count wrong OTP guesses so a 6-digit code cannot be brute-forced.
ALTER TABLE "EmailOtp" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MobileOtp" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PasswordResetToken" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
