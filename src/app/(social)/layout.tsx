import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth";

export default async function SocialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  // NOTE: no forced /onboarding redirect here — it hijacked every page for
  // accounts without a username and made the site feel broken. The feed shows
  // a gentle "complete your profile" card instead, and brand-new sign-ups are
  // still routed to onboarding once by the auth callback.
  return <AppShell>{children}</AppShell>;
}
