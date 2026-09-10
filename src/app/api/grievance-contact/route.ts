import { NextResponse } from "next/server";

// Public endpoint — no auth required (DPDP Act 2023, Rule 13(3)).
// Returns Grievance Officer contact details so data principals can lodge
// complaints without logging in.
export async function GET() {
  const name  = process.env.GRIEVANCE_OFFICER_NAME  || "";
  const email = process.env.GRIEVANCE_OFFICER_EMAIL || "";
  const phone = process.env.GRIEVANCE_OFFICER_PHONE || "";

  if (!name || !email) {
    return NextResponse.json(
      { error: "Grievance Officer not configured. Set GRIEVANCE_OFFICER_NAME and GRIEVANCE_OFFICER_EMAIL." },
      { status: 503 },
    );
  }

  return NextResponse.json({ name, email, phone }, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
