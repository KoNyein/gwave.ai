import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth";

/** Sidebar/menu "Profile" entry — sends the viewer to their own profile. */
export default async function ProfileRedirectPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.username) redirect("/onboarding");
  redirect(`/u/${profile.username}`);
}
