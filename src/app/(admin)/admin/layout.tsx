import { Navbar } from "@/components/layout/navbar";
import { AdminNav } from "@/components/admin/admin-nav";
import { getCurrentProfile, requireRole } from "@/lib/auth";

/** Admin area — admin/super_admin only (also guarded by middleware auth). */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("admin");
  const profile = await getCurrentProfile();

  return (
    <div className="min-h-screen bg-muted">
      <Navbar profile={profile} />
      <main className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-4">
        <AdminNav />
        {children}
      </main>
    </div>
  );
}
