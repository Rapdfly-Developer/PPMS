// Dose / frequency / duration suggestions for medication fields. Shared by the
// Plan tab's prescription and the General tab's current medications so both
// offer the same options.

export const FREQUENCY_OPTIONS = [
  "OD (Once daily)", "BD (Twice daily)", "TID (Three times daily)",
  "QID (Four times daily)", "5 times daily", "6 times daily",
  "Half an hourly", "Hourly", "2nd hourly", "3rd hourly", "4th hourly",
  "QHS (At bedtime)", "PRN (As needed)",
  "Stat (Immediately)",
];

export const DOSE_OPTIONS = [
  "1 drop", "2 drops",
  "½ tablet", "1 tablet", "2 tablets",
  "1 capsule", "2 capsules",
  "0.05 mL", "0.1 mL", "0.5 mL", "1 mL",
  "5 mL", "10 mL",
  "25 mg", "50 mg", "100 mg", "250 mg", "500 mg", "1 g",
];

export const DURATION_OPTIONS = [
  "1 day", "2 days", "3 days", "4 days", "5 days", "6 days", "7 days",
  "10 days", "14 days", "3 weeks", "4 weeks",
  "1 month", "2 months", "3 months", "6 months", "1 year",
  "Long-term",
];
