import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

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
  const { data: deletion } = await supabase
    .from("deletion_requests")
    .select("status")
    .eq("user_id", profile.id)
    .maybeSingle();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{t("title")}</h1>

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

      <PrivacySettings
        deletionPending={deletion?.status === "pending"}
      />
    </div>
  );
}
