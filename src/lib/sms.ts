// SMS sender — Fast2SMS (https://fast2sms.com)
// Requires FAST2SMS_API_KEY in environment variables.
// When the key is absent (dev/test), the OTP is printed to console instead.

const API_KEY = process.env.FAST2SMS_API_KEY ?? "";

export async function sendOtp(mobile: string, otp: string): Promise<void> {
  if (!API_KEY) {
    console.log(`[sms:dev] OTP for ${mobile}: ${otp}`);
    return;
  }

  const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: API_KEY,
    },
    body: JSON.stringify({
      route: "otp",
      variables_values: otp,
      numbers: mobile,
      flash: 0,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!data.return) {
    throw new Error(`[sms] Fast2SMS error: ${JSON.stringify(data)}`);
  }
}
