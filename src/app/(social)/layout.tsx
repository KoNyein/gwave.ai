import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentProfile, requireUser } from "@/lib/auth";

export default async function SocialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  // A signed-in account without a username hasn't finished onboarding —
  // take it there instead of leaving a half-set-up profile wandering the app
  // (previously /onboarding was only reachable right after the OAuth
  // callback, so users who skipped it could never find it again).
  const profile = await getCurrentProfile();
  if (profile && !profile.username) {
    redirect("/onboarding");
  }
  return <AppShell>{children}</AppShell>;
}
