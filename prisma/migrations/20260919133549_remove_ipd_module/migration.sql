-- DropForeignKey
ALTER TABLE "Admission" DROP CONSTRAINT "Admission_visitId_fkey";

-- DropForeignKey
ALTER TABLE "DischargeSummary" DROP CONSTRAINT "DischargeSummary_admissionId_fkey";

-- DropForeignKey
ALTER TABLE "DischargeSummary" DROP CONSTRAINT "DischargeSummary_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "InsuranceClaim" DROP CONSTRAINT "InsuranceClaim_admissionId_fkey";

-- DropForeignKey
ALTER TABLE "InsurancePreAuthorization" DROP CONSTRAINT "InsurancePreAuthorization_admissionId_fkey";

-- AlterTable
ALTER TABLE "InsuranceClaim" DROP COLUMN "admissionId";

-- AlterTable
ALTER TABLE "InsurancePreAuthorization" DROP COLUMN "admissionId";

-- DropTable
DROP TABLE "Admission";

-- DropTable
DROP TABLE "DischargeSummary";

