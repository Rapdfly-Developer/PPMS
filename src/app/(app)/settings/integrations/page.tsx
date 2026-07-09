import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { IntegrationsClient } from "./IntegrationsClient";

export default async function IntegrationsPage() {
  await requireRole("DOCTOR");

  const [hospitals, logs, statusGroups] = await Promise.all([
    prisma.hospital.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        shortCode: true,
        integration: {
          select: {
            id: true,
            integrationType: true,
            apiEndpoint: true,
            authType: true,
            oauthTokenUrl: true,
            fieldMappingJson: true,
            transformationRules: true,
            maxRetries: true,
            syncEnabled: true,
            credentialsEncrypted: true,
            updatedAt: true,
          },
        },
      },
    }),
    prisma.integrationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        hospitalId: true,
        patientId: true,
        visitId: true,
        status: true,
        triggeredBy: true,
        retryCount: true,
        errorMessage: true,
        requestPayload: true,
        responsePayload: true,
        createdAt: true,
        updatedAt: true,
        hospital: { select: { name: true } },
      },
    }),
    prisma.integrationLog.groupBy({ by: ["status"], _count: { id: true } }),
  ]);

  // Patient names for the log table
  const patientIds = [...new Set(logs.map((l) => l.patientId).filter(Boolean))] as string[];
  const patients = patientIds.length
    ? await prisma.patient.findMany({ where: { id: { in: patientIds } }, select: { id: true, name: true, udid: true } })
    : [];
  const patientById = new Map(patients.map((p) => [p.id, p]));

  const counts = { SUCCESS: 0, FAILED: 0, PENDING: 0 };
  for (const g of statusGroups) {
    if (g.status in counts) counts[g.status as keyof typeof counts] = g._count.id;
  }

  const serializedHospitals = hospitals.map((h) => ({
    id: h.id,
    name: h.name,
    shortCode: h.shortCode,
    integration: h.integration
      ? {
          integrationType: h.integration.integrationType,
          apiEndpoint: h.integration.apiEndpoint,
          authType: h.integration.authType,
          oauthTokenUrl: h.integration.oauthTokenUrl,
          fieldMappingJson: h.integration.fieldMappingJson,
          transformationRules: h.integration.transformationRules,
          maxRetries: h.integration.maxRetries,
          syncEnabled: h.integration.syncEnabled,
          hasCredentials: !!h.integration.credentialsEncrypted,
          updatedAt: h.integration.updatedAt.toISOString(),
        }
      : null,
  }));

  const serializedLogs = logs.map((l) => ({
    id: l.id,
    hospitalName: l.hospital.name,
    patientName: l.patientId ? patientById.get(l.patientId)?.name ?? null : null,
    patientUdid: l.patientId ? patientById.get(l.patientId)?.udid ?? null : null,
    visitId: l.visitId,
    status: l.status,
    triggeredBy: l.triggeredBy,
    retryCount: l.retryCount,
    errorMessage: l.errorMessage,
    requestPayload: l.requestPayload,
    responsePayload: l.responsePayload,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }));

  return (
    <IntegrationsClient
      hospitals={serializedHospitals}
      logs={serializedLogs}
      counts={counts}
    />
  );
}
