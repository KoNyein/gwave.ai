"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Store } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStore } from "@/lib/actions/pos";

export function CreateStoreCard() {
  const t = useTranslations("pos");
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [currency, setCurrency] = React.useState("USD");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createStore(name, currency);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/pos/sell");
      router.refresh();
    });
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Store className="h-10 w-10 text-primary" />
          <h1 className="text-xl font-bold">{t("createStoreTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("createStoreSubtitle")}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="store-name">{t("storeName")}</Label>
          <Input
            id="store-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            placeholder="GreenWave Rooftop"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="store-currency">{t("currency")}</Label>
          <select
            id="store-currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="USD">USD</option>
            <option value="THB">THB</option>
            <option value="MMK">MMK</option>
          </select>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button
          className="w-full"
          onClick={submit}
          disabled={pending || name.trim().length === 0}
        >
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("createStore")}
        </Button>
      </CardContent>
    </Card>
  );
}
