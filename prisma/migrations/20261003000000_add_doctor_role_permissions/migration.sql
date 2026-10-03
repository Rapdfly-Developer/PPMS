-- CreateTable
CREATE TABLE "DoctorRolePermission" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissions" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorRolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DoctorRolePermission_doctorId_idx" ON "DoctorRolePermission"("doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorRolePermission_doctorId_role_key" ON "DoctorRolePermission"("doctorId", "role");
