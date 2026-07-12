import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { MonetizationToggle } from "@/components/settings/monetization-toggle";
import { ProfileEditor } from "@/components/settings/profile-editor";
import { UpdatePasswordForm } from "@/components/auth/password-reset";
import { GeneralSettings } from "@/components/settings/general-settings";
import { PushManager } from "@/components/pwa/push-manager";
import { PrivacySettings } from "@/components/social/privacy-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const [{ data: deletion }, { data: invoices }] = await Promise.all([
    supabase
      .from("deletion_requests")
      .select("status")
      .eq("user_id", profile.id)
      .maybeSingle(),
    supabase
      .from("invoices")
      .select("id, number, amount, currency, description, issued_at")
      .eq("user_id", profile.id)
      .order("issued_at", { ascending: false })
      .limit(24),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <a href="/help" className="text-sm font-medium text-primary hover:underline">
          📖 အကူအညီ
        </a>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">⚙️ General · အထွေထွေ</CardTitle>
        </CardHeader>
        <CardContent>
          <GeneralSettings />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">👤 Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileEditor profile={profile} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">🔔 Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <PushManager />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            🔐 Security · စကားဝှက် ပြောင်းရန်
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm">
            <UpdatePasswordForm compact />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">💰 Monetization</CardTitle>
        </CardHeader>
        <CardContent>
          <MonetizationToggle enabled={profile.monetization_enabled} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("consentTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {profile.terms_accepted_version ? (
            <p>
              {t("consentAccepted", {
                version: profile.terms_accepted_version,
                date: profile.terms_accepted_at
                  ? new Date(profile.terms_accepted_at).toLocaleDateString()
                  : "—",
              })}
            </p>
          ) : (
            <p>{t("consentMissing")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("billingTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {!invoices || invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noInvoices")}</p>
          ) : (
            <div className="divide-y">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{invoice.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {invoice.description ?? "—"} ·{" "}
                      {new Date(invoice.issued_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">
                    {Number(invoice.amount).toFixed(2)} {invoice.currency}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PrivacySettings
        deletionPending={deletion?.status === "pending"}
      />
    </div>
  );
}
