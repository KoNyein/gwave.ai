import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import generatePayload from "promptpay-qr";
import QRCode from "qrcode";

import { SlipUpload } from "@/components/membership/slip-upload";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getThbRate } from "@/lib/actions/membership";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function PromptPayPage({
  params,
}: {
  params: { plan: string };
}) {
  const t = await getTranslations("membership");
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?redirectTo=/membership/promptpay/${params.plan}`);

  if (!["pro", "business"].includes(params.plan)) notFound();
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("membership_plans")
    .select("*")
    .eq("id", params.plan)
    .eq("active", true)
    .maybeSingle();
  if (!plan) notFound();

  const promptPayId = process.env.PROMPTPAY_ID;
  const thbRate = await getThbRate();
  const amountThb = Math.round(plan.price_monthly * thbRate);

  let qrSvg: string | null = null;
  if (promptPayId) {
    const payload = generatePayload(promptPayId, { amount: amountThb });
    qrSvg = await QRCode.toString(payload, {
      type: "svg",
      margin: 1,
      width: 240,
    });
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Link
        href="/membership"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToPlans")}
      </Link>

      <Card>
        <CardHeader className="pb-2 text-center">
          <CardTitle>{t("promptPayTitle", { plan: plan.name })}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("promptPayAmount", {
              thb: amountThb.toLocaleString(),
              usd: plan.price_monthly,
            })}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {qrSvg ? (
            <div
              className="mx-auto w-60 rounded-lg border bg-white p-3"
              // QR SVG is generated server-side from our own payload.
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          ) : (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {t("promptPayNotConfigured")}
            </p>
          )}

          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t("promptPayStep1")}</li>
            <li>{t("promptPayStep2")}</li>
            <li>{t("promptPayStep3")}</li>
          </ol>

          <SlipUpload
            userId={profile.id}
            plan={plan.id as "pro" | "business"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
