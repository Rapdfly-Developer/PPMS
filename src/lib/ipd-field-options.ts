// Starter options for IPD / OT / Discharge text fields that have custom add.
// Each field also keeps the options added on this device (see customOptions.tsx).

import { ALL_IMPLANTS, ANAESTHESIA_OPTIONS, SURGERY_OPTIONS } from "@/lib/counselling";
import { DOSE_OPTIONS, DURATION_OPTIONS, FREQUENCY_OPTIONS } from "@/lib/medication-options";

export interface FieldOptions { storeKey: string; builtIns: readonly string[] }

const f = (storeKey: string, builtIns: readonly string[]): FieldOptions => ({ storeKey, builtIns });

export const FIELD_OPTIONS = {
  // IPD forms
  checklistRemark: f("checklist_remark", ["Doctor informed", "Corrected and rechecked", "To be done before shifting", "Not applicable"]),
  formNotes: f("form_notes", ["Patient prepared as per checklist", "Patient anxious, reassured", "Relatives informed", "Doctor informed"]),
  dietMeal: f("diet_meal", ["Idli, sambar", "Soft diet", "Rice, dal", "Chapati, vegetables", "Fruits", "Milk", "Tea, biscuits", "Light liquid diet"]),
  treatDose: f("treat_dose", DOSE_OPTIONS),
  treatInstructions: f("treat_instructions", ["Shake well before use", "5 min gap between drops", "Do not touch the bottle tip to the eye", "After food", "Before food"]),
  otProcedure: f("ot_procedure", SURGERY_OPTIONS),
  otAnaesthesia: f("ot_anaesthesia", ANAESTHESIA_OPTIONS),
  otImplant: f("ot_implant", ALL_IMPLANTS),
  otFindings: f("ot_findings", ["Uneventful", "Hard cataract", "Shallow anterior chamber", "Small pupil", "Weak zonules", "Posterior capsule intact"]),
  otInstructions: f("ot_instructions", ["Drops as advised", "Eye shield at night", "Avoid water in the eye", "Avoid heavy lifting and bending", "Review tomorrow"]),
  postopVision: f("postop_vision", ["6/6", "6/9", "6/12", "6/18", "6/24", "6/36", "6/60", "CF", "HM", "PL+", "NPL"]),
  postopComplaints: f("postop_complaints", ["No complaints", "Mild pain", "Watering", "Redness", "Foreign body sensation", "Blurred vision"]),
  postopPlan: f("postop_plan", ["Continue same treatment", "Taper steroid drops", "Review tomorrow", "Fit for discharge"]),
  // Discharge summary
  dcReferredTo: f("dc_referred_to", ["Retina specialist", "Glaucoma specialist", "Cornea specialist", "Physician", "Higher centre"]),
  dcSurgery: f("dc_surgery", SURGERY_OPTIONS),
  dcAnaesthesia: f("dc_anaesthesia", ANAESTHESIA_OPTIONS),
  dcImplant: f("dc_implant", ALL_IMPLANTS),
  dcHistory: f("dc_history", ["No significant past history", "Diabetes mellitus", "Hypertension", "Previous eye surgery"]),
  dcAnterior: f("dc_anterior", ["Quiet", "Clear cornea", "Deep and quiet AC", "PCIOL in place", "Mild corneal oedema"]),
  dcPosterior: f("dc_posterior", ["Normal fundus", "Media clear", "Retina attached", "Not visualised"]),
  dcFindings: f("dc_findings", ["Within normal limits"]),
  dcCourse: f("dc_course", ["Uneventful post-operative course", "Patient comfortable, vision improving"]),
  medDose: f("med_dose", DOSE_OPTIONS),
  medFrequency: f("med_frequency", FREQUENCY_OPTIONS),
  medDuration: f("med_duration", DURATION_OPTIONS),
  // IPD / OT file
  billingRemarks: f("billing_remarks", ["Insurance approval pending", "Cashless approved", "Advance received", "Final bill settled"]),
} as const;
