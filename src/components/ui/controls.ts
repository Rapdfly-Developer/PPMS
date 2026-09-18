/** Shared class strings for filter-panel controls.
 *
 * PatientsClient and AppointmentsClient each carried a byte-identical copy of
 * this string, and FollowUpsClient/PatientTimeline hand-rolled their own. That
 * duplication is why the same dropdown-sizing change had to be repeated per
 * screen. Import from here so a new filter panel inherits the sizing instead
 * of re-deriving it.
 *
 * Sizing note: the font size here is authored, not effective, on mobile --
 * see the <select> rule in globals.css.
 */
export const filterSelectClass =
  "border border-[var(--color-border)] bg-white rounded-lg pl-3 pr-8 py-2 text-sm " +
  "text-[var(--color-ink-700)] focus:outline-none focus:ring-2 " +
  "focus:ring-[var(--color-primary-400)] appearance-none cursor-pointer";
