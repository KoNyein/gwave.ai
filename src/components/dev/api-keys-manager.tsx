"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Loader2, Plus, RefreshCw, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_SCOPES, type ApiScope } from "@/lib/api-scopes";
import { createApiKey, revokeApiKey, rotateApiKey } from "@/lib/actions/dev";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ApiKey } from "@/types/database";

export function ApiKeysManager({ keys }: { keys: ApiKey[] }) {
  const t = useTranslations("dev");
  const router = useRouter();
  const [freshKey, setFreshKey] = React.useState<string | null>(null);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function revoke(keyId: string) {
    setPendingId(keyId);
    await revokeApiKey(keyId);
    setPendingId(null);
    router.refresh();
  }

  async function rotate(keyId: string) {
    setPendingId(keyId);
    const result = await rotateApiKey(keyId);
    setPendingId(null);
    if (result.ok) setFreshKey(result.data.fullKey);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-xl font-bold">{t("keysTitle")}</h1>
        <CreateKeyDialog onCreated={setFreshKey} />
      </div>

      {freshKey ? (
        <FreshKeyBanner fullKey={freshKey} onDismiss={() => setFreshKey(null)} />
      ) : null}

      <Card>
        <CardContent className="divide-y px-4 py-1">
          {keys.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("noKeys")}
            </p>
          ) : (
            keys.map((key) => (
              <div
                key={key.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 py-3",
                  key.revoked && "opacity-50",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <KeyRound className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {key.name}
                      {key.revoked ? ` (${t("revoked")})` : ""}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="font-mono">gw_{key.prefix}_…</span> ·{" "}
                      {key.scopes.join(", ")} · {key.rate_limit}/min ·{" "}
                      {key.last_used_at
                        ? t("lastUsed", { time: timeAgo(key.last_used_at) })
                        : t("neverUsed")}
                    </p>
                  </div>
                </div>
                {!key.revoked ? (
                  <div className="flex shrink-0 gap-2">
                    {pendingId === key.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => rotate(key.id)}
                        >
                          <RefreshCw className="mr-1 h-4 w-4" />
                          {t("rotate")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => revoke(key.id)}
                        >
                          <X className="mr-1 h-4 w-4" />
                          {t("revoke")}
                        </Button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FreshKeyBanner({
  fullKey,
  onDismiss,
}: {
  fullKey: string;
  onDismiss: () => void;
}) {
  const t = useTranslations("dev");
  const [copied, setCopied] = React.useState(false);

  return (
    <div className="space-y-2 rounded-lg border border-primary bg-secondary p-4">
      <p className="text-sm font-semibold text-primary">{t("keyCreated")}</p>
      <p className="text-xs text-muted-foreground">{t("keyShownOnce")}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded bg-background px-3 py-2 font-mono text-xs">
          {fullKey}
        </code>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(fullKey);
            setCopied(true);
          }}
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          {t("done")}
        </Button>
      </div>
    </div>
  );
}

function CreateKeyDialog({
  onCreated,
}: {
  onCreated: (fullKey: string) => void;
}) {
  const t = useTranslations("dev");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [scopes, setScopes] = React.useState<ApiScope[]>(["read:posts"]);
  const [rateLimit, setRateLimit] = React.useState(60);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function toggleScope(scope: ApiScope) {
    setScopes((previous) =>
      previous.includes(scope)
        ? previous.filter((entry) => entry !== scope)
        : [...previous, scope],
    );
  }

  function submit() {
    startTransition(async () => {
      const result = await createApiKey({ name, scopes, rateLimit });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setName("");
      onCreated(result.data.fullKey);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t("createKey")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("createKeyTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="key-name">{t("keyName")}</Label>
            <Input
              id="key-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              placeholder="My integration"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("scopes")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {API_SCOPES.map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => toggleScope(scope)}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 font-mono text-xs transition-colors",
                    scopes.includes(scope)
                      ? "border-primary bg-secondary font-semibold text-primary"
                      : "hover:bg-muted",
                  )}
                >
                  {scope}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="key-rate">{t("rateLimit")}</Label>
            <select
              id="key-rate"
              value={rateLimit}
              onChange={(event) => setRateLimit(Number(event.target.value))}
              className="h-10 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value={30}>30 / min</option>
              <option value={60}>60 / min</option>
              <option value={300}>300 / min</option>
              <option value={1000}>1000 / min</option>
            </select>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            className="w-full"
            onClick={submit}
            disabled={pending || !name.trim() || scopes.length === 0}
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("createKey")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
