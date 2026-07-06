import { Navbar } from "@/components/layout/navbar";
import { getCurrentProfile, requireUser } from "@/lib/auth";

/** Smart-home layout. Login enforced by middleware. */
export default async function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
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
