import { createWorker } from "tesseract.js";
import path from "path";

const CACHE_PATH = process.env.VERCEL ? "/tmp/.tesseract-cache" : path.join(process.cwd(), ".tesseract-cache");

// Runs the uploaded scan through a local Tesseract.js worker. The English
// language model is downloaded once into .tesseract-cache and reused for
// every subsequent recognition, so this only needs network access on first run.
export async function recognizeText(filePath: string): Promise<string> {
  const worker = await createWorker("eng", 1, { cachePath: CACHE_PATH });
  try {
    const { data } = await worker.recognize(filePath);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

export type ExtractedFields = {
  rawText: string;
  sourceDate: string | null; // ISO date string
  sourceHospital: string | null;
  extractedDiagnosis: string | null;
  extractedTreatment: string | null;
};

const DATE_PATTERNS = [
  /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/, // dd/mm/yyyy or dd-mm-yyyy
  /\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/, // yyyy-mm-dd
  /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/i,
];

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseDate(text: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const m = text.match(pattern);
    if (!m) continue;
    try {
      if (pattern === DATE_PATTERNS[0]) {
        const [, d, mo, y] = m;
        const year = y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10);
        const date = new Date(year, parseInt(mo, 10) - 1, parseInt(d, 10));
        if (!isNaN(date.getTime())) return date.toISOString();
      } else if (pattern === DATE_PATTERNS[1]) {
        const [, y, mo, d] = m;
        const date = new Date(parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10));
        if (!isNaN(date.getTime())) return date.toISOString();
      } else {
        const [, d, monStr, y] = m;
        const month = MONTHS[monStr.toLowerCase().slice(0, 3)];
        const date = new Date(parseInt(y, 10), month, parseInt(d, 10));
        if (!isNaN(date.getTime())) return date.toISOString();
      }
    } catch {
      continue;
    }
  }
  return null;
}

function findLabelledLine(lines: string[], labels: string[]): string | null {
  for (const line of lines) {
    for (const label of labels) {
      const idx = line.toLowerCase().indexOf(label.toLowerCase());
      if (idx !== -1) {
        const value = line.slice(idx + label.length).replace(/^[:\-\s]+/, "").trim();
        if (value) return value;
      }
    }
  }
  return null;
}

function findHospitalLine(lines: string[]): string | null {
  const labelled = findLabelledLine(lines, ["Hospital:", "Clinic:", "Centre:", "Center:"]);
  if (labelled) return labelled;
  const candidate = lines.find((l) => /hospital|clinic|eye care|centre|center/i.test(l) && l.trim().length < 80);
  return candidate?.trim() || null;
}

// Best-effort structured-field extraction from unstructured OCR text. Real
// medical records vary widely in layout, so this looks for common labels
// first and falls back to heuristics; the Doctor reviews/corrects before
// the entry is marked "verified" (see PastExternalVisitsTab).
export function extractFields(rawText: string): ExtractedFields {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

  const sourceDate = parseDate(rawText);
  const sourceHospital = findHospitalLine(lines);
  const extractedDiagnosis = findLabelledLine(lines, ["Diagnosis:", "Dx:", "Impression:", "Provisional Diagnosis:"]);
  const extractedTreatment = findLabelledLine(lines, ["Treatment:", "Rx:", "Plan:", "Medication:", "Advice:"]);

  return { rawText, sourceDate, sourceHospital, extractedDiagnosis, extractedTreatment };
}
