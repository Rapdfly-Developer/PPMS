const LATERALITY = new Set(["RE", "LE", "OU"]);
const UNIT = "(days?|weeks?|months?|years?|hours?)";

/** One chief complaint, ready for display. */
export interface ComplaintItem {
  lat: string | null;
  text: string;
  since: string | null;
}

/** "1 days" → "1 day", "3 day" → "3 days". */
function normalizeSince(n: string, unit: string): string {
  const num = Number(n);
  const base = unit.toLowerCase().replace(/s$/, "");
  return `${num} ${base}${num === 1 ? "" : "s"}`;
}

/** Keyword bullets ("• Redness\n• Itching") read as "Redness, Itching" so "•" only separates the parts. */
function normalizeText(text: string): string {
  const s = text.replace(/\r/g, "");
  const parts = s.includes("•") ? s.split("•") : s.split("\n");
  return parts.map((p) => p.replace(/^[\s\-*·]+/, "").trim()).filter(Boolean).join(", ");
}

/**
 * Parses every stored chief-complaint format into display items:
 *   booking form  "RE | Since: 3 days | Eye Pain"
 *   EMR           "[RE] [3 days] Eye Pain | [LE] Watering"
 *   legacy        plain text
 */
export function parseComplaintItems(raw: string | null | undefined): ComplaintItem[] {
  const value = raw?.trim();
  if (!value) return [];

  const parts = value.split(" | ");
  if (parts.length >= 3 && LATERALITY.has(parts[0].trim().toUpperCase())) {
    const m = parts[1].trim().match(new RegExp(`^Since:\\s*(\\d+)\\s*${UNIT}$`, "i"));
    if (m) {
      return [{ lat: parts[0].trim().toUpperCase(), text: normalizeText(parts.slice(2).join(" | ")), since: normalizeSince(m[1], m[2]) }];
    }
  }

  return value.split("|").map((seg) => {
    let rest = seg.trim();
    let lat: string | null = null;
    let since: string | null = null;
    const latM = rest.match(/^\[\s*(RE|LE|OU)\s*\]\s*/i);
    if (latM) { lat = latM[1].toUpperCase(); rest = rest.slice(latM[0].length); }
    const sinceM = rest.match(new RegExp(`^\\[\\s*(\\d+)\\s*${UNIT}\\s*\\]\\s*`, "i"));
    if (sinceM) { since = normalizeSince(sinceM[1], sinceM[2]); rest = rest.slice(sinceM[0].length); }
    return { lat, text: normalizeText(rest), since };
  }).filter((c) => c.text || c.lat);
}

/** The single display format: "RE • Blurred Vision • 8 days". */
export function complaintLabel(c: ComplaintItem): string {
  return [c.lat, c.text, c.since].filter(Boolean).join(" • ");
}

/** Plain-text form for non-chip contexts (search results, PDFs). Multiple complaints are separated by "; ". */
export function formatComplaintDisplay(raw: string | null | undefined): string {
  return parseComplaintItems(raw).map(complaintLabel).join("; ");
}


/**
 * Converts the "LAT | Since: N unit | text" string saved by the appointment
 * booking form into the "[LAT] [N unit] text" format expected by the EMR
 * Chief Complaint parser.  Returns the raw string unchanged when it is
 * already in EMR format or is plain text (legacy patient.complaint values).
 */
export function convertNotesToCC(raw: string): string {
  if (!raw) return raw;
  if (/^\[(RE|LE|OU)\]/.test(raw.trim())) return raw; // already EMR format
  const parts = raw.split(" | ");
  if (parts.length >= 3) {
    const lat = parts[0].trim();
    const sinceRaw = parts[1].trim();
    const text = parts.slice(2).join(" | ").trim();
    const m = sinceRaw.match(/^Since:\s*(\d+)\s+(days|weeks|months|years)$/i);
    if (LATERALITY.has(lat) && m) {
      return `[${lat}] [${m[1]} ${m[2].toLowerCase()}] ${text}`.trim();
    }
  }
  return raw;
}

/**
 * Reduces a stored chief complaint to just its text, dropping the laterality
 * and duration segments: "RE | Since: 3 days | Eye Pain" -> "Eye Pain",
 * "[RE] [5 days] Eye Pain" -> "Eye Pain".
 *
 * Used to build the Patients page's Chief Complaint filter, where one entry
 * per laterality/duration permutation would make the list unusable. The
 * result is matched back against the stored value with `contains`.
 */
export function complaintText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const first = raw.split("|")[0].trim();
  let out: string;
  const pipeParts = raw.split(" | ");
  if (pipeParts.length >= 3 && LATERALITY.has(first)) {
    out = pipeParts.slice(2).join(" | ");
  } else {
    // "[RE] [5 days] text" -> "text"; a plain legacy string falls through.
    out = raw.split("|")[0].replace(/^\s*\[(?:RE|LE|OU)\]\s*/i, "")
             .replace(/^\s*\[\d+\s+(?:days?|weeks?|months?|years?)\]\s*/i, "");
  }
  out = out.trim();
  return out.length > 0 ? out : null;
}
