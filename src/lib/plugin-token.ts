/**
 * Plugin Token — HMAC-signed JWT for external plugin authentication
 *
 * External plugins (deployed as separate projects) cannot share the PPMS
 * session cookie. Instead PPMS Core issues a short-lived signed token that
 * the external plugin presents on every API request.
 *
 * Security properties:
 *   - HMAC-SHA256 signature using PLUGIN_TOKEN_SECRET (server-side only)
 *   - 10-minute maximum lifetime (hard-coded ceiling)
 *   - jti (UUID) per token, for correlation in audit logs
 *   - No patient medical data — only identifiers and permissions
 *   - Token never placed in URLs (caller's responsibility)
 */

import { createHmac, randomUUID } from "crypto";

// ── Environment guard ─────────────────────────────────────────────────────

function getSecret(): string {
  const secret = process.env.PLUGIN_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "PLUGIN_TOKEN_SECRET is missing or too short (minimum 32 characters / 256 bits).",
    );
  }
  return secret;
}

// ── Token payload ─────────────────────────────────────────────────────────

export type PluginTokenPayload = {
  /** Token issuer — always "ppms-core" */
  iss: string;
  /** Plugin ID this token was issued to */
  sub: string;
  /** Unique token ID for replay protection */
  jti: string;
  doctorId: string;
  hospitalId: string;
  /** Patient reference (udid, patientId or uhid) the token is scoped to */
  patientRef: string;
  /** Active visit ID when token was issued */
  visitId: string;
  /** Resolved pluginId — duplicates sub for clarity at verification */
  pluginId: string;
  /** Plugin permissions the doctor holds (PPMS role permissions) */
  permissions: string[];
  /**
   * Data-access scopes this token grants, derived from manifest.requiredApis
   * at issuance time. The server populates this — clients cannot choose or
   * expand scopes. Tampering invalidates the HMAC signature.
   *
   * Each scope corresponds to one /api/v1/patients/* endpoint group:
   *   "patient.demographics" → GET /api/v1/patients/[ref]
   *   "visit.history"        → GET /api/v1/patients/[ref]/visits
   *   "visit.context"        → GET /api/v1/patients/[ref]/visits/[id]
   *   "appointment.history"  → GET /api/v1/patients/[ref]/appointments
   *   "patient.timeline"     → GET /api/v1/patients/[ref]/timeline
   */
  dataScopes: string[];
  /** Issued-at (unix seconds) */
  iat: number;
  /** Expiry (unix seconds) — maximum 10 minutes from iat */
  exp: number;
};

// ── Why there is no single-use replay protection ──────────────────────────
//
// An earlier version of this file carried a jti replay store (markSeen /
// isSeen) that nothing ever called, and a test asserting a token fails on
// second use. Both were removed rather than wired up, because single-use
// tokens are incompatible with how the gateway is actually consumed:
// ppms-copilot's fetchContext issues up to FIVE concurrent /api/v1 calls
// (patient, visit, visits, appointments, timeline) under one token via
// Promise.all. Enforcing single use would have rejected four of those five on
// the very first generation.
//
// What does bound a stolen token: a 600-second hard expiry (MAX_LIFETIME_
// SECONDS, enforced below), an HMAC signature over a payload that pins
// doctorId, hospitalId, patientRef, visitId and dataScopes, and delivery only
// via an origin-targeted postMessage — never a URL, log or referrer.
//
// If single-use is ever genuinely wanted, it needs a per-call nonce issued
// alongside the token, not a jti store — and the Copilot's concurrent fetch
// has to change at the same time, or it breaks on the first request.

// ── Base64url helpers ─────────────────────────────────────────────────────

function b64url(data: string): string {
  return Buffer.from(data).toString("base64url");
}

function fromB64url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

// ── Sign ──────────────────────────────────────────────────────────────────

const HEADER = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
const MAX_LIFETIME_SECONDS = 600; // 10 minutes hard ceiling

export type SignOptions = {
  doctorId: string;
  hospitalId: string;
  patientRef: string;
  visitId: string;
  pluginId: string;
  permissions: string[];
  /**
   * Data-access scopes to embed. Pass manifest.requiredApis from the
   * plugin-token issuance route. Never accept this from the client.
   */
  dataScopes: string[];
  /** Lifetime in seconds — capped at 600 regardless of what is passed. */
  lifetimeSec?: number;
};

/**
 * Issue a signed plugin token. Throws if PLUGIN_TOKEN_SECRET is not set
 * or is too short.
 */
export function signPluginToken(opts: SignOptions): string {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);
  const lifetime = Math.min(opts.lifetimeSec ?? MAX_LIFETIME_SECONDS, MAX_LIFETIME_SECONDS);

  const payload: PluginTokenPayload = {
    iss: "ppms-core",
    sub: opts.pluginId,
    jti: randomUUID(),
    doctorId: opts.doctorId,
    hospitalId: opts.hospitalId,
    patientRef: opts.patientRef,
    visitId: opts.visitId,
    pluginId: opts.pluginId,
    permissions: opts.permissions,
    dataScopes: opts.dataScopes,
    iat: now,
    exp: now + lifetime,
  };

  const encodedPayload = b64url(JSON.stringify(payload));
  const signingInput = `${HEADER}.${encodedPayload}`;
  const signature = createHmac("sha256", secret)
    .update(signingInput)
    .digest("base64url");

  return `${signingInput}.${signature}`;
}

// ── Verify ────────────────────────────────────────────────────────────────

export type VerifyResult =
  | { ok: true; payload: PluginTokenPayload }
  | { ok: false; reason: "MISSING" | "MALFORMED" | "SIGNATURE" | "EXPIRED" };

/**
 * Verify a plugin token from a Bearer Authorization header.
 *
 * Returns ok:false for every failure mode without distinguishing whether
 * the token exists or is simply invalid — callers must return 401 in all
 * failure cases to avoid leaking information.
 */
export function verifyPluginToken(authorizationHeader: string | null): VerifyResult {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return { ok: false, reason: "MISSING" };
  }

  const token = authorizationHeader.slice(7).trim();
  const parts = token.split(".");

  if (parts.length !== 3) {
    return { ok: false, reason: "MALFORMED" };
  }

  const [encodedHeader, encodedPayload, receivedSig] = parts;

  // Signature check
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return { ok: false, reason: "MALFORMED" };
  }

  const expectedSig = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  if (!timingSafeEqual(expectedSig, receivedSig)) {
    return { ok: false, reason: "SIGNATURE" };
  }

  // Parse payload
  let payload: PluginTokenPayload;
  try {
    payload = JSON.parse(fromB64url(encodedPayload)) as PluginTokenPayload;
  } catch {
    return { ok: false, reason: "MALFORMED" };
  }

  // Validate required fields
  if (
    !payload.jti ||
    !payload.doctorId ||
    !payload.pluginId ||
    !payload.patientRef ||
    !payload.exp ||
    !payload.iat ||
    !Array.isArray(payload.dataScopes)
  ) {
    return { ok: false, reason: "MALFORMED" };
  }

  // Expiry check
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    return { ok: false, reason: "EXPIRED" };
  }

  return { ok: true, payload };
}

// ── Constant-time string comparison ──────────────────────────────────────

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a comparison to avoid timing leaks on length
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ (b.charCodeAt(i % b.length) ?? 0);
    }
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
