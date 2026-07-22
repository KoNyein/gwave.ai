import { getTranslations } from "next-intl/server";

import { FeatureFlagsEditor } from "@/components/admin/settings-forms";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/data/server";

export default async function DevFlagsPage() {
  const t = await getTranslations("dev");
  const db = await createClient();
  const { data: flags } = await db
    .from("feature_flags")
    .select("*")
    .order("key");

  return (
    <div className="space-y-4">
      <h1 className="px-1 text-xl font-bold">{t("flagsTitle")}</h1>
      <p className="px-1 text-sm text-muted-foreground">{t("flagsHint")}</p>
      <Card>
        <CardContent className="p-4">
          <FeatureFlagsEditor flags={flags ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
