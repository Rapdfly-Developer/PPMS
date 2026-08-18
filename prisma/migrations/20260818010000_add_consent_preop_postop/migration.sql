-- SurgeryConsent
CREATE TABLE "SurgeryConsent" (
    "id" TEXT NOT NULL,
    "surgeryScheduleId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "attendantName" TEXT,
    "relationship" TEXT,
    "surgeryExplained" BOOLEAN NOT NULL DEFAULT false,
    "risksExplained" BOOLEAN NOT NULL DEFAULT false,
    "alternativesExplained" BOOLEAN NOT NULL DEFAULT false,
    "questionsAnswered" BOOLEAN NOT NULL DEFAULT false,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SurgeryConsent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SurgeryConsent_surgeryScheduleId_key" ON "SurgeryConsent"("surgeryScheduleId");
ALTER TABLE "SurgeryConsent" ADD CONSTRAINT "SurgeryConsent_surgeryScheduleId_fkey"
    FOREIGN KEY ("surgeryScheduleId") REFERENCES "SurgerySchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PreOpAssessment
CREATE TABLE "PreOpAssessment" (
    "id" TEXT NOT NULL,
    "surgeryScheduleId" TEXT NOT NULL,
    "hasDiabetes" BOOLEAN NOT NULL DEFAULT false,
    "hasHypertension" BOOLEAN NOT NULL DEFAULT false,
    "hasCardiacDisease" BOOLEAN NOT NULL DEFAULT false,
    "hasAsthma" BOOLEAN NOT NULL DEFAULT false,
    "hasKidneyDisease" BOOLEAN NOT NULL DEFAULT false,
    "otherConditions" TEXT,
    "currentMedications" TEXT,
    "allergies" TEXT,
    "nkda" BOOLEAN NOT NULL DEFAULT false,
    "bloodSugarLevel" TEXT,
    "bpReading" TEXT,
    "ecgNormal" BOOLEAN,
    "investigationNotes" TEXT,
    "asaGrade" TEXT,
    "anesthesiaFitness" TEXT NOT NULL DEFAULT 'FIT',
    "fitnessNotes" TEXT,
    "assessedBy" TEXT,
    "assessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PreOpAssessment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PreOpAssessment_surgeryScheduleId_key" ON "PreOpAssessment"("surgeryScheduleId");
ALTER TABLE "PreOpAssessment" ADD CONSTRAINT "PreOpAssessment_surgeryScheduleId_fkey"
    FOREIGN KEY ("surgeryScheduleId") REFERENCES "SurgerySchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PostOpReview
CREATE TABLE "PostOpReview" (
    "id" TEXT NOT NULL,
    "surgeryScheduleId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "reVaUnaided" TEXT,
    "leVaUnaided" TEXT,
    "reBcva" TEXT,
    "leBcva" TEXT,
    "iopRe" TEXT,
    "iopLe" TEXT,
    "woundStatus" TEXT,
    "iolPosition" TEXT,
    "anteriorChamber" TEXT,
    "fundusNotes" TEXT,
    "complications" TEXT,
    "postOpMedications" TEXT,
    "instructions" TEXT,
    "followUpDate" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostOpReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PostOpReview_surgeryScheduleId_key" ON "PostOpReview"("surgeryScheduleId");
ALTER TABLE "PostOpReview" ADD CONSTRAINT "PostOpReview_surgeryScheduleId_fkey"
    FOREIGN KEY ("surgeryScheduleId") REFERENCES "SurgerySchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PostOpReview" ADD CONSTRAINT "PostOpReview_doctorId_fkey"
    FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
