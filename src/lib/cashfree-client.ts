// Browser-side Cashfree checkout helper, shared by the license page and
// Settings > License. Flow: create order (server) -> Cashfree modal ->
// verify (server asks Cashfree, then activates the license).

type CashfreeCheckoutResult = { error?: { message?: string }; paymentDetails?: unknown; redirect?: boolean };
type CashfreeInstance = { checkout(o: { paymentSessionId: string; redirectTarget: "_modal" }): Promise<CashfreeCheckoutResult> };
declare global {
  interface Window { Cashfree?: (o: { mode: "sandbox" | "production" }) => CashfreeInstance }
}

const SDK_URL = "https://sdk.cashfree.com/js/v3/cashfree.js";

function loadSdk(): Promise<void> {
  if (window.Cashfree) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SDK_URL}"]`);
    const done = () => (window.Cashfree ? resolve() : reject(new Error("Failed to load the payment window.")));
    if (existing) { existing.addEventListener("load", done); existing.addEventListener("error", done); return; }
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.async = true;
    s.onload = done;
    s.onerror = () => reject(new Error("Failed to load the payment window."));
    document.head.appendChild(s);
  });
}

export type CashfreePayResult =
  | { ok: true; orderId: string; paymentId?: string }
  | { ok: false; error: string };

export async function payWithCashfree(plan: string, doctorId: string): Promise<CashfreePayResult> {
  try {
    await loadSdk();

    const res = await fetch("/api/cashfree/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, doctorId }),
    });
    const order = await res.json() as { orderId?: string; paymentSessionId?: string; mode?: "sandbox" | "production"; error?: string };
    if (!res.ok || !order.orderId || !order.paymentSessionId) {
      return { ok: false, error: order.error || "Failed to start the payment." };
    }

    const cashfree = window.Cashfree!({ mode: order.mode ?? "production" });
    const result = await cashfree.checkout({ paymentSessionId: order.paymentSessionId, redirectTarget: "_modal" });

    // Whatever the modal reports, the server decides: it asks Cashfree directly.
    const vRes = await fetch("/api/cashfree/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.orderId, doctorId }),
    });
    const v = await vRes.json() as { success?: boolean; paymentId?: string; error?: string };
    if (vRes.ok && v.success) return { ok: true, orderId: order.orderId, paymentId: v.paymentId };

    return { ok: false, error: result.error?.message || v.error || "Payment was not completed." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Payment failed. Please try again." };
  }
}
