import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { MonetizationToggle } from "@/components/settings/monetization-toggle";
import { ProfileEditor } from "@/components/settings/profile-editor";
import { AccountSecurity } from "@/components/settings/account-security";
import { AppUpdate } from "@/components/settings/app-update";
import { GeneralSettings } from "@/components/settings/general-settings";
import { PushManager } from "@/components/pwa/push-manager";
import { PrivacySettings } from "@/components/social/privacy-settings";
import { startGoogleLink } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth";
import { getSiteTheme } from "@/lib/db/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  // Next 15: searchParams is a Promise in the generated PageProps.
  searchParams?: Promise<{ link?: string }>;
}) {
  const t = await getTranslations("settings");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const linkResult = (await searchParams)?.link;
  const adminTheme = await getSiteTheme();

  const supabase = await createClient();
  const user = await getCurrentUser();
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
          <GeneralSettings adminTheme={adminTheme} />
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
            📥 Import · Facebook data ပြန်သွင်းရန်
          </CardTitle>
        </CardHeader>
        <CardContent>
          <a
            href="/settings/import"
            className="text-sm font-medium text-primary hover:underline"
          >
            Facebook &quot;Download Your Information&quot; ZIP ကနေ post/ဓာတ်ပုံများ
            ပြန်သွင်းရန် →
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            🔐 Account Security · အကောင့် လုံခြုံရေး
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AccountSecurity
            email={user?.email ?? "—"}
            emailVerified={Boolean(user)}
            lastSignInAt={null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            🔗 Linked accounts · အကောင့် ချိတ်ဆက်ခြင်း
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {linkResult === "google_ok" ? (
            <p className="rounded-lg bg-primary/10 p-3 text-sm font-medium text-primary">
              ✅ Google အကောင့် ချိတ်ဆက်ပြီးပါပြီ — နောက်ပိုင်း Google နဲ့
              ဝင်တိုင်း ဒီအကောင့်ထဲ တန်းရောက်ပါမယ် (app ရော web ရော)။
            </p>
          ) : linkResult === "expired" || linkResult === "failed" ? (
            <p className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
              Google ချိတ်ဆက်မှု မအောင်မြင်ပါ — ထပ်စမ်းကြည့်ပါ။
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Google အကောင့်ကို ဒီအကောင့်နဲ့ ချိတ်လိုက်ရင် — app ထဲမှာရော
            website မှာရော <b>Google တစ်ချက်နှိပ်ရုံ</b>နဲ့ ဒီအကောင့်
            (friends, messenger, G-Pay အားလုံးပါ) ထဲ တန်းဝင်လို့ရပါမယ်။
          </p>
          <form action={startGoogleLink}>
            <Button type="submit" variant="outline" className="gap-2">
              🔗 Link Google account · Google ချိတ်မည်
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            🚀 Software Update · အက်ပ် ဗားရှင်း
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AppUpdate />
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
