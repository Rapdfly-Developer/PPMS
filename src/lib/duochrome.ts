/**
 * Duochrome Test (Subjective refraction): one comparison per eye, Red vs Green
 * ("=", ">" or "<"), stored in the eye's `duoRed`.
 *
 * Older visits stored separate Red and Green marks; a Green mark alone is read
 * as its mirror image (Green ">" means Red "<"), so those visits show in the
 * same Red ? Green form.
 */
const MIRROR: Record<string, string> = { ">": "<", "<": ">", "=": "=" };

export function duochromeValue(eye: { duoRed?: string; duoGreen?: string } | null | undefined): string {
  if (eye?.duoRed) return eye.duoRed;
  if (eye?.duoGreen) return MIRROR[eye.duoGreen] ?? "=";
  return "=";
}
