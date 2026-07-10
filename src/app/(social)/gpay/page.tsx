import { redirect } from "next/navigation";
import { Clock, Wallet, XCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { GpayAdminPanel } from "@/components/gpay/gpay-admin-panel";
import { GpayRegistrationForm } from "@/components/gpay/gpay-registration-form";
import { GpayWallet } from "@/components/gpay/gpay-wallet";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import {
  getAllGpayAccounts,
  getMyGpayAccount,
  getMyGpayTransactions,
} from "@/lib/db/gpay";

export const metadata = { title: "G-Pay" };
export const dynamic = "force-dynamic";

export default async function GpayPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const t = await getTranslations("gpay");
  const isAdmin = profile.role === "admin" || profile.role === "super_admin";

  const [account, adminAccounts] = await Promise.all([
    getMyGpayAccount(),
    isAdmin ? getAllGpayAccounts() : Promise.resolve([]),
  ]);
  const transactions = account?.status === "active"
    ? await getMyGpayTransactions()
    : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Wallet className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      {/* Owner view: register / pending / rejected / active wallet */}
      {!account ? (
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 font-semibold">{t("registerTitle")}</h2>
            <GpayRegistrationForm account={null} />
          </CardContent>
        </Card>
      ) : account.status === "pending" ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 p-4">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">{t("pendingTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("pendingHint")}</p>
            </div>
          </CardContent>
        </Card>
      ) : account.status === "rejected" || account.status === "suspended" ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold">
                {account.status === "rejected"
                  ? t("rejectedTitle")
                  : t("suspendedTitle")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("blockedHint")}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <GpayWallet account={account} transactions={transactions} />
      )}

      {/* Owner can review / edit their KYC once submitted */}
      {account && account.status !== "active" ? (
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 font-semibold">{t("editTitle")}</h2>
            <GpayRegistrationForm account={account} />
          </CardContent>
        </Card>
      ) : null}

      {/* Admin review queue */}
      {isAdmin && adminAccounts.length > 0 ? (
        <GpayAdminPanel accounts={adminAccounts} />
      ) : null}
    </div>
  );
}
