"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { ShareResultButton } from "@/components/tools/share-result-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** EC ↔ PPM(500) ↔ PPM(700) — editing any field recalculates the others. */
export function EcConverter() {
  const t = useTranslations("tools.ec");
  const [ec, setEc] = React.useState("1.6");

  const ecValue = Number.parseFloat(ec);
  const valid = Number.isFinite(ecValue) && ecValue >= 0 && ecValue <= 20;
  const ppm500 = valid ? Math.round(ecValue * 500) : null;
  const ppm700 = valid ? Math.round(ecValue * 700) : null;

  function setFromPpm(value: string, scale: 500 | 700) {
    const ppm = Number.parseFloat(value);
    if (Number.isFinite(ppm) && ppm >= 0) {
      setEc((ppm / scale).toFixed(2));
    } else if (value === "") {
      setEc("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="ec">{t("ec")}</Label>
          <Input
            id="ec"
            type="number"
            step="0.1"
            min="0"
            max="20"
            value={ec}
            onChange={(event) => setEc(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ppm500">{t("ppm500")}</Label>
          <Input
            id="ppm500"
            type="number"
            step="10"
            min="0"
            value={ppm500 ?? ""}
            onChange={(event) => setFromPpm(event.target.value, 500)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ppm700">{t("ppm700")}</Label>
          <Input
            id="ppm700"
            type="number"
            step="10"
            min="0"
            value={ppm700 ?? ""}
            onChange={(event) => setFromPpm(event.target.value, 700)}
          />
        </div>
      </div>

      {!valid && ec !== "" ? (
        <p className="text-sm text-destructive">{t("invalid")}</p>
      ) : null}

      <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        {t("note")}
      </p>

      <ShareResultButton
        disabled={!valid}
        content={
          valid
            ? `🧪 EC/PPM conversion (gwave.ai tools)\n\nEC ${ecValue.toFixed(2)} mS/cm = ${ppm500} ppm (500 scale) = ${ppm700} ppm (700 scale)`
            : ""
        }
      />
    </div>
  );
}
