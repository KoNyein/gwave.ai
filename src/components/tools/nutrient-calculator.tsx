"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { ShareResultButton } from "@/components/tools/share-result-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";

/**
 * Two-part (A/B) nutrient mixing estimator: reservoir volume + target EC +
 * N-P-K ratio → grams per part. Uses a common ~0.65 g/L per EC unit
 * approximation; the A/B split follows the N vs P+K weight in the ratio.
 */
export function NutrientCalculator() {
  const t = useTranslations("tools.nutrient");
  const [liters, setLiters] = usePersistentState("tool.nutrient.liters", "100");
  const [targetEc, setTargetEc] = usePersistentState("tool.nutrient.ec", "1.6");
  const [ratioN, setRatioN] = usePersistentState("tool.nutrient.n", "3");
  const [ratioP, setRatioP] = usePersistentState("tool.nutrient.p", "1");
  const [ratioK, setRatioK] = usePersistentState("tool.nutrient.k", "2");

  const litersValue = Number.parseFloat(liters);
  const ecValue = Number.parseFloat(targetEc);
  const n = Number.parseFloat(ratioN);
  const p = Number.parseFloat(ratioP);
  const k = Number.parseFloat(ratioK);
  const valid =
    Number.isFinite(litersValue) &&
    litersValue > 0 &&
    litersValue <= 100000 &&
    Number.isFinite(ecValue) &&
    ecValue > 0 &&
    ecValue <= 5 &&
    [n, p, k].every((part) => Number.isFinite(part) && part >= 0) &&
    n + p + k > 0;

  let gramsA: number | null = null;
  let gramsB: number | null = null;
  if (valid) {
    const totalGrams = litersValue * ecValue * 0.65;
    const aShare = n / (n + p + k);
    gramsA = totalGrams * aShare;
    gramsB = totalGrams - gramsA;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="liters">{t("reservoir")}</Label>
          <Input
            id="liters"
            type="number"
            step="1"
            min="1"
            value={liters}
            onChange={(event) => setLiters(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="target-ec">{t("targetEc")}</Label>
          <Input
            id="target-ec"
            type="number"
            step="0.1"
            min="0.1"
            max="5"
            value={targetEc}
            onChange={(event) => setTargetEc(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t("npkRatio")}</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="0"
            step="0.5"
            value={ratioN}
            onChange={(event) => setRatioN(event.target.value)}
            aria-label="N"
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="number"
            min="0"
            step="0.5"
            value={ratioP}
            onChange={(event) => setRatioP(event.target.value)}
            aria-label="P"
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="number"
            min="0"
            step="0.5"
            value={ratioK}
            onChange={(event) => setRatioK(event.target.value)}
            aria-label="K"
          />
        </div>
      </div>

      {!valid ? (
        <p className="text-sm text-destructive">{t("invalid")}</p>
      ) : (
        <div className="grid gap-3 rounded-lg bg-muted p-4 sm:grid-cols-2">
          <div className="rounded-lg bg-background p-3 text-center">
            <p className="text-xs text-muted-foreground">{t("partA")}</p>
            <p className="text-2xl font-bold">{gramsA!.toFixed(1)} g</p>
            <p className="text-xs text-muted-foreground">
              {(gramsA! / litersValue).toFixed(2)} g/L
            </p>
          </div>
          <div className="rounded-lg bg-background p-3 text-center">
            <p className="text-xs text-muted-foreground">{t("partB")}</p>
            <p className="text-2xl font-bold">{gramsB!.toFixed(1)} g</p>
            <p className="text-xs text-muted-foreground">
              {(gramsB! / litersValue).toFixed(2)} g/L
            </p>
          </div>
        </div>
      )}

      <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        {t("disclaimer")}
      </p>

      <ShareResultButton
        disabled={!valid}
        content={
          valid
            ? `🧪 Nutrient mix (gwave.ai tools)\n\n${litersValue} L reservoir @ EC ${ecValue} (${n}-${p}-${k} NPK)\nPart A: ${gramsA!.toFixed(1)} g · Part B: ${gramsB!.toFixed(1)} g`
            : ""
        }
      />
    </div>
  );
}
