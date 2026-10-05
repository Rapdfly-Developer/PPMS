/**
 * Cookie consent lifecycle tests (run with tsx; minimal browser stubs).
 * RF Health has no analytics/marketing service today, so these register
 * stand-in services to prove the gating any future service will inherit.
 */

// The consent modules only touch document/localStorage when called, never at
// import time, so static imports are safe ahead of the stubs below.
import { CONSENT_COOKIE, CONSENT_VERSION, getConsent, hasConsent, resetConsent, setConsent, updateConsent, ALL_ACCEPTED, ALL_REJECTED } from "../consent";
import { SERVICES } from "../services";
import { applyConsent, startedServices } from "../runtime";
import { track, routeTemplate } from "../track";

/* ── Minimal browser environment ─────────────────────────────────────────── */
const jar = new Map<string, string>();
const store = new Map<string, string>();
const g = globalThis as Record<string, unknown>;
g.location = { protocol: "https:", hostname: "ppmsai.com" };
g.document = {
  get cookie() { return [...jar].map(([k, v]) => `${k}=${v}`).join("; "); },
  set cookie(raw: string) {
    const [pair, ...attrs] = raw.split(";").map((s) => s.trim());
    const i = pair.indexOf("=");
    const name = pair.slice(0, i), value = pair.slice(i + 1);
    if (attrs.some((a) => /^max-age=0$/i.test(a))) jar.delete(name); else jar.set(name, value);
    lastCookieAttrs = attrs;
  },
};
let lastCookieAttrs: string[] = [];
g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
g.window = { dispatchEvent: () => true };
g.CustomEvent = class { constructor(public type: string, public init?: unknown) {} };

let passed = 0, failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  PASS ${name}`); } else { failed++; console.log(`  FAIL ${name}`); }
}

const calls: string[] = [];
const sent: unknown[] = [];
SERVICES.push(
  { id: "test-analytics", category: "analytics", cookiePrefixes: ["_ta"], start: () => calls.push("analytics:start"), stop: () => calls.push("analytics:stop"), track: (e) => sent.push(e) },
  { id: "test-marketing", category: "marketing", cookiePrefixes: ["_tm"], start: () => calls.push("marketing:start"), stop: () => calls.push("marketing:stop") },
);

console.log("Cookie consent lifecycle");

// 1. New visitor: no decision, nothing optional runs.
check("new visitor has no consent (banner shows)", getConsent() === null);
applyConsent(getConsent());
check("no optional service starts before a decision", calls.length === 0);
check("necessary is always granted", hasConsent("necessary"));

// 3. Reject All.
applyConsent(setConsent(ALL_REJECTED));
check("Reject All stores only necessary", JSON.stringify(getConsent() && [getConsent()!.functional, getConsent()!.analytics, getConsent()!.marketing]) === "[false,false,false]");
check("Reject All starts nothing (analytics + marketing OFF)", calls.length === 0);
check("consent cookie is Secure, SameSite=Lax, Path=/, expiring", ["Secure", "SameSite=Lax", "Path=/"].every((a) => lastCookieAttrs.includes(a)) && lastCookieAttrs.some((a) => a.startsWith("Max-Age=31536000")));
check("track() sends nothing without analytics consent", track("dashboard_view") === false && sent.length === 0);

// 6. Analytics ON (custom save): analytics only.
applyConsent(setConsent({ functional: true, analytics: true, marketing: false }));
check("Analytics ON starts analytics", calls.includes("analytics:start"));
check("Marketing OFF does not start marketing", !calls.includes("marketing:start"));

// 15. Healthcare data never leaves.
check("track() accepts a product event", track("appointments_page_view", { page: "/patients/PPMS-SEH-0001/visits?x=1" }) === true);
check("route template strips the UDID and query", JSON.stringify(sent.at(-1)) === JSON.stringify({ name: "appointments_page_view", page: "/patients/:id/visits" }));
check("free-text event names are rejected", track("Patient John Doe opened prescription") === false);
check("cuid / date segments are stripped", routeTemplate("/emr/cmt8n89bx0010asy7asgib9vp") === "/emr/:id");

// 2. Accept All.
applyConsent(setConsent(ALL_ACCEPTED));
check("Accept All starts marketing too", calls.includes("marketing:start"));
check("Accept All stores all four", !!getConsent()?.functional && !!getConsent()?.analytics && !!getConsent()?.marketing);

// Revocation: stop, remove cookies, clear functional storage.
jar.set("_ta_id", "x"); jar.set("_tm_px", "y"); store.set("sidebar-collapsed", "true");
applyConsent(updateConsent({ analytics: false, marketing: false, functional: false }));
check("revoking analytics stops it", calls.includes("analytics:stop") && !startedServices.has("test-analytics"));
check("revoking marketing stops it", calls.includes("marketing:stop"));
check("revoked services' cookies are deleted", !jar.has("_ta_id") && !jar.has("_tm_px"));
check("revoking functional clears remembered preferences", !store.has("sidebar-collapsed"));
check("no re-initialisation without new consent", (applyConsent(getConsent()), calls.filter((c) => c === "analytics:start").length === 1));

// 10. Expiry.
jar.set(CONSENT_COOKIE, encodeURIComponent(JSON.stringify({ v: CONSENT_VERSION, f: 1, a: 1, m: 1, t: new Date(Date.now() - 366 * 86_400_000).toISOString() })));
check("consent older than 365 days is treated as none", getConsent() === null);

// 11. Version change.
jar.set(CONSENT_COOKIE, encodeURIComponent(JSON.stringify({ v: "0.9", f: 1, a: 1, m: 1, t: new Date().toISOString() })));
check("consent from an older policy version is treated as none", getConsent() === null);

// Reset + tampering.
setConsent(ALL_ACCEPTED); resetConsent();
check("resetConsent forgets the decision", getConsent() === null);
jar.set(CONSENT_COOKIE, "not-json");
check("a malformed cookie is treated as no decision", getConsent() === null);

console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
