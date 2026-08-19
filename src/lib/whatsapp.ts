// WhatsApp deep-link helper
// Generates a wa.me URL with a pre-filled message.
// Staff tap/click the link on their phone → WhatsApp opens with the text ready to send.
// No API key required — works with any WhatsApp account.

export function makeWhatsAppLink(mobile: string, text: string): string {
  // Normalise mobile: strip leading 0, add India country code if not present
  const digits = mobile.replace(/\D/g, "");
  const normalised = digits.startsWith("91") ? digits : `91${digits.replace(/^0/, "")}`;
  return `https://wa.me/${normalised}?text=${encodeURIComponent(text)}`;
}

export function surgeryBookingWhatsApp(d: {
  patientName:  string;
  surgeryName:  string;
  plannedDate:  string;
  plannedTime:  string;
  hospitalName: string;
  doctorName:   string;
  otRoom?:      string | null;
  mobile:       string;
}): string {
  const room = d.otRoom ? `, ${d.otRoom}` : "";
  const text =
    `Hello ${d.patientName},\n\nYour *${d.surgeryName}* has been scheduled:\n` +
    `📅 Date: ${d.plannedDate}\n` +
    `⏰ Time: ${d.plannedTime}${room}\n` +
    `🏥 Hospital: ${d.hospitalName}\n` +
    `👨‍⚕️ Surgeon: Dr. ${d.doctorName}\n\n` +
    `Please arrive 30 minutes before your scheduled time and bring all investigation reports.\n\n` +
    `For queries, please contact the hospital directly.`;
  return makeWhatsAppLink(d.mobile, text);
}

export function surgeryReminderWhatsApp(d: {
  patientName:  string;
  surgeryName:  string;
  plannedDate:  string;
  plannedTime:  string;
  hospitalName: string;
  otRoom?:      string | null;
  mobile:       string;
}): string {
  const room = d.otRoom ? `, ${d.otRoom}` : "";
  const text =
    `Reminder 🔔\n\nDear ${d.patientName},\n\n` +
    `Your *${d.surgeryName}* is scheduled for *TOMORROW*:\n` +
    `📅 ${d.plannedDate} at ${d.plannedTime}${room}\n` +
    `🏥 ${d.hospitalName}\n\n` +
    `⚠️ Important:\n` +
    `• Remain fasting from midnight\n` +
    `• Bring all investigation reports\n` +
    `• Arrive 30 minutes early\n` +
    `• Inform us if you have any new health concerns`;
  return makeWhatsAppLink(d.mobile, text);
}
