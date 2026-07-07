"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveFeatureFlag, updateSiteName } from "@/lib/actions/admin";
import { cn } from "@/lib/utils";
import type { FeatureFlag } from "@/types/database";

export function SiteNameForm({ initialName }: { initialName: string }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [name, setName] = React.useState(initialName);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Label htmlFor="site-name">{t("siteName")}</Label>
      <div className="flex gap-2">
        <Input
          id="site-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          className="max-w-xs"
        />
        <Button
          disabled={pending || name.trim() === initialName}
          onClick={() =>
            startTransition(async () => {
              const result = await updateSiteName(name);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setError(null);
              router.refresh();
            })
          }
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function FeatureFlagsEditor({ flags }: { flags: FeatureFlag[] }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [key, setKey] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function toggle(flag: FeatureFlag) {
    startTransition(async () => {
      await saveFeatureFlag(flag.key, !flag.enabled, flag.description ?? "");
      router.refresh();
    });
  }

  function create() {
    startTransition(async () => {
      const result = await saveFeatureFlag(key.trim(), false, description);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setKey("");
      setDescription("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {flags.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noFlags")}</p>
      ) : (
        <div className="divide-y rounded-lg border">
          {flags.map((flag) => (
            <div
              key={flag.key}
              className="flex items-center justify-between gap-3 p-3"
            >
              <div>
                <p className="font-mono text-sm font-medium">{flag.key}</p>
                {flag.description ? (
                  <p className="text-xs text-muted-foreground">
                    {flag.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={flag.enabled}
                aria-label={flag.key}
                disabled={pending}
                onClick={() => toggle(flag)}
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                  flag.enabled ? "bg-primary" : "bg-muted-foreground/30",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                    flag.enabled ? "left-[22px]" : "left-0.5",
                  )}
                />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Input
          value={key}
          onChange={(event) => setKey(event.target.value)}
          placeholder="new_flag_key"
          className="w-44 font-mono text-sm"
        />
        <Input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t("flagDescription")}
          className="w-56"
        />
        <Button
          variant="outline"
          disabled={pending || key.trim().length < 2}
          onClick={create}
        >
          {t("addFlag")}
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
