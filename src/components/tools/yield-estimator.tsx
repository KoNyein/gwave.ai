"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { ShareResultButton } from "@/components/tools/share-result-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";
import { cn } from "@/lib/utils";

const METHODS = [
  { id: "soil", low: 0.5, high: 0.8 },
  { id: "hydro", low: 0.8, high: 1.1 },
  { id: "scrog", low: 1.0, high: 1.4 },
] as const;

const PER_PLANT_CAP_G = 500;

/** Rough grams-per-watt yield estimate by growing method. */
export function YieldEstimator() {
  const t = useTranslations("tools.yield");
  const [watts, setWatts] = usePersistentState("tool.yield.watts", "400");
  const [plants, setPlants] = usePersistentState("tool.yield.plants", "4");
  const [method, setMethod] = usePersistentState<(typeof METHODS)[number]>(
    "tool.yield.method",
    METHODS[1],
  );

  const wattsValue = Number.parseFloat(watts);
  const plantsValue = Number.parseInt(plants, 10);
  const valid =
    Number.isFinite(wattsValue) &&
    wattsValue >= 50 &&
    wattsValue <= 10000 &&
    Number.isInteger(plantsValue) &&
    plantsValue >= 1 &&
    plantsValue <= 1000;

  let low: number | null = null;
  let high: number | null = null;
  if (valid) {
    low = Math.min(wattsValue * method.low, plantsValue * PER_PLANT_CAP_G);
    high = Math.min(wattsValue * method.high, plantsValue * PER_PLANT_CAP_G);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="watts">{t("watts")}</Label>
          <Input
            id="watts"
            type="number"
            step="50"
            min="50"
            value={watts}
            onChange={(event) => setWatts(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="plants">{t("plants")}</Label>
          <Input
            id="plants"
            type="number"
            step="1"
            min="1"
            value={plants}
            onChange={(event) => setPlants(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t("method")}</Label>
        <div className="flex gap-2">
          {METHODS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMethod(option)}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                method.id === option.id
                  ? "border-primary bg-secondary font-semibold text-primary"
                  : "hover:bg-muted",
              )}
            >
              {t(`methods.${option.id}`)}
              <span className="block text-xs font-normal text-muted-foreground">
                {option.low}–{option.high} g/W
              </span>
            </button>
          ))}
        </div>
      </div>

      {!valid ? (
        <p className="text-sm text-destructive">{t("invalid")}</p>
      ) : (
        <div className="rounded-lg bg-muted p-4 text-center">
          <p className="text-xs text-muted-foreground">{t("estimate")}</p>
          <p className="text-3xl font-bold">
            {Math.round(low!)}–{Math.round(high!)} g
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("perPlant", {
              low: Math.round(low! / plantsValue),
              high: Math.round(high! / plantsValue),
            })}
          </p>
        </div>
      )}

      <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        {t("disclaimer")}
      </p>

      <ShareResultButton
        disabled={!valid}
        content={
          valid
            ? `⚖️ Yield estimate (Gwave tools)\n\n${wattsValue} W · ${plantsValue} plants · ${t(`methods.${method.id}`)}\nEstimated harvest: ${Math.round(low!)}–${Math.round(high!)} g`
            : ""
        }
      />
    </div>
  );
}
