"use client";

import { Capacitor } from "@capacitor/core";

/**
 * Opens a server-generated PDF.
 *
 * On the web this is just window.open — unchanged behaviour.
 *
 * Inside the Capacitor Android shell it is not. The WebView has no browser to
 * hand a _blank target to, so `window.open` and `<a target="_blank">` silently
 * do nothing, and navigating straight to the URL fails with
 * ERR_HTTP_RESPONSE_CODE_FAILURE because the WebView will not render an
 * application/pdf response. The working route is to fetch the bytes ourselves,
 * write them to the app's cache directory, and hand the file to the OS so the
 * device's own PDF viewer opens it.
 *
 * Every failure falls back to plain navigation: worst case the user gets the
 * same behaviour they have today rather than a dead button.
 */

const PDF_MIME = "application/pdf";

/**
 * Synchronous native check.
 *
 * Kept sync — and @capacitor/core imported statically rather than lazily —
 * because one caller (the Download PDF anchor in EmrActionBar) has to decide
 * whether to preventDefault() inside a click handler, and that cannot wait on
 * a promise. @capacitor/core is small; the heavyweight Filesystem/FileOpener
 * plugins below stay lazy so the web bundle never pulls them in.
 */
export function isNativeShell(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** `/api/prescription-pdf/abc123?dl=1` -> `prescription-pdf-abc123.pdf` */
function filenameFromUrl(url: string): string {
  const path = url.split("?")[0].replace(/^\/+|\/+$/g, "");
  const slug = path.replace(/^api\//, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "document"}.pdf`;
}

/** Blob -> bare base64 (Filesystem.writeFile rejects the data: prefix). */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * @param url       same-origin PDF route, e.g. `/api/prescription-pdf/<id>`
 * @param filename  optional override for the name the device shows
 */
export async function openPdfNative(url: string, filename?: string): Promise<void> {
  if (typeof window === "undefined") return;

  if (!isNativeShell()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { FileOpener } = await import("@capacitor-community/file-opener");

    // credentials: "include" matters — every one of these routes is auth-gated,
    // and a native fetch does not carry the session cookie by default.
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`PDF request failed: ${res.status}`);

    const blob = await res.blob();
    const data = await blobToBase64(blob);
    const path = filename ?? filenameFromUrl(url);

    // Directory.Cache, not Documents: these are transient copies the OS is free
    // to reclaim, and Cache needs no storage permission on any Android version.
    const written = await Filesystem.writeFile({ path, data, directory: Directory.Cache });

    // openWithDefault: false forces the chooser, so a device with no default PDF
    // app shows a picker instead of failing silently.
    await FileOpener.open({ filePath: written.uri, contentType: PDF_MIME, openWithDefault: false });
  } catch (err) {
    console.error("[open-pdf] native open failed, falling back to navigation", err);
    window.location.href = url;
  }
}
