import { getActivationData } from "../getLicenseData";
import { ActivationClient } from "./ActivationClient";

export const metadata = { title: "License Activation — PPMS" };
export const dynamic = "force-dynamic";

const REASON_MESSAGES: Record<string, { title: string; body: string }> = {
  invalid: {
    title: "License verification failed",
    body: "Your license appears to be corrupted or modified. Please reactivate your license.",
  },
  machine: {
    title: "This license belongs to another device",
    body: "Please contact your administrator or reactivate your license on this machine.",
  },
  suspended: {
    title: "License suspended",
    body: "This license has been suspended or deactivated. Please contact support.",
  },
  none: {
    title: "No license has been activated",
    body: "Please activate your PPMS license to continue.",
  },
};

export default async function LicenseActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const [data, { reason }] = await Promise.all([getActivationData(), searchParams]);
  const msg = reason ? REASON_MESSAGES[reason] : undefined;

  return (
    <>
      {msg && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)] rounded-xl bg-red-50 border border-red-300 px-4 py-3 shadow-lg">
          <p className="text-sm font-bold text-red-700">{msg.title}</p>
          <p className="text-xs text-red-600 mt-0.5">{msg.body}</p>
        </div>
      )}
      <ActivationClient initial={data} />
    </>
  );
}
