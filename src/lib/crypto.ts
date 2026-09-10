import crypto from "crypto";

// Derive AES-256-GCM key using scrypt (NIST-recommended KDF).
// Fixed salt is fine here — the secret is in the env var, not a user password.
const KDF_SALT = Buffer.from("ppms-aadhaar-kdf-v1");
const RAW_KEY = process.env.AADHAAR_ENC_KEY || "dev-key";

const KEY = crypto.scryptSync(RAW_KEY, KDF_SALT, 32, { N: 1 << 15, r: 8, p: 1 });

// Pre-scrypt records were encrypted with a bare SHA-256 key. Keep for decryption
// fallback only; all new writes use the scrypt key above.
const LEGACY_KEY = crypto.createHash("sha256").update(RAW_KEY).digest();

export function encryptAadhaar(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptAadhaar(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    // Fall back to legacy SHA-256-derived key for records encrypted before scrypt migration
    const decipher = crypto.createDecipheriv("aes-256-gcm", LEGACY_KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  }
}

// Generic secret encryption (integration credentials, API keys) — same
// AES-256-GCM scheme as Aadhaar but kept as separate exports so callers
// signal intent.
export const encryptSecret = encryptAadhaar;
export const decryptSecret = decryptAadhaar;

export function maskAadhaar(plain: string): string {
  const digits = plain.replace(/\D/g, "");
  if (digits.length < 4) return "XXXX XXXX XXXX";
  const last4 = digits.slice(-4);
  return `XXXX XXXX ${last4}`;
}
