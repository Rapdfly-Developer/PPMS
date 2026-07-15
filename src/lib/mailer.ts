import { Resend } from "resend";
import nodemailer from "nodemailer";

// In production use Resend API; locally fall back to MailHog (SMTP).
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const SMTP_TRANSPORT = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: parseInt(process.env.SMTP_PORT || "1025", 10),
  secure: false,
  ignoreTLS: true,
});

const FROM = process.env.EMAIL_FROM || "PPMS <onboarding@resend.dev>";

export async function sendMail(to: string | undefined | null, subject: string, html: string) {
  if (!to) {
    console.warn(`[mailer] Skipped "${subject}" - no recipient email on file.`);
    return;
  }
  try {
    if (resend) {
      // Production: Resend API
      const { error } = await resend.emails.send({ from: FROM, to, subject, html });
      if (error) console.error(`[mailer] Resend error "${subject}" to ${to}:`, error.message);
    } else {
      // Development: MailHog / local SMTP
      await SMTP_TRANSPORT.sendMail({ from: FROM, to, subject, html });
    }
  } catch (err) {
    console.error(`[mailer] Failed to send "${subject}" to ${to}:`, (err as Error).message);
  }
}

function card(title: string, rows: { label: string; value: string }[]): string {
  const rowsHtml = rows
    .map((r) => `<tr><td style="padding:4px 12px 4px 0;color:#5C6E76;font-size:12px;">${r.label}</td><td style="padding:4px 0;font-weight:600;font-size:13px;">${r.value}</td></tr>`)
    .join("");
  return `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
    <div style="background:#115E59;color:white;padding:16px 20px;border-radius:12px 12px 0 0;font-size:16px;font-weight:700;">PPMS</div>
    <div style="border:1px solid #E2E6E8;border-top:none;border-radius:0 0 12px 12px;padding:20px;">
      <h2 style="margin:0 0 12px;font-size:15px;color:#14242B;">${title}</h2>
      <table>${rowsHtml}</table>
    </div>
  </div>`;
}

export async function sendTrialVerificationOtp(to: string, code: string) {
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
    <div style="background:#115E59;color:white;padding:16px 20px;border-radius:12px 12px 0 0;font-size:16px;font-weight:700;">PPMS</div>
    <div style="border:1px solid #E2E6E8;border-top:none;border-radius:0 0 12px 12px;padding:28px 24px;">
      <h2 style="margin:0 0 8px;font-size:17px;color:#14242B;">Verify your email address</h2>
      <p style="margin:0 0 20px;font-size:13px;color:#5C6E76;">Use the code below to complete your PPMS free trial registration. It expires in 10 minutes.</p>
      <div style="text-align:center;background:#f0fcfa;border:2px solid #b8dcd6;border-radius:12px;padding:20px 0;margin-bottom:20px;">
        <span style="font-size:36px;font-weight:900;letter-spacing:12px;color:#115E59;">${code}</span>
      </div>
      <p style="font-size:11px;color:#9aacb2;margin:0;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  </div>`;
  await sendMail(to, "Your PPMS verification code", html);
}

export async function sendPasswordResetOtp(to: string, code: string) {
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
    <div style="background:#115E59;color:white;padding:16px 20px;border-radius:12px 12px 0 0;font-size:16px;font-weight:700;">🔒 PPMS Password Reset</div>
    <div style="border:1px solid #E2E6E8;border-top:none;border-radius:0 0 12px 12px;padding:28px 24px;">
      <h2 style="margin:0 0 8px;font-size:17px;color:#14242B;">Reset your password</h2>
      <p style="margin:0 0 20px;font-size:13px;color:#5C6E76;">
        You requested a password reset for your PPMS account. Use the code below — it expires in <strong>5 minutes</strong>.
      </p>
      <div style="text-align:center;background:#f0fcfa;border:2px solid #b8dcd6;border-radius:12px;padding:20px 0;margin-bottom:20px;">
        <span style="font-size:36px;font-weight:900;letter-spacing:12px;color:#115E59;">${code}</span>
      </div>
      <p style="font-size:12px;color:#5C6E76;margin:0 0 8px;">
        If you didn't request this, someone may have entered your email by mistake. Your password will <strong>not</strong> be changed unless you complete the process.
      </p>
      <p style="font-size:11px;color:#9aacb2;margin:0;">For security, never share this code with anyone.</p>
    </div>
  </div>`;
  await sendMail(to, "Your PPMS password reset code", html);
}

export async function notifyAppointmentRequested(to: string | undefined | null, opts: { patientName: string; hospitalName: string; dateTime: Date }) {
  await sendMail(
    to,
    "New appointment request",
    card("New Appointment Request", [
      { label: "Patient", value: opts.patientName },
      { label: "Hospital", value: opts.hospitalName },
      { label: "Requested time", value: opts.dateTime.toLocaleString() },
    ])
  );
}

export async function notifyAppointmentStatus(
  to: string | undefined | null,
  opts: { patientName: string; hospitalName: string; dateTime: Date; status: string }
) {
  await sendMail(
    to,
    `Appointment ${opts.status.toLowerCase()}`,
    card(`Appointment ${opts.status}`, [
      { label: "Patient", value: opts.patientName },
      { label: "Hospital", value: opts.hospitalName },
      { label: "Time", value: opts.dateTime.toLocaleString() },
      { label: "Status", value: opts.status },
    ])
  );
}

export async function notifyAppointmentReminder(
  to: string | undefined | null,
  opts: { patientName: string; hospitalName: string; dateTime: Date; leadTime: string }
) {
  await sendMail(
    to,
    `Reminder: appointment in ${opts.leadTime}`,
    card("Upcoming Appointment Reminder", [
      { label: "Patient", value: opts.patientName },
      { label: "Hospital", value: opts.hospitalName },
      { label: "Time", value: opts.dateTime.toLocaleString() },
      { label: "Starts in", value: opts.leadTime },
    ])
  );
}

export async function notifyAdmission(to: string | undefined | null, opts: { patientName: string; ward: string; numberOfDays: number }) {
  await sendMail(
    to,
    "Patient admission recorded",
    card("Admission Notification", [
      { label: "Patient", value: opts.patientName },
      { label: "Ward", value: opts.ward.replace(/_/g, " ") },
      { label: "Estimated days", value: String(opts.numberOfDays) },
    ])
  );
}
