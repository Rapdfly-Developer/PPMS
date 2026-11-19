// Browser helper for /api/extract. Returns the checked values, or an error message.
import type { ArExtraction } from "@/lib/extract/ar";
import type { ImplantExtraction } from "@/lib/extract/implant";

export const EXTRACTABLE = /^(image\/(png|jpeg|webp)|application\/pdf)$/;

async function post<T>(file: File, kind: "ar" | "implant", group?: string): Promise<{ result?: T; error?: string }> {
  if (!EXTRACTABLE.test(file.type)) return { error: "Auto-fill reads PNG, JPEG, WebP or PDF files." };
  try {
    const body = new FormData();
    body.append("file", file);
    body.append("kind", kind);
    if (group) body.append("group", group);
    const res = await fetch("/api/extract", { method: "POST", body });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) return { error: json.error ?? "Auto-fill failed. Fill the values by hand." };
    return { result: json.result as T };
  } catch {
    return { error: "Auto-fill failed. Fill the values by hand." };
  }
}

export const extractAr = (file: File) => post<ArExtraction>(file, "ar");
export const extractImplant = (file: File, group: string) => post<ImplantExtraction>(file, "implant", group);
