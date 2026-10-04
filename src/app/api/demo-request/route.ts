import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDemoRequestNotification } from "@/lib/mailer";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // Public endpoint: cap every field so the table and the notification
    // email cannot be stuffed.
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const fullName = str(body.fullName, 120);
    const email    = str(body.email, 254).toLowerCase();
    const phone    = str(body.phone, 20);

    if (!fullName || !email || !phone) {
      return NextResponse.json({ success: false, error: "Full name, email and phone are required." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: "Enter a valid email address." }, { status: 400 });
    }
    if (!/^[0-9+\-\s()]{7,15}$/.test(phone)) {
      return NextResponse.json({ success: false, error: "Enter a valid phone number." }, { status: 400 });
    }

    const clinicName     = str(body.clinicName, 160) || null;
    const specialization = str(body.specialization, 120) || null;
    const city           = str(body.city, 120) || null;
    const preferredDate  = str(body.preferredDate, 40) || null;
    const preferredTime  = str(body.preferredTime, 40) || null;
    const message        = str(body.message, 2000) || null;

    // At most 3 requests per email or phone per day; extra ones are accepted
    // silently so the form does not reveal the limit.
    const recent = await prisma.demoRequest.count({
      where: { OR: [{ email }, { phone }], createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    });
    if (recent >= 3) return NextResponse.json({ success: true });

    await prisma.demoRequest.create({
      data: { fullName, email, phone, clinicName, specialization, city, preferredDate, preferredTime, message },
    });

    // Fire-and-forget — don't block the response on email delivery
    sendDemoRequestNotification({ fullName, email, phone, clinicName, specialization, city, preferredDate, preferredTime, message }).catch(
      (err) => console.error("[demo-request] email notification failed:", err),
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[demo-request] error:", err);
    return NextResponse.json({ success: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
