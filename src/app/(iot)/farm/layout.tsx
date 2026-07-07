import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Navbar } from "@/components/layout/navbar";

export default async function FarmLayout({
  children,
}: {
  children: React.ReactNode;
}) {


  return (
    <div className="min-h-screen bg-muted">
      <Navbar profile={profile} />
      <main className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4">
        <nav className="mb-4 flex gap-2 px-1">
          <Link
            href="/farm"
            className="rounded-full border bg-background px-3 py-1 text-sm font-medium hover:bg-secondary"
          >
            {t("navDashboard")}
          </Link>
          <Link
            href="/farm/devices"
            className="rounded-full border bg-background px-3 py-1 text-sm font-medium hover:bg-secondary"
          >
            {t("navDevices")}
          </Link>
          <Link
            href="/farm/rules"
            className="rounded-full border bg-background px-3 py-1 text-sm font-medium hover:bg-secondary"
          >
            {t("navRules")}
          </Link>
        </nav>
        {children}
      </main>
    </div>
  );
}
