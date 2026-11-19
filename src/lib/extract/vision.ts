/**
 * Reads a document image with the vision models and returns the JSON they find.
 *
 * Every configured provider is asked the same question in parallel, so the
 * caller can cross-check the answers. Nothing here knows about patients: the
 * file is sent as is, with no patient details added to the prompt.
 *
 * Environment (same keys as the AI Chat):
 *   GEMINI_API_KEY, GEMINI_MODEL           reads images and PDFs
 *   GROQ_API_KEY, GROQ_VISION_MODEL        reads images only
 */

export type VisionRead = { provider: "gemini" | "groq"; data: Record<string, unknown> };

const TIMEOUT_MS = 60_000;

function parseJson(text: string): Record<string, unknown> | null {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const v = JSON.parse(cleaned);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function askGemini(system: string, mime: string, base64: string): Promise<VisionRead | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: system }, { inline_data: { mime_type: mime, data: base64 } }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    console.error(`[extract] gemini answered ${res.status}`, (await res.text().catch(() => "")).slice(0, 300));
    return null;
  }
  const json = await res.json();
  const text: unknown = json?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => typeof p.text === "string")?.text;
  const data = typeof text === "string" ? parseJson(text) : null;
  return data ? { provider: "gemini", data } : null;
}

async function askGroq(system: string, mime: string, base64: string): Promise<VisionRead | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key || mime === "application/pdf") return null;
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: system },
            { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    console.error(`[extract] groq answered ${res.status}`, (await res.text().catch(() => "")).slice(0, 300));
    return null;
  }
  const json = await res.json();
  const text: unknown = json?.choices?.[0]?.message?.content;
  const data = typeof text === "string" ? parseJson(text) : null;
  return data ? { provider: "groq", data } : null;
}

export function visionConfigured(): boolean {
  return !!(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);
}

/** Asks every available provider; returns the answers that came back usable. */
export async function readDocument(prompt: string, mime: string, bytes: Buffer): Promise<VisionRead[]> {
  const base64 = bytes.toString("base64");
  const settled = await Promise.allSettled([askGemini(prompt, mime, base64), askGroq(prompt, mime, base64)]);
  return settled.flatMap((r) => {
    if (r.status === "rejected") {
      console.error("[extract] provider failed", r.reason);
      return [];
    }
    return r.value ? [r.value] : [];
  });
}
