import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const fullName = (body.fullName ?? "").trim();
    const email    = (body.email ?? "").trim().toLowerCase();
    const phone    = (body.phone ?? "").trim();

    if (!fullName || !email || !phone) {
      return NextResponse.json({ success: false, error: "Full name, email and phone are required." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: "Enter a valid email address." }, { status: 400 });
    }
    if (!/^[0-9+\-\s()]{7,15}$/.test(phone)) {
      return NextResponse.json({ success: false, error: "Enter a valid phone number." }, { status: 400 });
    }

    await prisma.demoRequest.create({
      data: {
        fullName,
        email,
        phone,
        clinicName:     (body.clinicName ?? "").trim() || null,
        specialization: (body.specialization ?? "").trim() || null,
        city:           (body.city ?? "").trim() || null,
        preferredDate:  (body.preferredDate ?? "").trim() || null,
        preferredTime:  (body.preferredTime ?? "").trim() || null,
        message:        (body.message ?? "").trim() || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[demo-request] error:", err);
    return NextResponse.json({ success: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
