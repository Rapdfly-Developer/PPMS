/**
 * Browser-facing address for a stored file reference (a blob URL, or a local
 * development file name). Every clinical file is opened through /api/files,
 * which checks the viewer may see the patient — never via the raw storage URL.
 */
export function fileHref(ref: string | null | undefined): string | null {
  if (!ref) return null;
  return `/api/files?ref=${encodeURIComponent(ref)}`;
}
