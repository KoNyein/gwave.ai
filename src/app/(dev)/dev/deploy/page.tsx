import { getTranslations } from "next-intl/server";

import { DeployPanel } from "@/components/dev/deploy-panel";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DevDeployPage() {
  const t = await getTranslations("dev");
  const commit = process.env.GIT_COMMIT_SHA ?? null;
  const configured = Boolean(
    process.env.COOLIFY_API_URL &&
      process.env.COOLIFY_API_TOKEN &&
      process.env.COOLIFY_APP_UUID,
  );

  return (
    <div className="space-y-4">
      <h1 className="px-1 text-xl font-bold">{t("deployTitle")}</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("currentVersion")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">{t("commit")}: </span>
            <span className="font-mono">
              {commit ? commit.slice(0, 12) : t("unknown")}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">{t("commitHint")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("redeployTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DeployPanel configured={configured} />
        </CardContent>
      </Card>
    </div>
  );
}
