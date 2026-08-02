import { SiteNavbar } from "@/components/layout/site-chrome";
import { getCurrentProfile } from "@/lib/auth";
import { requireUser } from "@/lib/auth";

/** Tools hub layout — login required (enforced by middleware too). */
export default async function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  const profile = await getCurrentProfile();

  return (
    <div className="min-h-screen bg-muted">
      <SiteNavbar profile={profile} />
      <main className="mx-auto w-full max-w-4xl px-3 py-6 sm:px-4">
        {children}
      </main>
    </div>
  );
}
