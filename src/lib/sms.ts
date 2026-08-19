// SMS sender — Fast2SMS (https://fast2sms.com)
// Requires FAST2SMS_API_KEY in environment variables.
// When the key is absent (dev/test), messages are printed to console instead.
//
// NOTE: Transactional SMS in India requires DLT template registration.
// Register templates at https://fast2sms.com → DLT Templates before going live.

const API_KEY = process.env.FAST2SMS_API_KEY ?? "";

async function sendFast2Sms(mobile: string, message: string): Promise<void> {
  if (!API_KEY) {
    console.log(`[sms:dev] To ${mobile}: ${message}`);
    return;
  }

  const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: API_KEY },
    body: JSON.stringify({
      route: "q",           // Quick (transactional) route — DLT template required
      message,
      numbers: mobile,
      flash: 0,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!data.return) {
    console.error(`[sms] Fast2SMS error: ${JSON.stringify(data)}`);
    // Non-fatal — log and continue so a failed SMS never breaks the main action
  }
}

export async function sendOtp(mobile: string, otp: string): Promise<void> {
  if (!API_KEY) {
    console.log(`[sms:dev] OTP for ${mobile}: ${otp}`);
    return;
  }

  const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: { "Content-Type": "application/json", authorization: API_KEY },
    body: JSON.stringify({ route: "otp", variables_values: otp, numbers: mobile, flash: 0 }),
  });

  const data = await res.json().catch(() => ({}));
  if (!data.return) {
    throw new Error(`[sms] Fast2SMS error: ${JSON.stringify(data)}`);
  }
}

// ── Surgery alerts ─────────────────────────────────────────────────────────

export interface SurgeryAlertData {
  patientName:  string;
  surgeryName:  string;
  plannedDate:  string;   // "20 Aug 2026"
  plannedTime:  string;   // "08:30 AM"
  hospitalName: string;
  doctorName:   string;
  otRoom?:      string | null;
}

export async function sendSurgeryBooking(mobile: string, d: SurgeryAlertData): Promise<void> {
  const room = d.otRoom ? `, ${d.otRoom}` : "";
  const msg =
    `Dear ${d.patientName}, your ${d.surgeryName} has been scheduled on ${d.plannedDate} at ${d.plannedTime}${room} at ${d.hospitalName} with Dr. ${d.doctorName}. Please arrive 30 min early. -PPMS`;
  await sendFast2Sms(mobile, msg).catch(() => {});
}

export async function sendSurgeryReminder(mobile: string, d: SurgeryAlertData): Promise<void> {
  const room = d.otRoom ? `, ${d.otRoom}` : "";
  const msg =
    `Reminder: ${d.patientName}, your ${d.surgeryName} is TOMORROW (${d.plannedDate}) at ${d.plannedTime}${room}, ${d.hospitalName}. Please remain fasting from midnight. Bring all reports. -PPMS`;
  await sendFast2Sms(mobile, msg).catch(() => {});
}

export async function sendSurgeryCancellation(mobile: string, d: Pick<SurgeryAlertData, "patientName" | "surgeryName" | "plannedDate" | "hospitalName">): Promise<void> {
  const msg =
    `Dear ${d.patientName}, your ${d.surgeryName} scheduled for ${d.plannedDate} at ${d.hospitalName} has been CANCELLED. Please contact us for rescheduling. -PPMS`;
  await sendFast2Sms(mobile, msg).catch(() => {});
}
