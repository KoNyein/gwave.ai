"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Category = "weight" | "area" | "temperature";

const WEIGHT_TO_GRAMS: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};

const AREA_TO_M2: Record<string, number> = {
  "m²": 1,
  "ft²": 0.092903,
  "cm²": 0.0001,
  acre: 4046.86,
};

function convertTemperature(value: number, from: string, to: string): number {
  const celsius =
    from === "°C" ? value : from === "°F" ? ((value - 32) * 5) / 9 : value - 273.15;
  return to === "°C"
    ? celsius
    : to === "°F"
      ? (celsius * 9) / 5 + 32
      : celsius + 273.15;
}

const UNITS: Record<Category, string[]> = {
  weight: Object.keys(WEIGHT_TO_GRAMS),
  area: Object.keys(AREA_TO_M2),
  temperature: ["°C", "°F", "K"],
};

export function UnitConverters() {
  const t = useTranslations("tools.units");
  const [category, setCategory] = React.useState<Category>("weight");
  const [value, setValue] = React.useState("100");
  const [from, setFrom] = React.useState("g");
  const [to, setTo] = React.useState("oz");

  function switchCategory(next: Category) {
    setCategory(next);
    setFrom(UNITS[next][0]!);
    setTo(UNITS[next][1]!);
  }

  const input = Number.parseFloat(value);
  let result: number | null = null;
  if (Number.isFinite(input)) {
    if (category === "weight") {
      result = (input * WEIGHT_TO_GRAMS[from]!) / WEIGHT_TO_GRAMS[to]!;
    } else if (category === "area") {
      result = (input * AREA_TO_M2[from]!) / AREA_TO_M2[to]!;
    } else {
      result = convertTemperature(input, from, to);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["weight", "area", "temperature"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => switchCategory(option)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              category === option
                ? "border-primary bg-secondary font-semibold text-primary"
                : "hover:bg-muted",
            )}
          >
            {t(`categories.${option}`)}
          </button>
        ))}
      </div>

      <div className="grid items-end gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="unit-value">{t("value")}</Label>
          <Input
            id="unit-value"
            type="number"
            step="any"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unit-from">{t("from")}</Label>
          <select
            id="unit-from"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            {UNITS[category].map((unit) => (
              <option key={unit}>{unit}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unit-to">{t("to")}</Label>
          <select
            id="unit-to"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            {UNITS[category].map((unit) => (
              <option key={unit}>{unit}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg bg-muted p-4 text-center">
        {result !== null ? (
          <p className="text-2xl font-bold">
            {Number.parseFloat(result.toFixed(4)).toLocaleString()}{" "}
            <span className="text-base font-normal text-muted-foreground">
              {to}
            </span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("enterValue")}</p>
        )}
      </div>
    </div>
  );
}
