import { Navbar } from "@/components/layout/navbar";
import { getCurrentProfile } from "@/lib/auth";

/**
 * Public knowledge-base layout (strains + minerals): navbar plus a wide
 * content column. No authentication required — search is open to everyone.
 */
export default async function KnowledgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  return (
    <div className="min-h-screen bg-muted">
      <Navbar profile={profile} />
      <main className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-4">
        {children}
      </main>
    </div>
  );
}
