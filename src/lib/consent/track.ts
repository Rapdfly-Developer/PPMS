/**
 * The only way RF Health code may send an analytics event.
 *
 * Healthcare rule: events carry a product event name and a route template,
 * nothing else. `track()` enforces it rather than trusting callers:
 *   - the name must be a snake_case product event ("dashboard_view",
 *     "website_demo_clicked"); anything else is dropped;
 *   - the page is reduced to a template — any path segment containing a
 *     digit (UDIDs like PPMS-SEH-0001, cuids, dates) becomes ":id", and the
 *     query string and hash are dropped;
 *   - no other fields exist, so names, diagnoses or notes cannot be attached.
 * Nothing is sent without analytics consent, and with no analytics service
 * installed (the case today) it is a no-op.
 */

import { hasConsent } from "./consent";
import { SERVICES, type SafeEvent } from "./services";
import { startedServices } from "./runtime";

const EVENT_NAME = /^[a-z][a-z0-9_]{1,47}$/;

/** "/patients/PPMS-SEH-0001/visits?x=1" → "/patients/:id/visits" */
export function routeTemplate(path: string): string {
  const clean = path.split(/[?#]/)[0] || "/";
  return clean
    .split("/")
    .map((seg) => (/\d/.test(seg) || seg.length > 32 ? ":id" : seg))
    .join("/");
}

export function track(name: string, opts: { page?: string } = {}): boolean {
  if (!EVENT_NAME.test(name)) return false;
  if (!hasConsent("analytics")) return false;
  const event: SafeEvent = { name, ...(opts.page ? { page: routeTemplate(opts.page) } : {}) };
  let sent = false;
  for (const s of SERVICES) {
    if (s.category === "analytics" && s.track && startedServices.has(s.id)) {
      s.track(event);
      sent = true;
    }
  }
  return sent;
}
