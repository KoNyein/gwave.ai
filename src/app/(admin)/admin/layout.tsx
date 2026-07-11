import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Navbar } from "@/components/layout/navbar";
import { getCurrentProfile, requireRole } from "@/lib/auth";

/** Admin area — admin/super_admin only (also guarded by middleware auth). */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("admin");
  const [profile, t] = await Promise.all([
    getCurrentProfile(),
    getTranslations("admin"),
  ]);

  const tabs = [
    { href: "/admin", label: t("navOverview") },
    { href: "/admin/users", label: t("navUsers") },
    { href: "/admin/moderation", label: t("navModeration") },
    { href: "/admin/games", label: t("navGames") },
    { href: "/admin/teachers", label: t("navTeachers") },
    { href: "/admin/membership", label: t("navMembership") },
    { href: "/admin/gpay", label: "G-Pay" },
    { href: "/admin/settings", label: t("navSettings") },
  ];

  return (
    <div className="min-h-screen bg-muted">
      <Navbar profile={profile} />
      <main className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-4">
        <nav className="mb-4 flex flex-wrap gap-2 px-1">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="rounded-full border bg-background px-3 py-1 text-sm font-medium hover:bg-secondary"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        {children}
      </main>
    </div>
  );
}
