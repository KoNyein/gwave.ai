import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Navbar } from "@/components/layout/navbar";
import { getCurrentProfile, requireRole } from "@/lib/auth";

/** Developer area — developer/admin/super_admin only. */
export default async function DevLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("developer");
  const [profile, t] = await Promise.all([
    getCurrentProfile(),
    getTranslations("dev"),
  ]);

  const tabs = [
    { href: "/dev", label: t("navKeys") },
    { href: "/dev/logs", label: t("navLogs") },
    { href: "/dev/webhooks", label: t("navWebhooks") },
    { href: "/dev/flags", label: t("navFlags") },
    { href: "/dev/api-docs", label: t("navDocs") },
    { href: "/dev/deploy", label: t("navDeploy") },
  ];

  return (
    <div className="min-h-screen bg-muted">
      <Navbar profile={profile} />
      <main className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4">
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
