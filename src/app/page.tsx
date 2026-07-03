import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { roleHome } from "@/lib/rbac";
import { LandingClient } from "./LandingClient";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect(roleHome((session.user as any).role));
  return <LandingClient />;
}
