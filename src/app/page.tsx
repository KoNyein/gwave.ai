import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  // Signed-in members land on their feed; visitors see the marketing page.
  const profile = await getCurrentProfile();
  redirect(profile ? "/feed" : "/welcome");
}
