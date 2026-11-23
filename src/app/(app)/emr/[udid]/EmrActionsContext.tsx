"use client";

// The EMR tabs save through these functions. By default they are the real EMR
// server actions (nothing changes in the EMR). The IPD file's Doctor's Notes
// provides its own versions that write only to the file's copy of the EMR.

import { createContext, useContext } from "react";
import * as real from "./actions";
import type { IpdValues } from "@/lib/ipd-emr-copy";

const pick = {
  saveGeneralExam: real.saveGeneralExam,
  saveVisualAcuity: real.saveVisualAcuity,
  saveRefraction: real.saveRefraction,
  saveColourVision: real.saveColourVision,
  addIOPReading: real.addIOPReading,
  removeIOPReading: real.removeIOPReading,
  saveGonioNotes: real.saveGonioNotes,
  saveAnteriorSegment: real.saveAnteriorSegment,
  savePosteriorSegment: real.savePosteriorSegment,
  saveDiplopia: real.saveDiplopia,
  saveHess: real.saveHess,
  saveRetinoscopy: real.saveRetinoscopy,
  getRefractionForVisit: real.getRefractionForVisit,
  saveTearFilm: real.saveTearFilm,
  saveLacrimalSac: real.saveLacrimalSac,
  markOphthalmicReviewed: real.markOphthalmicReviewed,
  saveOculoplasty: real.saveOculoplasty,
  addMedication: real.addMedication,
  removeMedication: real.removeMedication,
  updateMedication: real.updateMedication,
  clearAllMedications: real.clearAllMedications,
  saveFollowUp: real.saveFollowUp,
  saveAdviseNotes: real.saveAdviseNotes,
  saveAnesthesiaType: real.saveAnesthesiaType,
  saveProcedureLaterality: real.saveProcedureLaterality,
  saveProcedureName: real.saveProcedureName,
  saveProcedureNotes: real.saveProcedureNotes,
  addInvestigationOrder: real.addInvestigationOrder,
  deleteInvestigationOrder: real.deleteInvestigationOrder,
  updateInvestigationStatus: real.updateInvestigationStatus,
  attachResult: real.attachResult,
  removeResult: real.removeResult,
  addExtraResult: real.addExtraResult,
  removeExtraResult: real.removeExtraResult,
  updateInvestigationDoctorNotes: real.updateInvestigationDoctorNotes,
  saveSurgicalCounselling: real.saveSurgicalCounselling,
  clearSurgicalCounselling: real.clearSurgicalCounselling,
  saveAdmission: real.saveAdmission,
  clearAdmission: real.clearAdmission,
};

export type EmrActions = typeof pick;

/** Set only inside the IPD Doctor's Notes copy of the EMR. */
export interface IpdNoteInfo {
  values: IpdValues;
  /** Saves the values that replace parts of the EMR (post-op medications, surgery, discharge note). */
  save: (patch: Partial<IpdValues>) => Promise<unknown>;
  /** The Treatment Chart's medicines as the note shows them (chart drugs less pending removes, plus pending adds). */
  /** Set when the user may discharge: the Discharge button asks to create the discharge summary instead of just taking a note. */
  onDischarge?: () => void;
  /** Set when the patient cannot be discharged now: why (shown when Discharge is clicked). */
  dischargeBlock?: string;
  meds?: { list: { id: string; name: string; dose: string; route: string; eye: string; frequency: string; instructions: string }[] };
}

const Ctx = createContext<{ actions: EmrActions; ipd: IpdNoteInfo | null }>({ actions: pick, ipd: null });

export const EmrActionsProvider = Ctx.Provider;
export const useEmrActions = () => useContext(Ctx).actions;
/** Non-null only in the IPD copy; the real EMR never sets it. */
export const useIpdNote = () => useContext(Ctx).ipd;
