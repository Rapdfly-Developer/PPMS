import { NextRequest, NextResponse } from "next/server";

// Cashfree sends the customer back here (POST, sometimes GET) after the
// auto-pay approval screen. Nothing is trusted from the request: we just send
// the browser on to Settings, which then asks the server to verify with Cashfree.

function back(req: NextRequest, sid: string | null) {
  const url = new URL("/settings", req.nextUrl.origin);
  url.searchParams.set("section", "licenses");
  url.searchParams.set("tab", "plans");
  url.searchParams.set("autopay", "return");
  if (sid) url.searchParams.set("sid", sid);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest) {
  let sid: string | null = null;
  try {
    const form = await req.formData();
    sid = (form.get("cf_subscriptionId") as string | null) ?? null;
  } catch { /* fall through */ }
  return back(req, sid);
}

export async function GET(req: NextRequest) {
  return back(req, req.nextUrl.searchParams.get("cf_subscriptionId"));
}
