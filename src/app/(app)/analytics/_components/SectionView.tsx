"use client";

import type { Section, TabId } from "@/lib/analytics/definitions";
import type {
  OverviewData, PatientsData, AppointmentsData, ClinicalData, InvestigationsData,
  SurgeryData, FollowUpsData, HospitalsData, OperationsData, ActivityData,
} from "@/lib/analytics/service";
import { SectionError } from "./ui";
import {
  OverviewView, PatientsView, AppointmentsView, ClinicalView, InvestigationsView,
  SurgeryView, FollowUpsView, HospitalsView, OperationsView, ActivityView, type ViewCtx,
} from "./views";

export function SectionView({ tab, section, ctx }: { tab: TabId; section: Section<unknown>; ctx: ViewCtx }) {
  if (!section.ok) return <SectionError message={section.error} />;
  const d = section.data;
  switch (tab) {
    case "patients":       return <PatientsView data={d as PatientsData} ctx={ctx} />;
    case "appointments":   return <AppointmentsView data={d as AppointmentsData} ctx={ctx} />;
    case "clinical":       return <ClinicalView data={d as ClinicalData} ctx={ctx} />;
    case "investigations": return <InvestigationsView data={d as InvestigationsData} ctx={ctx} />;
    case "surgery":        return <SurgeryView data={d as SurgeryData} ctx={ctx} />;
    case "followups":      return <FollowUpsView data={d as FollowUpsData} ctx={ctx} />;
    case "hospitals":      return <HospitalsView data={d as HospitalsData} ctx={ctx} />;
    case "operations":     return <OperationsView data={d as OperationsData} ctx={ctx} />;
    case "activity":       return <ActivityView data={d as ActivityData} ctx={ctx} />;
    default:               return <OverviewView data={d as OverviewData} ctx={ctx} />;
  }
}
