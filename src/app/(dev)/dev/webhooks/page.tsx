import { redirect } from "next/navigation";

import { WebhooksManager } from "@/components/dev/webhooks-manager";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { WebhookDelivery } from "@/types/database";

export default async function DevWebhooksPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: webhooks } = await supabase
    .from("webhooks")
    .select("*")
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false });

  const urls = new Map((webhooks ?? []).map((hook) => [hook.id, hook.url]));
  const { data: deliveries } = await supabase
    .from("webhook_deliveries")
    .select("*")
    .in(
      "webhook_id",
      (webhooks ?? []).map((hook) => hook.id),
    )
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<WebhookDelivery[]>();

  return (
    <WebhooksManager
      webhooks={webhooks ?? []}
      deliveries={(deliveries ?? []).map((delivery) => ({
        ...delivery,
        webhookUrl: urls.get(delivery.webhook_id) ?? "?",
      }))}
    />
  );
}
