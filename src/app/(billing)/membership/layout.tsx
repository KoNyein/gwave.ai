import { Navbar } from "@/components/layout/navbar";
import { getCurrentProfile } from "@/lib/auth";

/** Public billing layout — pricing is viewable without a session. */
export default async function MembershipLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  return (
    <div className="min-h-screen bg-muted">
      <Navbar profile={profile} />
      <main className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4">
        {children}
      </main>
    </div>
  );
}
