import { Navbar } from "@/components/layout/navbar";
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
      <Navbar profile={profile} />
      <main>{children}</main>
    </div>
  );
}
