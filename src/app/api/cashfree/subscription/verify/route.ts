import { NextResponse } from "next/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { canManageDoctorLicense } from "@/lib/cashfree-access";
import { applyAutopayPayment, getCashfreeSubscription } from "@/lib/cashfree";

// Called by Settings after the customer comes back from the auto-pay screen.
// The subscription id always comes from our own database, never from the URL.
export async function POST(req: Request) {
  const user = await requireUser();
  const { doctorId } = await req.json() as { doctorId: string };
  if (!doctorId || !(await canManageDoctorLicense(user, doctorId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const lic = await prisma.tenantLicense.findUnique({
    where: { doctorId },
    select: { cashfreeSubscriptionId: true, autopayStatus: true },
  });
  if (!lic?.cashfreeSubscriptionId) {
    return NextResponse.json({ error: "No auto-pay request found." }, { status: 400 });
  }

  let sub;
  try {
    sub = await getCashfreeSubscription(lic.cashfreeSubscriptionId);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not check auto-pay." }, { status: 502 });
  }

  const auth = sub.authorisation_details;
  const authorised =
    auth?.authorization_status === "SUCCESS" &&
    (sub.subscription_status === "ACTIVE" || sub.subscription_status === "BANK_APPROVAL_PENDING");

  if (!authorised || !auth?.payment_id) {
    return NextResponse.json({
      success: false,
      status: sub.subscription_status,
      error: "Auto-pay was not completed. No money has been taken for a month you did not approve.",
    });
  }

  const r = await applyAutopayPayment(lic.cashfreeSubscriptionId, auth.payment_id, "AUTH");
  if (r.applied) {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        entityType: "TenantLicense",
        entityId: doctorId,
        action: "AUTOPAY_STARTED",
        newValue: JSON.stringify({ subscriptionId: lic.cashfreeSubscriptionId, paymentId: auth.payment_id }),
      },
    });
  }
  return NextResponse.json({ success: true, status: sub.subscription_status });
}
