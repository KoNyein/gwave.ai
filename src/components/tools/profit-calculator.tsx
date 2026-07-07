"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { ShareResultButton } from "@/components/tools/share-result-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfitCalculator() {
  const t = useTranslations("tools.profit");
  const [cost, setCost] = React.useState("6");
  const [price, setPrice] = React.useState("10");
  const [fixedCosts, setFixedCosts] = React.useState("1200");

  const costValue = Number.parseFloat(cost);
  const priceValue = Number.parseFloat(price);
  const fixedValue = Number.parseFloat(fixedCosts);
  const valid =
    Number.isFinite(costValue) &&
    costValue >= 0 &&
    Number.isFinite(priceValue) &&
    priceValue > 0 &&
    Number.isFinite(fixedValue) &&
    fixedValue >= 0;

  const unitProfit = valid ? priceValue - costValue : null;
  const margin = valid ? ((priceValue - costValue) / priceValue) * 100 : null;
  const markup =
    valid && costValue > 0
      ? ((priceValue - costValue) / costValue) * 100
      : null;
  const breakEven =
    unitProfit !== null && unitProfit > 0
      ? Math.ceil(fixedValue / unitProfit)
      : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="cost">{t("unitCost")}</Label>
          <Input
            id="cost"
            type="number"
            step="0.01"
            min="0"
            value={cost}
            onChange={(event) => setCost(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="price">{t("sellPrice")}</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fixed">{t("fixedCosts")}</Label>
          <Input
            id="fixed"
            type="number"
            step="1"
            min="0"
            value={fixedCosts}
            onChange={(event) => setFixedCosts(event.target.value)}
          />
        </div>
      </div>

      {!valid ? (
        <p className="text-sm text-destructive">{t("invalid")}</p>
      ) : (
        <div className="grid gap-3 rounded-lg bg-muted p-4 sm:grid-cols-2">
          <Stat label={t("profitPerUnit")} value={`$${unitProfit!.toFixed(2)}`} />
          <Stat label={t("margin")} value={`${margin!.toFixed(1)}%`} />
          <Stat
            label={t("markup")}
            value={markup !== null ? `${markup.toFixed(1)}%` : "–"}
          />
          <Stat
            label={t("breakEven")}
            value={
              breakEven !== null
                ? t("breakEvenUnits", { count: breakEven })
                : t("noProfit")
            }
          />
        </div>
      )}

      <ShareResultButton
        disabled={!valid || margin === null}
        content={
          valid && margin !== null
            ? `📈 Pricing check (gwave.ai tools)\n\nCost $${costValue.toFixed(2)} → sell $${priceValue.toFixed(2)}\nMargin ${margin.toFixed(1)}%${breakEven !== null ? ` · break-even at ${breakEven} units/month` : ""}`
            : ""
        }
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
