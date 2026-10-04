import crypto from "crypto";
import path from "path";
import { readFile, writeFile, mkdir } from "fs/promises";

/**
 * Where uploaded files live.
 *
 * - "clinical" files (results, scans, AR slips, patient photos, Aadhaar,
 *   insurance documents) go to the PRIVATE Vercel Blob store when
 *   BLOB_PRIVATE_READ_WRITE_TOKEN is set. Private blobs cannot be opened
 *   from their URL; they are only served through /api/files, which checks
 *   the reader may see the patient. Until that store exists they fall back
 *   to the public store (unguessable URL, still served via /api/files).
 * - "branding" files (hospital logos, doctor signatures) stay in the public
 *   store: the PDF renderer loads them by URL.
 *
 * Clinical files are written under clinical/<uploaderUserId>/ so the
 * uploader can preview a file before it is attached to a record.
 */
export type UploadKind = "clinical" | "branding";

export const UPLOAD_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

const LOCAL_DIR = path.join(process.cwd(), "uploads", "files");
const LEGACY_LOCAL_DIRS = [path.join(process.cwd(), "uploads", "past-visits"), path.join(process.cwd(), "public", "uploads")];

const privateToken = () => process.env.BLOB_PRIVATE_READ_WRITE_TOKEN || "";
const publicToken = () => process.env.BLOB_READ_WRITE_TOKEN || "";

/** Store id embedded in a token ("vercel_blob_rw_<storeId>_<secret>"). */
function storeIdOf(token: string): string {
  return token.split("_")[3]?.toLowerCase() ?? "";
}

export function privateStoreConfigured(): boolean {
  return !!privateToken();
}

/** Save an upload and return the reference to store on the record. */
export async function storeUpload(file: File, kind: UploadKind, uploaderId: string): Promise<string> {
  // Extension from the validated MIME type, never from the client's file name.
  const ext = UPLOAD_TYPES[file.type] ?? ".bin";
  const name = `${crypto.randomUUID()}${ext}`;
  const key = kind === "clinical" ? `clinical/${uploaderId}/${name}` : `branding/${name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (kind === "clinical" && privateToken()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, buffer, { access: "private", contentType: file.type, token: privateToken() });
    return blob.url;
  }
  if (publicToken()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, buffer, { access: "public", contentType: file.type, token: publicToken() });
    return blob.url;
  }
  // Local development: write to uploads/files/, reference as "local:<key>".
  const localName = key.replace(/\//g, "__");
  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_DIR, localName), buffer);
  return `local:${localName}`;
}

/** True for refs that point at the private store. */
export function isPrivateRef(ref: string): boolean {
  const id = storeIdOf(privateToken());
  if (!id || !/^https:\/\//.test(ref)) return false;
  try { return new URL(ref).hostname.startsWith(id); } catch { return false; }
}

/** The uploader encoded in a clinical ref, if any. */
export function uploaderOf(ref: string): string | null {
  const m = ref.match(/clinical(?:\/|__)([^/_]+)(?:\/|__)/);
  return m ? m[1] : null;
}

const CONTENT_TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".pdf": "application/pdf" };

/** Read a stored file. Returns null when it does not exist or the ref is not ours. */
export async function readStoredFile(ref: string): Promise<{ body: ReadableStream<Uint8Array> | Buffer; contentType: string } | null> {
  if (/^https:\/\//.test(ref)) {
    let host: string;
    try { host = new URL(ref).hostname; } catch { return null; }
    if (!host.endsWith(".blob.vercel-storage.com")) return null; // never fetch arbitrary hosts (SSRF)

    if (isPrivateRef(ref)) {
      const { get } = await import("@vercel/blob");
      const res = await get(ref, { access: "private", token: privateToken() });
      if (!res || res.statusCode !== 200) return null;
      return { body: res.stream, contentType: res.blob.contentType };
    }
    const res = await fetch(ref);
    if (!res.ok || !res.body) return null;
    return { body: res.body, contentType: res.headers.get("content-type") ?? "application/octet-stream" };
  }

  // Local development files: "local:<name>" or a legacy bare file name.
  const name = ref.startsWith("local:") ? ref.slice(6) : ref;
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) return null;
  const dirs = ref.startsWith("local:") ? [LOCAL_DIR] : LEGACY_LOCAL_DIRS;
  for (const dir of dirs) {
    try {
      const buf = await readFile(path.join(dir, name));
      return { body: buf, contentType: CONTENT_TYPES[path.extname(name).toLowerCase()] ?? "application/octet-stream" };
    } catch { /* try next */ }
  }
  return null;
}
