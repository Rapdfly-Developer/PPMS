// Signed license keys: PPMS-XXXX-XXXX-XXXX-CCCC
//
// The first three groups are random; the fourth is a checksum — an HMAC of
// the random part keyed with the server secret, mapped onto the same A–Z0–9
// alphabet. Only keys minted with the secret verify, so a key that merely
// "looks right" is rejected before any database lookup.

import crypto from "crypto";

const SECRET =
  process.env.LICENSE_SECRET ?? process.env.AUTH_SECRET ?? "ppms-license-guard";

// Unambiguous alphabet (no I/O/0/1) for the random part — easier to read out
// over the phone. The checksum may use the full A–Z0–9 range.
const RANDOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CHECKSUM_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export const LICENSE_KEY_RE = /^PPMS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function checksumFor(randomPart: string): string {
  const mac = crypto.createHmac("sha256", SECRET).update(`PPMS-${randomPart}`).digest();
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += CHECKSUM_ALPHABET[mac[i] % CHECKSUM_ALPHABET.length];
  }
  return out;
}

/** Mint a new signed key: PPMS-XXXX-XXXX-XXXX-CCCC */
export function generateLicenseKey(): string {
  const bytes = crypto.randomBytes(12);
  let random = "";
  for (let i = 0; i < 12; i++) {
    random += RANDOM_ALPHABET[bytes[i] % RANDOM_ALPHABET.length];
    if (i === 3 || i === 7) random += "-";
  }
  return `PPMS-${random}-${checksumFor(random)}`;
}

/** True when the key's checksum group was produced with our secret. */
export function verifyLicenseKeyChecksum(key: string): boolean {
  const k = key.trim().toUpperCase();
  if (!LICENSE_KEY_RE.test(k)) return false;
  const parts = k.split("-"); // ["PPMS", g1, g2, g3, checksum]
  const randomPart = `${parts[1]}-${parts[2]}-${parts[3]}`;
  const expected = checksumFor(randomPart);
  return crypto.timingSafeEqual(Buffer.from(parts[4]), Buffer.from(expected));
}
