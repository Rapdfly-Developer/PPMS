import type { Section, TabId } from "./definitions";
import type { AnalyticsFilters } from "./filters";
import type { AnalyticsScope } from "./scope";
import {
  getOverview, getPatients, getAppointments, getClinical, getInvestigations,
  getSurgery, getFollowUps, getHospitals, getOperations, getActivity,
} from "./service";

/** Loads exactly one tab. The page only ever computes the tab being viewed. */
export function loadSection(tab: TabId, scope: AnalyticsScope, f: AnalyticsFilters): Promise<Section<unknown>> {
  switch (tab) {
    case "patients":       return getPatients(scope, f);
    case "appointments":   return getAppointments(scope, f);
    case "clinical":       return getClinical(scope, f);
    case "investigations": return getInvestigations(scope, f);
    case "surgery":        return getSurgery(scope, f);
    case "followups":      return getFollowUps(scope, f);
    case "hospitals":      return getHospitals(scope, f);
    case "operations":     return getOperations(scope, f);
    case "activity":       return getActivity(scope, f);
    default:               return getOverview(scope, f);
  }
}
