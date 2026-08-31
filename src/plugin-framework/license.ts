/**
 * Plugin Licensing
 *
 * Per-plugin, per-doctor license checks — separate from the core
 * TenantLicense which covers base PPMS features. A doctor can hold an
 * active PPMS license but no plugin license (and vice versa).
 *
 * Uses a 15-second in-memory cache per (pluginId, doctorId) pair to
 * match the pattern in src/lib/license-guard.ts.
 */

import { prisma } from "@/lib/prisma";
import type { PluginLicenseStatus, PluginLicensingSpec } from "./types";

// ── In-memory cache ───────────────────────────────────────────────────────

type CacheEntry = { status: PluginLicenseStatus; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15_000;

function cacheKey(pluginId: string, doctorId: string) {
  return `${pluginId}:${doctorId}`;
}

// ── Public API ────────────────────────────────────────────────────────────

export type PluginLicenseInfo = {
  status: PluginLicenseStatus;
  trialEndsAt?: Date | null;
  expiresAt?: Date | null;
  usageCount: number;
  usageLimit: number | null;
  isBlocked: boolean;
};

/**
 * Check the license status for a plugin + doctor.
 * Result is cached for 15 seconds.
 */
export async function checkPluginLicense(
  pluginId: string,
  doctorId: string,
): Promise<PluginLicenseInfo> {
  const key = cacheKey(pluginId, doctorId);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    const row = await prisma.pluginLicense.findUnique({
      where: { pluginId_doctorId: { pluginId, doctorId } },
      select: { trialEndsAt: true, expiresAt: true, usageCount: true, usageLimit: true },
    });
    return {
      status: cached.status,
      trialEndsAt: row?.trialEndsAt,
      expiresAt: row?.expiresAt,
      usageCount: row?.usageCount ?? 0,
      usageLimit: row?.usageLimit ?? null,
      isBlocked: isBlockedStatus(cached.status),
    };
  }

  const row = await prisma.pluginLicense.findUnique({
    where: { pluginId_doctorId: { pluginId, doctorId } },
  });

  if (!row) {
    return {
      status: "EXPIRED",
      usageCount: 0,
      usageLimit: null,
      isBlocked: true,
    };
  }

  const now = new Date();
  let status: PluginLicenseStatus = row.status as PluginLicenseStatus;

  // Trial expiry check
  if (status === "TRIAL" && row.trialEndsAt && row.trialEndsAt < now) {
    status = "EXPIRED";
    // Update DB asynchronously — never block the check
    prisma.pluginLicense
      .update({
        where: { pluginId_doctorId: { pluginId, doctorId } },
        data: { status: "EXPIRED" },
      })
      .catch(() => {});
  }

  // Paid subscription expiry check
  if (status === "ACTIVE" && row.expiresAt && row.expiresAt < now) {
    status = "EXPIRED";
    prisma.pluginLicense
      .update({
        where: { pluginId_doctorId: { pluginId, doctorId } },
        data: { status: "EXPIRED" },
      })
      .catch(() => {});
  }

  // Cache the status
  cache.set(key, { status, expiresAt: Date.now() + CACHE_TTL_MS });

  return {
    status,
    trialEndsAt: row.trialEndsAt,
    expiresAt: row.expiresAt,
    usageCount: row.usageCount,
    usageLimit: row.usageLimit,
    isBlocked: isBlockedStatus(status),
  };
}

/**
 * Create a trial license for a newly installed plugin.
 * Idempotent — safe to call even if one already exists.
 */
export async function createPluginTrial(
  pluginId: string,
  doctorId: string,
  spec: PluginLicensingSpec,
): Promise<void> {
  const trialDays = spec.trialDays ?? 14;
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

  await prisma.pluginLicense.upsert({
    where: { pluginId_doctorId: { pluginId, doctorId } },
    update: {},
    create: {
      pluginId,
      doctorId,
      status: "TRIAL",
      trialEndsAt,
      usageLimit: spec.monthlyUsageLimit ?? null,
      usageResetAt: new Date(),
    },
  });

  // Invalidate cache
  cache.delete(cacheKey(pluginId, doctorId));
}

/**
 * Increment the usage counter for a plugin.
 * Resets the counter if the current month has rolled over.
 */
export async function incrementPluginUsage(
  pluginId: string,
  doctorId: string,
): Promise<{ allowed: boolean; usageCount: number; usageLimit: number | null }> {
  const row = await prisma.pluginLicense.findUnique({
    where: { pluginId_doctorId: { pluginId, doctorId } },
  });

  if (!row) return { allowed: false, usageCount: 0, usageLimit: null };

  // Monthly reset
  const now = new Date();
  const resetAt = row.usageResetAt ?? row.createdAt;
  const needsReset =
    now.getFullYear() !== resetAt.getFullYear() ||
    now.getMonth() !== resetAt.getMonth();

  const newCount = needsReset ? 1 : row.usageCount + 1;
  const allowed = row.usageLimit === null || newCount <= row.usageLimit;

  if (allowed) {
    await prisma.pluginLicense.update({
      where: { pluginId_doctorId: { pluginId, doctorId } },
      data: {
        usageCount: newCount,
        ...(needsReset ? { usageResetAt: now } : {}),
      },
    });
  }

  // Invalidate cache so the next check reflects updated count
  cache.delete(cacheKey(pluginId, doctorId));

  return { allowed, usageCount: newCount, usageLimit: row.usageLimit };
}

/** Invalidate cached license status for a plugin + doctor. */
export function invalidatePluginLicenseCache(pluginId: string, doctorId: string): void {
  cache.delete(cacheKey(pluginId, doctorId));
}

// ── Helpers ───────────────────────────────────────────────────────────────

function isBlockedStatus(status: PluginLicenseStatus): boolean {
  return status === "EXPIRED" || status === "SUSPENDED";
}
