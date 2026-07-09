"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { encryptSecret } from "@/lib/crypto";
import { retryLog, syncVisit, testIntegration } from "@/lib/integration/engine";
import { revalidatePath } from "next/cache";

const INTEGRATION_TYPES = ["FHIR", "HL7", "REST", "CSV"] as const;
const AUTH_TYPES = ["NONE", "API_KEY", "BEARER", "BASIC", "OAUTH2"] as const;

export type IntegrationFormData = {
  integrationType: string;
  apiEndpoint: string;
  authType: string;
  credentials: string; // blank = keep existing
  oauthTokenUrl: string;
  fieldMappingJson: string;
  transformationRules: string;
  maxRetries: number;
  syncEnabled: boolean;
};

function validateJsonField(raw: string, label: string): string | null {
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    return null;
  } catch {
    return `${label} must be a valid JSON object.`;
  }
}

export async function saveIntegration(
  hospitalId: string,
  data: IntegrationFormData,
): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");

  if (!INTEGRATION_TYPES.includes(data.integrationType as never)) return { error: "Invalid integration type." };
  if (!AUTH_TYPES.includes(data.authType as never)) return { error: "Invalid auth type." };

  const endpoint = data.apiEndpoint.trim();
  if (endpoint && !/^https?:\/\//.test(endpoint)) return { error: "Endpoint must be an http(s) URL." };
  if (data.integrationType !== "CSV" && !endpoint) {
    return { error: "An API endpoint is required for FHIR, HL7 and REST integrations." };
  }

  const mappingError =
    validateJsonField(data.fieldMappingJson, "Field mapping") ??
    validateJsonField(data.transformationRules, "Transformation rules");
  if (mappingError) return { error: mappingError };

  if (data.authType === "OAUTH2" && !data.oauthTokenUrl.trim()) {
    return { error: "OAuth2 requires a token URL." };
  }

  const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId }, select: { id: true } });
  if (!hospital) return { error: "Hospital not found." };

  const common = {
    integrationType: data.integrationType,
    apiEndpoint: endpoint || null,
    authType: data.authType,
    oauthTokenUrl: data.oauthTokenUrl.trim() || null,
    fieldMappingJson: data.fieldMappingJson.trim() || null,
    transformationRules: data.transformationRules.trim() || null,
    maxRetries: Math.min(10, Math.max(1, Math.round(data.maxRetries) || 3)),
    syncEnabled: data.syncEnabled,
  };
  // Blank credentials on edit = keep the stored secret.
  const credentialUpdate = data.credentials.trim()
    ? { credentialsEncrypted: encryptSecret(data.credentials.trim()) }
    : {};

  await prisma.hospitalIntegration.upsert({
    where: { hospitalId },
    create: { hospitalId, ...common, ...credentialUpdate },
    update: { ...common, ...credentialUpdate },
  });

  await writeAudit(user.id, "HospitalIntegration", hospitalId, "INTEGRATION_CONFIG_SAVED", {
    integrationType: data.integrationType,
    authType: data.authType,
    syncEnabled: data.syncEnabled,
    endpoint: endpoint || null,
  });

  revalidatePath("/settings/integrations");
  return {};
}

export async function toggleSyncEnabled(hospitalId: string, enabled: boolean): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");
  const existing = await prisma.hospitalIntegration.findUnique({ where: { hospitalId }, select: { id: true } });
  if (!existing) return { error: "Configure the integration before enabling sync." };

  await prisma.hospitalIntegration.update({ where: { hospitalId }, data: { syncEnabled: enabled } });
  await writeAudit(user.id, "HospitalIntegration", hospitalId, enabled ? "SYNC_ENABLED" : "SYNC_DISABLED", {});
  revalidatePath("/settings/integrations");
  return {};
}

export async function testHospitalConnection(hospitalId: string): Promise<{ ok: boolean; detail: string }> {
  const user = await requireRole("DOCTOR");
  const result = await testIntegration(hospitalId);
  await writeAudit(user.id, "HospitalIntegration", hospitalId, "INTEGRATION_TEST", {
    ok: result.ok,
    detail: result.detail.slice(0, 300),
  });
  return result;
}

export async function retryIntegrationLog(logId: string): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");
  const result = await retryLog(logId);
  await writeAudit(user.id, "IntegrationLog", logId, "INTEGRATION_RETRY", {
    ok: result.ok,
    error: result.error ?? null,
  });
  revalidatePath("/settings/integrations");
  return result.ok ? {} : { error: result.error ?? "Retry failed." };
}

export async function syncVisitNow(visitId: string): Promise<{ error?: string }> {
  const user = await requireRole("DOCTOR");
  const result = await syncVisit(visitId, "MANUAL");
  await writeAudit(user.id, "Visit", visitId, "INTEGRATION_MANUAL_SYNC", {
    ok: result.ok,
    error: result.error ?? null,
  });
  revalidatePath("/settings/integrations");
  return result.ok ? {} : { error: result.error ?? "Sync failed." };
}
