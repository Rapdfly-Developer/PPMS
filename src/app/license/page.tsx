import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LicensePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  if (typeof searchParams.reason === "string") params.set("reason", searchParams.reason);
  if (typeof searchParams.session === "string") params.set("session", searchParams.session);
  const qs = params.toString();
  redirect(`/sign-up${qs ? `?${qs}` : ""}`);
}
