// Signed consents are locked: once the scanned signed copy is uploaded the
// consent can't be changed, replaced or deleted until someone unlocks it with
// their own login password (recorded in the audit log). Shared by Counselling
// and the IPD Consents form.

import { prisma } from "@/lib/prisma";

type Item = { id: string; signedFile?: unknown; unfrozen?: unknown } & Record<string, unknown>;

const itemsOf = (x: unknown): Item[] => {
  const o = (typeof x === "string" ? safeParse(x) : x) as { items?: unknown } | null;
  return Array.isArray(o?.items) ? (o!.items as Item[]).filter((i) => i && typeof i.id === "string") : [];
};
function safeParse(s: string): unknown { try { return JSON.parse(s); } catch { return null; } }

/** Locked: a signed copy is on file and it has not been unlocked. */
export { isConsentLocked } from "@/lib/consent-lock-state";
import { isConsentLocked } from "@/lib/consent-lock-state";

/**
 * The consents to store: every consent that is locked in the stored copy is
 * kept exactly as stored (also if the incoming list changed or dropped it).
 */
export function keepLockedConsents(before: unknown, after: unknown): unknown {
  const locked = itemsOf(before).filter(isConsentLocked);
  if (!locked.length || !after || typeof after !== "object") return after;
  const byId = new Map(locked.map((i) => [i.id, i]));
  const incoming = itemsOf(after);
  const ids = new Set(incoming.map((i) => i.id));
  const items = [...incoming.map((i) => byId.get(i.id) ?? i), ...locked.filter((i) => !ids.has(i.id))];
  return { ...(after as object), items };
}

/** Sets or clears the unlock on one consent of a stored consents sheet. */
export function withUnlock(sheet: unknown, consentId: string, unfrozen: { by: string; at: string } | undefined): { items: Item[] } & Record<string, unknown> {
  const base = ((typeof sheet === "string" ? safeParse(sheet) : sheet) ?? { v: 2 }) as Record<string, unknown>;
  return { ...base, items: itemsOf(base).map((i) => (i.id === consentId ? { ...i, unfrozen } : i)) };
}

/** True when the password is the signed-in user's own login password. */
export async function checkOwnPassword(userId: string, password: string): Promise<boolean> {
  if (!password) return false;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!u?.passwordHash) return false;
  const bcrypt = await import("bcryptjs");
  return bcrypt.compare(password, u.passwordHash);
}
