CREATE TABLE "CounsellingRecord" (
    "id"                 TEXT NOT NULL,
    "visitId"            TEXT NOT NULL,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,
    "paymentType"        TEXT,
    "paymentMode"        TEXT,
    "schemeName"         TEXT,
    "schemeType"         TEXT,
    "outOfPocket"        TEXT,
    "iolType"            TEXT,
    "iolLensName"        TEXT,
    "iolPower"           TEXT,
    "iolBrand"           TEXT,
    "iolToric"           BOOLEAN NOT NULL DEFAULT false,
    "laterality"         TEXT,
    "procedure"          TEXT,
    "anaesthesia"        TEXT,
    "estimateAmount"     DECIMAL(10,2),
    "estimateVague"      BOOLEAN NOT NULL DEFAULT false,
    "fitForSurgery"      BOOLEAN NOT NULL DEFAULT false,
    "advancePaid"        DECIMAL(10,2),
    "dateOfSurgery"      TIMESTAMP(3),
    "eligibleForSurgery" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CounsellingRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CounsellingRecord_visitId_key" ON "CounsellingRecord"("visitId");

ALTER TABLE "CounsellingRecord" ADD CONSTRAINT "CounsellingRecord_visitId_fkey"
    FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
