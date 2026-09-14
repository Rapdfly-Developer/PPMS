import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LicenseActivatePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  if (typeof searchParams.reason === "string") params.set("reason", searchParams.reason);
  const qs = params.toString();
  redirect(`/sign-up/activate${qs ? `?${qs}` : ""}`);
}
