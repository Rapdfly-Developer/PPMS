const LATERALITY = new Set(["RE", "LE", "OU"]);

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
