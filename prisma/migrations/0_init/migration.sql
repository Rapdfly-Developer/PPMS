-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortCode" TEXT,
    "specialty" TEXT NOT NULL DEFAULT '',
    "contact" TEXT,
    "credentials" TEXT,
    "email" TEXT,
    "experience" TEXT,
    "medicalRegNumber" TEXT,
    "qualifications" TEXT,
    "signatureUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hospital" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "contact" TEXT,
    "logoUrl" TEXT,
    "retentionYears" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalIntegration" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "integrationType" TEXT NOT NULL DEFAULT 'REST',
    "apiEndpoint" TEXT,
    "authType" TEXT NOT NULL DEFAULT 'NONE',
    "credentialsEncrypted" TEXT,
    "oauthTokenUrl" TEXT,
    "fieldMappingJson" TEXT,
    "transformationRules" TEXT,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationLog" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientId" TEXT,
    "visitId" TEXT,
    "recordType" TEXT NOT NULL DEFAULT 'VISIT',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestPayload" TEXT,
    "responsePayload" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "triggeredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantLicense" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "trialStartsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trialEndsAt" TIMESTAMP(3) NOT NULL,
    "plan" TEXT,
    "subscriptionStartsAt" TIMESTAMP(3),
    "subscriptionEndsAt" TIMESTAMP(3),
    "paymentStatus" TEXT NOT NULL DEFAULT 'NONE',
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "razorpaySignature" TEXT,
    "licenseKey" TEXT,
    "machineId" TEXT,
    "deviceName" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "remindersSent" INTEGER NOT NULL DEFAULT 0,
    "signature" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantLicense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssuedLicenseKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "note" TEXT,
    "months" INTEGER NOT NULL DEFAULT 12,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),
    "usedByDoctorId" TEXT,
    "revoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "IssuedLicenseKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseEvent" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "keyMasked" TEXT,
    "performedBy" TEXT,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalStaff" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HospitalStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorHospitalLink" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DoctorHospitalLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refractionist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT,
    "doctorId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refractionist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorAvailability" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "slotMins" INTEGER NOT NULL DEFAULT 15,
    "maxPatients" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "uhid" TEXT,
    "udid" TEXT,
    "doctorId" TEXT,
    "registeredAtId" TEXT,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "sex" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "aadhaarEncrypted" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "complaint" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT,
    "hospitalId" TEXT NOT NULL,
    "dateTime" TIMESTAMP(3) NOT NULL,
    "visitType" TEXT NOT NULL DEFAULT 'General OPD',
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "consultationStatus" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "isWalkIn" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "visitType" TEXT NOT NULL DEFAULT 'General OPD',
    "finalizedAt" TIMESTAMP(3),
    "finalizedBy" TEXT,
    "sentToPharmacy" BOOLEAN NOT NULL DEFAULT false,
    "followUpDate" TIMESTAMP(3),
    "referralEnabled" BOOLEAN NOT NULL DEFAULT false,
    "referralNote" TEXT,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneralExamination" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "bp" TEXT,
    "pulse" TEXT,
    "temperature" TEXT,
    "weight" TEXT,
    "chiefComplaint" TEXT,
    "hpi" TEXT,
    "provisionalDx" TEXT,
    "pastMedicalHistory" TEXT,
    "pmhOtherText" TEXT,
    "medications" TEXT,
    "allergies" TEXT,
    "nkda" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneralExamination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "drugName" TEXT NOT NULL,
    "dosage" TEXT,
    "frequency" TEXT,
    "duration" TEXT,
    "instructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PastExternalVisit" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "sourceDate" TIMESTAMP(3),
    "sourceHospital" TEXT,
    "extractedDiagnosis" TEXT,
    "extractedTreatment" TEXT,
    "scanFileRef" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PastExternalVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisualAcuity" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "testMethod" TEXT,
    "re" TEXT,
    "le" TEXT,
    "reviewedByDoctor" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisualAcuity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefractiveCorrection" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "re" TEXT,
    "le" TEXT,
    "sentToOpticals" BOOLEAN NOT NULL DEFAULT false,
    "reviewedByDoctor" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefractiveCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColourVisionContrastSensitivity" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "re" TEXT,
    "le" TEXT,
    "reviewedByDoctor" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColourVisionContrastSensitivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IOPReading" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "re" DOUBLE PRECISION,
    "le" DOUBLE PRECISION,
    "method" TEXT,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'DOCTOR',
    "reviewedByDoctor" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "IOPReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnteriorSegment" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "re" TEXT,
    "le" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnteriorSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosteriorSegment" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "re" TEXT,
    "le" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosteriorSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiplopiaChart" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "grid" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiplopiaChart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HessChart" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "grid" TEXT NOT NULL,
    "interpretation" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HessChart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Retinoscopy" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "re" TEXT,
    "le" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Retinoscopy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TearFilm" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "tbutRe" DOUBLE PRECISION,
    "tbutLe" DOUBLE PRECISION,
    "schirmer1Re" DOUBLE PRECISION,
    "schirmer1Le" DOUBLE PRECISION,
    "schirmer2Re" DOUBLE PRECISION,
    "schirmer2Le" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TearFilm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LacrimalSacSyringing" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "re" TEXT,
    "le" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LacrimalSacSyringing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestigationOrder" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'ROUTINE',
    "laterality" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ORDERED',
    "resultRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestigationOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Diagnosis" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "icd10Code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "laterality" TEXT,
    "provisional" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Diagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispense" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "shortSummary" TEXT NOT NULL,
    "longSummaryUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admission" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "ward" TEXT NOT NULL,
    "numberOfDays" INTEGER NOT NULL,
    "discharged" BOOLEAN NOT NULL DEFAULT false,
    "dischargedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurgicalCounselling" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "surgeryType" TEXT NOT NULL,
    "rightEye" BOOLEAN NOT NULL DEFAULT false,
    "leftEye" BOOLEAN NOT NULL DEFAULT false,
    "anaesthesiaType" TEXT NOT NULL,
    "surgeryDate" TIMESTAMP(3) NOT NULL,
    "conflictFlag" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurgicalCounselling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hospitalId" TEXT,
    "moduleName" TEXT,
    "actionType" TEXT,
    "ipAddress" TEXT,
    "userName" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLoginHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "hospitalId" TEXT,
    "hospitalName" TEXT,
    "loginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logoutAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failReason" TEXT,

    CONSTRAINT "UserLoginHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerification" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportOtp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobileOtp" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "loginToken" TEXT,
    "tokenExpAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "resetToken" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "tokenExpAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChipOption" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hospitalId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChipOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_userId_key" ON "Doctor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_shortCode_key" ON "Doctor"("shortCode");

-- CreateIndex
CREATE UNIQUE INDEX "Hospital_shortCode_key" ON "Hospital"("shortCode");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalIntegration_hospitalId_key" ON "HospitalIntegration"("hospitalId");

-- CreateIndex
CREATE INDEX "IntegrationLog_hospitalId_status_idx" ON "IntegrationLog"("hospitalId", "status");

-- CreateIndex
CREATE INDEX "IntegrationLog_visitId_idx" ON "IntegrationLog"("visitId");

-- CreateIndex
CREATE INDEX "IntegrationLog_createdAt_idx" ON "IntegrationLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenantLicense_doctorId_key" ON "TenantLicense"("doctorId");

-- CreateIndex
CREATE INDEX "TenantLicense_trialEndsAt_idx" ON "TenantLicense"("trialEndsAt");

-- CreateIndex
CREATE INDEX "TenantLicense_subscriptionEndsAt_idx" ON "TenantLicense"("subscriptionEndsAt");

-- CreateIndex
CREATE UNIQUE INDEX "IssuedLicenseKey_key_key" ON "IssuedLicenseKey"("key");

-- CreateIndex
CREATE INDEX "IssuedLicenseKey_usedAt_idx" ON "IssuedLicenseKey"("usedAt");

-- CreateIndex
CREATE INDEX "LicenseEvent_doctorId_createdAt_idx" ON "LicenseEvent"("doctorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalStaff_userId_key" ON "HospitalStaff"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorHospitalLink_doctorId_hospitalId_key" ON "DoctorHospitalLink"("doctorId", "hospitalId");

-- CreateIndex
CREATE UNIQUE INDEX "Refractionist_userId_key" ON "Refractionist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_uhid_key" ON "Patient"("uhid");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_udid_key" ON "Patient"("udid");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_dateTime_idx" ON "Appointment"("doctorId", "dateTime");

-- CreateIndex
CREATE UNIQUE INDEX "Visit_appointmentId_key" ON "Visit"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneralExamination_visitId_key" ON "GeneralExamination"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "VisualAcuity_visitId_key" ON "VisualAcuity"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "RefractiveCorrection_visitId_key" ON "RefractiveCorrection"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "ColourVisionContrastSensitivity_visitId_key" ON "ColourVisionContrastSensitivity"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "AnteriorSegment_visitId_key" ON "AnteriorSegment"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "PosteriorSegment_visitId_key" ON "PosteriorSegment"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "DiplopiaChart_visitId_key" ON "DiplopiaChart"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "HessChart_visitId_key" ON "HessChart"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "Retinoscopy_visitId_key" ON "Retinoscopy"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "TearFilm_visitId_key" ON "TearFilm"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "LacrimalSacSyringing_visitId_key" ON "LacrimalSacSyringing"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "Dispense_visitId_key" ON "Dispense"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_visitId_key" ON "Admission"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "SurgicalCounselling_visitId_key" ON "SurgicalCounselling"("visitId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_timestamp_idx" ON "AuditLog"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_hospitalId_timestamp_idx" ON "AuditLog"("hospitalId", "timestamp");

-- CreateIndex
CREATE INDEX "UserLoginHistory_userId_loginAt_idx" ON "UserLoginHistory"("userId", "loginAt");

-- CreateIndex
CREATE INDEX "UserLoginHistory_status_loginAt_idx" ON "UserLoginHistory"("status", "loginAt");

-- CreateIndex
CREATE INDEX "UserLoginHistory_isActive_idx" ON "UserLoginHistory"("isActive");

-- CreateIndex
CREATE INDEX "EmailVerification_email_idx" ON "EmailVerification"("email");

-- CreateIndex
CREATE INDEX "ExportOtp_userId_expiresAt_idx" ON "ExportOtp"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MobileOtp_loginToken_key" ON "MobileOtp"("loginToken");

-- CreateIndex
CREATE INDEX "MobileOtp_mobile_createdAt_idx" ON "MobileOtp"("mobile", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_resetToken_key" ON "PasswordResetToken"("resetToken");

-- CreateIndex
CREATE INDEX "PasswordResetToken_email_createdAt_idx" ON "PasswordResetToken"("email", "createdAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_resetToken_idx" ON "PasswordResetToken"("resetToken");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "RolePermission_role_idx" ON "RolePermission"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_permissionId_key" ON "RolePermission"("role", "permissionId");

-- CreateIndex
CREATE INDEX "ChipOption_category_hospitalId_idx" ON "ChipOption"("category", "hospitalId");

-- CreateIndex
CREATE UNIQUE INDEX "ChipOption_category_value_hospitalId_key" ON "ChipOption"("category", "value", "hospitalId");

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalIntegration" ADD CONSTRAINT "HospitalIntegration_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationLog" ADD CONSTRAINT "IntegrationLog_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "HospitalIntegration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationLog" ADD CONSTRAINT "IntegrationLog_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantLicense" ADD CONSTRAINT "TenantLicense_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalStaff" ADD CONSTRAINT "HospitalStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalStaff" ADD CONSTRAINT "HospitalStaff_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorHospitalLink" ADD CONSTRAINT "DoctorHospitalLink_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorHospitalLink" ADD CONSTRAINT "DoctorHospitalLink_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refractionist" ADD CONSTRAINT "Refractionist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refractionist" ADD CONSTRAINT "Refractionist_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refractionist" ADD CONSTRAINT "Refractionist_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorAvailability" ADD CONSTRAINT "DoctorAvailability_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorAvailability" ADD CONSTRAINT "DoctorAvailability_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_registeredAtId_fkey" FOREIGN KEY ("registeredAtId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneralExamination" ADD CONSTRAINT "GeneralExamination_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastExternalVisit" ADD CONSTRAINT "PastExternalVisit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisualAcuity" ADD CONSTRAINT "VisualAcuity_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefractiveCorrection" ADD CONSTRAINT "RefractiveCorrection_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColourVisionContrastSensitivity" ADD CONSTRAINT "ColourVisionContrastSensitivity_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IOPReading" ADD CONSTRAINT "IOPReading_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnteriorSegment" ADD CONSTRAINT "AnteriorSegment_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosteriorSegment" ADD CONSTRAINT "PosteriorSegment_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiplopiaChart" ADD CONSTRAINT "DiplopiaChart_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HessChart" ADD CONSTRAINT "HessChart_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retinoscopy" ADD CONSTRAINT "Retinoscopy_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TearFilm" ADD CONSTRAINT "TearFilm_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LacrimalSacSyringing" ADD CONSTRAINT "LacrimalSacSyringing_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationOrder" ADD CONSTRAINT "InvestigationOrder_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnosis" ADD CONSTRAINT "Diagnosis_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispense" ADD CONSTRAINT "Dispense_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurgicalCounselling" ADD CONSTRAINT "SurgicalCounselling_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLoginHistory" ADD CONSTRAINT "UserLoginHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportOtp" ADD CONSTRAINT "ExportOtp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChipOption" ADD CONSTRAINT "ChipOption_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

