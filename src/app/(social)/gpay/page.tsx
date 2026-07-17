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
  getGpayTransactions,
  getMyGpayAccount,
} from "@/lib/db/gpay";
import { s3SlipsEnabled, signedSlipUrl } from "@/lib/storage/signed-read";
import { createClient } from "@/lib/supabase/server";

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
  const transactions =
    account?.status === "active"
      ? await getGpayTransactions(account.id)
      : [];

  // Whether the caller has a transaction PIN set (gates outgoing transfers).
  let hasPin = false;
  if (account?.status === "active") {
    const supabase = await createClient();
    const { data } = await supabase.rpc("gpay_has_pin");
    hasPin = data === true;
  }

  // Signed URLs for admins to view each account's KPay slip + KYC face scan
  // (private bucket). On S3 we sign a GET ourselves; otherwise fall back to
  // Supabase Storage. Without the S3 branch, uploads land in S3 while this still
  // asks Supabase for an object that is no longer there — and the error is
  // dropped, so the KYC image silently renders as nothing.
  const slipUrls: Record<string, string> = {};
  const faceUrls: Record<string, string> = {};
  if (isAdmin && adminAccounts.length > 0) {
    const storage = s3SlipsEnabled() ? null : (await createClient()).storage;
    const sign = async (path: string): Promise<string | null> => {
      if (!storage) return signedSlipUrl(path);
      const { data } = await storage.from("slips").createSignedUrl(path, 3600);
      return data?.signedUrl ?? null;
    };
    await Promise.all(
      adminAccounts.map(async (a) => {
        if (a.slip_path) {
          const url = await sign(a.slip_path);
          if (url) slipUrls[a.id] = url;
        }
        if (a.face_path) {
          const url = await sign(a.face_path);
          if (url) faceUrls[a.id] = url;
        }
      }),
    );
  }

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
            <GpayRegistrationForm account={null} userId={profile.id} />
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
        <GpayWallet
          account={account}
          transactions={transactions}
          hasPin={hasPin}
        />
      )}

      {/* Owner can review / edit their KYC once submitted */}
      {account && account.status !== "active" ? (
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 font-semibold">{t("editTitle")}</h2>
            <GpayRegistrationForm account={account} userId={profile.id} />
          </CardContent>
        </Card>
      ) : null}

      {/* Admin review queue */}
      {isAdmin && adminAccounts.length > 0 ? (
        <GpayAdminPanel
          accounts={adminAccounts}
          slipUrls={slipUrls}
          faceUrls={faceUrls}
        />
      ) : null}
    </div>
  );
}
