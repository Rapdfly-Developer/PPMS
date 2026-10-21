/** The three kinds of No Show Registry record, with their display labels (client-safe). */
export type NoShowKind = "INCOMPLETE_VISIT" | "APPOINTMENT_NO_SHOW" | "FOLLOW_UP_NO_SHOW";

export const NO_SHOW_KIND_LABEL: Record<NoShowKind, string> = {
  INCOMPLETE_VISIT:    "Incomplete visit",
  APPOINTMENT_NO_SHOW: "Appointment no-show",
  FOLLOW_UP_NO_SHOW:   "Follow-up no-show",
};

export const NO_SHOW_KIND_ORDER: NoShowKind[] = ["INCOMPLETE_VISIT", "APPOINTMENT_NO_SHOW", "FOLLOW_UP_NO_SHOW"];
