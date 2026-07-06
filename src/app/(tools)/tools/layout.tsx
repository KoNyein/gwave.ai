import { Navbar } from "@/components/layout/navbar";
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
      <Navbar profile={profile} />
      <main className="mx-auto w-full max-w-4xl px-3 py-6 sm:px-4">
        {children}
      </main>
    </div>
  );
}
