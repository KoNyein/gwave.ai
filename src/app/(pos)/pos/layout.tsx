import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Navbar } from "@/components/layout/navbar";
import { getCurrentProfile, requireUser } from "@/lib/auth";
import { getMyStore } from "@/lib/db/pos";

/** POS layout: full-width with a Sell/Receipts/Inventory/Shifts/Reports nav. */
export default async function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const [profile, t, context] = await Promise.all([
    getCurrentProfile(),
    getTranslations("pos"),
    getMyStore(user.id),
  ]);

  const tabs = context
    ? [
        { href: "/pos/sell", label: t("navSell") },
        { href: "/pos/receipts", label: t("navReceipts") },
        ...(context.role === "manager"
          ? [
              { href: "/pos/inventory", label: t("navInventory") },
              { href: "/pos/shifts", label: t("navShifts") },
              { href: "/pos/reports", label: t("navReports") },
              { href: "/pos/staff", label: t("navStaff") },
            ]
          : [{ href: "/pos/shifts", label: t("navShifts") }]),
      ]
    : [];

  return (
    <div className="min-h-screen bg-muted">
      <Navbar profile={profile} />
      <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4">
        {context ? (
          <nav className="mb-4 flex flex-wrap items-center gap-2 px-1">
            <span className="mr-2 text-sm font-bold">{context.store.name}</span>
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
        ) : null}
        {children}
      </main>
    </div>
  );
}
