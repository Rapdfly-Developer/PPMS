/**
 * Optional services and what each consent category is allowed to start.
 *
 * Today this registry is deliberately small: the October 2026 audit found no
 * analytics or marketing service anywhere in RF Health, so nothing is
 * registered for those categories and nothing loads. To add one later,
 * register it here — it will start only after consent, stop on revocation,
 * and have its cookies removed:
 *
 *   {
 *     id: "example-analytics",
 *     category: "analytics",
 *     cookiePrefixes: ["_ga"],               // removed when consent is withdrawn
 *     start: () => { ...load script... },     // called only with consent
 *     stop: () => { ...disable / opt out... },
 *     track: (event) => { ...send event... }, // receives sanitised events only
 *   }
 *
 * Functional storage keys listed here are cleared when functional consent is
 * withdrawn.
 */

import type { OptionalCategory } from "./consent";

export interface ConsentService {
  id: string;
  category: OptionalCategory;
  /** Cookie name prefixes this service sets, removed on revocation. */
  cookiePrefixes?: string[];
  start: () => void;
  stop?: () => void;
  track?: (event: SafeEvent) => void;
}

/** What an analytics event may contain: a product event name and a route
 *  template — never names, IDs, diagnoses or any clinical content. */
export interface SafeEvent {
  name: string;
  page?: string;
}

export const SERVICES: ConsentService[] = [];

/** localStorage keys that only exist to remember optional preferences. */
export const FUNCTIONAL_STORAGE_KEYS = ["sidebar-collapsed"];
