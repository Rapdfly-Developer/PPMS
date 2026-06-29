import { redirect } from "next/navigation";
import { requireUser, roleHome } from "@/lib/rbac";

export default async function Home() {
  const user = await requireUser();
  redirect(roleHome(user.role));
}
