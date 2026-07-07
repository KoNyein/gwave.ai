"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Plus, Trash2, Webhook as WebhookIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createWebhook,
  deleteWebhook,
  setWebhookActive,
} from "@/lib/actions/dev";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  Webhook,
  WebhookDelivery,
  WebhookEvent,
} from "@/types/database";

const EVENTS: WebhookEvent[] = [
  "post.created",
  "sale.completed",
  "alert.triggered",
];

export function WebhooksManager({
  webhooks,
  deliveries,
}: {
  webhooks: Webhook[];
  deliveries: (WebhookDelivery & { webhookUrl: string })[];
}) {
  const t = useTranslations("dev");
  const router = useRouter();
  const [secret, setSecret] = React.useState<string | null>(null);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function toggle(webhook: Webhook) {
    setPendingId(webhook.id);
    await setWebhookActive(webhook.id, !webhook.active);
    setPendingId(null);
    router.refresh();
  }

  async function remove(webhookId: string) {
    setPendingId(webhookId);
    await deleteWebhook(webhookId);
    setPendingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-xl font-bold">{t("webhooksTitle")}</h1>
        <CreateWebhookDialog onCreated={setSecret} />
      </div>

      {secret ? (
        <SecretBanner secret={secret} onDismiss={() => setSecret(null)} />
      ) : null}

      <Card>
        <CardContent className="divide-y px-4 py-1">
          {webhooks.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("noWebhooks")}
            </p>
          ) : (
            webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <WebhookIcon className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm">{webhook.url}</p>
                    <p className="text-xs text-muted-foreground">
                      {webhook.events.join(", ")}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {pendingId === webhook.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={webhook.active}
                        aria-label={t("webhookActive")}
                        onClick={() => toggle(webhook)}
                        className={cn(
                          "relative h-6 w-11 rounded-full transition-colors",
                          webhook.active
                            ? "bg-primary"
                            : "bg-muted-foreground/30",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                            webhook.active ? "left-[22px]" : "left-0.5",
                          )}
                        />
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                        onClick={() => remove(webhook.id)}
                        aria-label={t("deleteWebhook")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("deliveries")}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y px-4 py-1">
          {deliveries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("noDeliveries")}
            </p>
          ) : (
            deliveries.map((delivery) => (
              <div
                key={delivery.id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">
                  <span
                    className={cn(
                      "mr-2 rounded px-1.5 py-0.5 font-mono text-xs font-semibold",
                      delivery.delivered_at
                        ? "bg-secondary text-primary"
                        : "bg-amber-100 text-amber-800",
                    )}
                  >
                    {delivery.delivered_at
                      ? (delivery.last_status ?? "ok")
                      : t("pending")}
                  </span>
                  <span className="font-mono text-xs">{delivery.event}</span>
                  <span className="ml-2 truncate text-xs text-muted-foreground">
                    {delivery.webhookUrl}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t("attempts", { count: delivery.attempts })} ·{" "}
                  {timeAgo(delivery.created_at)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SecretBanner({
  secret,
  onDismiss,
}: {
  secret: string;
  onDismiss: () => void;
}) {
  const t = useTranslations("dev");
  const [copied, setCopied] = React.useState(false);

  return (
    <div className="space-y-2 rounded-lg border border-primary bg-secondary p-4">
      <p className="text-sm font-semibold text-primary">
        {t("webhookCreated")}
      </p>
      <p className="text-xs text-muted-foreground">{t("secretHint")}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded bg-background px-3 py-2 font-mono text-xs">
          {secret}
        </code>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(secret);
            setCopied(true);
          }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          {t("done")}
        </Button>
      </div>
    </div>
  );
}

function CreateWebhookDialog({
  onCreated,
}: {
  onCreated: (secret: string) => void;
}) {
  const t = useTranslations("dev");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [events, setEvents] = React.useState<WebhookEvent[]>(["post.created"]);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function toggleEvent(event: WebhookEvent) {
    setEvents((previous) =>
      previous.includes(event)
        ? previous.filter((entry) => entry !== event)
        : [...previous, event],
    );
  }

  function submit() {
    startTransition(async () => {
      const result = await createWebhook({ url, events });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setUrl("");
      onCreated(result.data.secret);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t("createWebhook")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("createWebhookTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="wh-url">URL</Label>
            <Input
              id="wh-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/hooks/gwave"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("events")}</Label>
            <div className="space-y-1.5">
              {EVENTS.map((event) => (
                <button
                  key={event}
                  type="button"
                  onClick={() => toggleEvent(event)}
                  className={cn(
                    "block w-full rounded-lg border px-3 py-1.5 text-left font-mono text-xs transition-colors",
                    events.includes(event)
                      ? "border-primary bg-secondary font-semibold text-primary"
                      : "hover:bg-muted",
                  )}
                >
                  {event}
                </button>
              ))}
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            className="w-full"
            onClick={submit}
            disabled={pending || !url.trim() || events.length === 0}
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("createWebhook")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
