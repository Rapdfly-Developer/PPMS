import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { getAdapter } from "./adapters";
import { buildStandardRecord, buildSampleRecord } from "./record";
import type { AdapterPayload, AuthType, IntegrationConfig, IntegrationType } from "./types";

const REQUEST_TIMEOUT_MS = 15_000;
const LOG_PAYLOAD_LIMIT = 6_000;

type IntegrationRow = NonNullable<Awaited<ReturnType<typeof prisma.hospitalIntegration.findUnique>>>;

export type SyncResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  logId?: string;
};

function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function truncate(v: string): string {
  return v.length > LOG_PAYLOAD_LIMIT ? `${v.slice(0, LOG_PAYLOAD_LIMIT)}… [truncated]` : v;
}

function resolveConfig(row: IntegrationRow): IntegrationConfig {
  let credentials: string | null = null;
  if (row.credentialsEncrypted) {
    try {
      credentials = decryptSecret(row.credentialsEncrypted);
    } catch {
      credentials = null; // key rotated / corrupt — treated as missing
    }
  }
  return {
    integrationType: row.integrationType as IntegrationType,
    apiEndpoint: row.apiEndpoint,
    authType: row.authType as AuthType,
    credentials,
    oauthTokenUrl: row.oauthTokenUrl,
    fieldMapping: safeJson(row.fieldMappingJson, {}),
    transformationRules: safeJson(row.transformationRules, {}),
    maxRetries: row.maxRetries,
  };
}

function assertEndpointAllowed(endpoint: string): void {
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)([:/]|$)/.test(endpoint);
  if (!endpoint.startsWith("https://") && !isLocal) {
    throw new Error("Endpoint must use HTTPS (plain HTTP is allowed only for localhost testing).");
  }
}

async function buildAuthHeaders(config: IntegrationConfig): Promise<Record<string, string>> {
  const { authType, credentials } = config;
  if (authType === "NONE") return {};
  if (!credentials) throw new Error(`Auth type ${authType} configured but no credentials stored.`);

  switch (authType) {
    case "API_KEY":
      return { "X-API-Key": credentials };
    case "BEARER":
      return { Authorization: `Bearer ${credentials}` };
    case "BASIC":
      return { Authorization: `Basic ${Buffer.from(credentials).toString("base64")}` };
    case "OAUTH2": {
      if (!config.oauthTokenUrl) throw new Error("OAuth2 configured but token URL is missing.");
      const { clientId, clientSecret } = safeJson<{ clientId?: string; clientSecret?: string }>(credentials, {});
      if (!clientId || !clientSecret) {
        throw new Error('OAuth2 credentials must be JSON: {"clientId":"…","clientSecret":"…"}');
      }
      assertEndpointAllowed(config.oauthTokenUrl);
      const res = await fetch(config.oauthTokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`OAuth2 token request failed: HTTP ${res.status}`);
      const token = (await res.json())?.access_token;
      if (!token) throw new Error("OAuth2 token response did not contain access_token.");
      return { Authorization: `Bearer ${token}` };
    }
    default:
      return {};
  }
}

type DeliveryResult = { httpStatus: number; responseBody: string };

// POST payload to the hospital endpoint. Retries network errors and 5xx
// with linear backoff; 4xx fails immediately (config problem, not transient).
async function deliver(payload: AdapterPayload, config: IntegrationConfig): Promise<DeliveryResult> {
  const endpoint = config.apiEndpoint;
  if (!endpoint) throw new Error("No API endpoint configured.");
  assertEndpointAllowed(endpoint);

  const attempts = Math.max(1, config.maxRetries);
  let lastError = "";

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const headers = { "Content-Type": payload.contentType, ...(await buildAuthHeaders(config)) };
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: payload.body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const responseBody = await res.text().catch(() => "");
      if (res.ok) return { httpStatus: res.status, responseBody };
      if (res.status < 500) {
        throw Object.assign(new Error(`HTTP ${res.status}: ${responseBody.slice(0, 300)}`), { permanent: true });
      }
      lastError = `HTTP ${res.status}: ${responseBody.slice(0, 300)}`;
    } catch (err: unknown) {
      if ((err as { permanent?: boolean }).permanent) throw err;
      lastError = err instanceof Error ? err.message : String(err);
    }
    if (attempt < attempts) await new Promise((r) => setTimeout(r, 750 * attempt));
  }
  throw new Error(`Delivery failed after ${attempts} attempt(s): ${lastError}`);
}

// ── Public API ─────────────────────────────────────────────────────────────

// Sync a finalized visit to its hospital's configured system. AUTO silently
// skips hospitals without an enabled integration; MANUAL/RETRY report why.
export async function syncVisit(
  visitId: string,
  triggeredBy: "AUTO" | "MANUAL" | "RETRY",
  existingLogId?: string,
): Promise<SyncResult> {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: { id: true, hospitalId: true, patientId: true },
  });
  if (!visit) return { ok: false, error: "Visit not found." };

  const integration = await prisma.hospitalIntegration.findUnique({ where: { hospitalId: visit.hospitalId } });
  if (!integration) {
    return triggeredBy === "AUTO"
      ? { ok: true, skipped: true }
      : { ok: false, error: "No integration configured for this hospital." };
  }
  if (!integration.syncEnabled && triggeredBy === "AUTO") return { ok: true, skipped: true };

  const config = resolveConfig(integration);

  // Log first so a crash mid-delivery still leaves a PENDING record.
  const log = existingLogId
    ? await prisma.integrationLog.update({
        where: { id: existingLogId },
        data: { status: "PENDING", triggeredBy, retryCount: { increment: 1 }, errorMessage: null },
      })
    : await prisma.integrationLog.create({
        data: {
          integrationId: integration.id,
          hospitalId: visit.hospitalId,
          patientId: visit.patientId,
          visitId,
          recordType: "VISIT",
          status: "PENDING",
          triggeredBy,
        },
      });

  try {
    const record = await buildStandardRecord(visitId);
    const adapter = getAdapter(config.integrationType);
    const payload = adapter.buildPayload(record, config);

    // CSV with no endpoint = file-export mode: payload is stored on the log
    // and downloadable from the dashboard instead of being transmitted.
    if (config.integrationType === "CSV" && !config.apiEndpoint) {
      await prisma.integrationLog.update({
        where: { id: log.id },
        data: {
          status: "SUCCESS",
          requestPayload: truncate(payload.body),
          responsePayload: "Stored for file export (no endpoint configured).",
        },
      });
      return { ok: true, logId: log.id };
    }

    const result = await deliver(payload, config);
    await prisma.integrationLog.update({
      where: { id: log.id },
      data: {
        status: "SUCCESS",
        requestPayload: truncate(payload.body),
        responsePayload: truncate(`HTTP ${result.httpStatus} ${result.responseBody}`),
        errorMessage: null,
      },
    });
    return { ok: true, logId: log.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.integrationLog.update({
      where: { id: log.id },
      data: { status: "FAILED", errorMessage: message.slice(0, 1000) },
    }).catch(() => {});
    return { ok: false, error: message, logId: log.id };
  }
}

export async function retryLog(logId: string): Promise<SyncResult> {
  const log = await prisma.integrationLog.findUnique({
    where: { id: logId },
    select: { id: true, visitId: true, status: true },
  });
  if (!log) return { ok: false, error: "Log entry not found." };
  if (!log.visitId) return { ok: false, error: "Log entry has no visit to re-sync." };
  return syncVisit(log.visitId, "RETRY", log.id);
}

// Connectivity check with a synthetic, PHI-free record.
export async function testIntegration(hospitalId: string): Promise<{ ok: boolean; detail: string }> {
  const integration = await prisma.hospitalIntegration.findUnique({
    where: { hospitalId },
    include: { hospital: { select: { name: true, shortCode: true } } },
  });
  if (!integration) return { ok: false, detail: "No integration configured." };

  const config = resolveConfig(integration);
  const record = buildSampleRecord(integration.hospital.name, integration.hospital.shortCode);
  const payload = getAdapter(config.integrationType).buildPayload(record, config);

  if (config.integrationType === "CSV" && !config.apiEndpoint) {
    return { ok: true, detail: "CSV file-export mode — payload built successfully; nothing to transmit." };
  }

  try {
    const result = await deliver(payload, { ...config, maxRetries: 1 });
    return { ok: true, detail: `HTTP ${result.httpStatus} — ${result.responseBody.slice(0, 200) || "acknowledged"}` };
  } catch (err: unknown) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
