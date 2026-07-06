"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { ShareResultButton } from "@/components/tools/share-result-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const STAGES = [
  { id: "clone", min: 0.4, max: 0.8 },
  { id: "veg", min: 0.8, max: 1.2 },
  { id: "flower", min: 1.2, max: 1.6 },
] as const;

/** Saturation vapor pressure (kPa) via the Tetens equation. */
function svp(tempC: number): number {
  return 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
}

export function VpdCalculator() {
  const t = useTranslations("tools.vpd");
  const [airTemp, setAirTemp] = React.useState("26");
  const [leafOffset, setLeafOffset] = React.useState("2");
  const [humidity, setHumidity] = React.useState("60");

  const air = Number.parseFloat(airTemp);
  const offset = Number.parseFloat(leafOffset);
  const rh = Number.parseFloat(humidity);
  const valid =
    Number.isFinite(air) &&
    air >= 5 &&
    air <= 45 &&
    Number.isFinite(offset) &&
    offset >= -5 &&
    offset <= 10 &&
    Number.isFinite(rh) &&
    rh >= 5 &&
    rh <= 100;

  const vpd = valid
    ? svp(air - offset) - svp(air) * (rh / 100)
    : null;

  // Position on a 0–2 kPa scale for the range indicator.
  const percent =
    vpd !== null ? Math.min(100, Math.max(0, (vpd / 2) * 100)) : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="air">{t("airTemp")}</Label>
          <Input
            id="air"
            type="number"
            step="0.5"
            value={airTemp}
            onChange={(event) => setAirTemp(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="offset">{t("leafOffset")}</Label>
          <Input
            id="offset"
            type="number"
            step="0.5"
            value={leafOffset}
            onChange={(event) => setLeafOffset(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rh">{t("humidity")}</Label>
          <Input
            id="rh"
            type="number"
            step="1"
            min="5"
            max="100"
            value={humidity}
            onChange={(event) => setHumidity(event.target.value)}
          />
        </div>
      </div>

      {!valid ? (
        <p className="text-sm text-destructive">{t("invalid")}</p>
      ) : null}

      {vpd !== null ? (
        <div className="space-y-3 rounded-lg bg-muted p-4">
          <p className="text-center text-3xl font-bold">
            {vpd.toFixed(2)}{" "}
            <span className="text-base font-normal text-muted-foreground">
              kPa
            </span>
          </p>

          {/* 0–2 kPa scale with stage bands */}
          <div className="relative h-3 overflow-hidden rounded-full bg-background">
            {STAGES.map((stage) => (
              <div
                key={stage.id}
                className="absolute h-full bg-accent/40"
                style={{
                  left: `${(stage.min / 2) * 100}%`,
                  width: `${((stage.max - stage.min) / 2) * 100}%`,
                }}
              />
            ))}
            <div
              className="absolute top-1/2 h-5 w-1.5 -translate-y-1/2 rounded-full bg-primary"
              style={{ left: `calc(${percent}% - 3px)` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {STAGES.map((stage) => {
              const inRange = vpd >= stage.min && vpd <= stage.max;
              return (
                <div
                  key={stage.id}
                  className={cn(
                    "rounded-md px-2 py-1.5",
                    inRange
                      ? "bg-primary font-semibold text-primary-foreground"
                      : "bg-background text-muted-foreground",
                  )}
                >
                  {t(`stages.${stage.id}`)}
                  <br />
                  {stage.min}–{stage.max} kPa
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <ShareResultButton
        disabled={vpd === null}
        content={
          vpd !== null
            ? `💧 VPD check (gwave.ai tools)\n\nAir ${air}°C, leaf offset −${offset}°C, RH ${rh}% → VPD ${vpd.toFixed(2)} kPa`
            : ""
        }
      />
    </div>
  );
}
