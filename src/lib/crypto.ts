import crypto from "crypto";

// Lazy-initialized keys — scryptSync is expensive (~100ms) and must NOT run
// at module load time (Vercel's build phase evaluates modules with no memory
// budget for crypto). Keys are derived once on first actual encrypt/decrypt call.
const KDF_SALT = Buffer.from("ppms-aadhaar-kdf-v1");
let _key: Buffer | undefined;
let _legacyKey: Buffer | undefined;

function getKey(): Buffer {
  if (!_key) {
    const raw = process.env.AADHAAR_ENC_KEY || "dev-key";
    // scrypt with N=2^14 (~16 MB RAM, ~50 ms) — well above OWASP minimum.
    _key = crypto.scryptSync(raw, KDF_SALT, 32, { N: 1 << 14, r: 8, p: 1 });
  }
  return _key;
}

// Pre-scrypt records were encrypted with a bare SHA-256-derived key.
// Keep for decryption fallback only; all new writes use the scrypt key.
function getLegacyKey(): Buffer {
  if (!_legacyKey) {
    const raw = process.env.AADHAAR_ENC_KEY || "dev-key";
    _legacyKey = crypto.createHash("sha256").update(raw).digest();
  }
  return _legacyKey;
}

export function encryptAadhaar(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
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
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    // Fall back to legacy SHA-256-derived key for records encrypted before scrypt migration
    const decipher = crypto.createDecipheriv("aes-256-gcm", getLegacyKey(), iv);
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
