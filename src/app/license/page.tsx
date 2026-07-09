import { getLicenseData } from "./getLicenseData";
import { LicenseGatewayClient } from "./LicenseGatewayClient";

export const metadata = { title: "License — PPMS" };
export const dynamic = "force-dynamic";

export default async function LicensePage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; session?: string }>;
}) {
  const [data, { reason, session }] = await Promise.all([getLicenseData(), searchParams]);

  return (
    <>
      {session === "ended" && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)] rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 shadow-lg">
          <p className="text-sm font-bold text-amber-800">You have been signed out</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Your license has expired. Please renew your license to continue using PPMS.
          </p>
        </div>
      )}
      {session !== "ended" && reason === "expired" && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)] rounded-xl bg-red-50 border border-red-300 px-4 py-3 shadow-lg">
          <p className="text-sm font-bold text-red-700">License expired</p>
          <p className="text-xs text-red-600 mt-0.5">Please renew your license to continue.</p>
        </div>
      )}
      <LicenseGatewayClient initial={data} />
    </>
  );
}
