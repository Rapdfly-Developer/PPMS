/**
 * Plugin Gateway — Type Definitions
 *
 * Defines the safe, PII-controlled types that cross the gateway boundary.
 * Plugin code only sees these types — never raw Prisma models.
 */

import type { GatewayContext } from "../types";

// ── Gateway request ───────────────────────────────────────────────────────

export type GatewayRequest = {
  context: GatewayContext;
  /** The framework verifies the plugin is ENABLED before passing this. */
  pluginId: string;
};

// ── Gateway response wrapper ──────────────────────────────────────────────

export type GatewayResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

// ── Authorization result ──────────────────────────────────────────────────

export type AuthResult =
  | { authorized: true; context: GatewayContext }
  | { authorized: false; code: string; message: string };

// ── Tenant validation ─────────────────────────────────────────────────────

export type TenantScope = {
  doctorId: string;
  hospitalId: string;
  /** All hospitalIds linked to this doctor (for cross-hospital queries). */
  linkedHospitalIds: string[];
};
