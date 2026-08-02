import { SiteNavbar } from "@/components/layout/site-chrome";
import { getCurrentProfile } from "@/lib/auth";
import { requireUser } from "@/lib/auth";

/** Full-width layout (navbar only) — the messenger manages its own panes. */
export default async function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  const profile = await getCurrentProfile();

  return (
    <div className="min-h-screen bg-background">
      <SiteNavbar profile={profile} />
      <main>{children}</main>
    </div>
  );
}
