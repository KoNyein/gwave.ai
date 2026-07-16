"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ExternalLink, Loader2, Siren, X } from "lucide-react";

import { reportThreat } from "@/lib/actions/threat";
import {
  distanceMeters,
  formatDistance,
  getCurrentPosition,
} from "@/lib/geolocation";
import { THREAT_META, bearingLabelMy } from "@/lib/threat";
import type { ThreatKind } from "@/types/database";
import type { ThreatWithReporter } from "@/lib/db/threat";

const KINDS: ThreatKind[] = [
  "airstrike",
  "artillery",
  "drone",
  "ground",
  "disaster",
  "other",
];

function minsAgo(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "ယခုလေးတင်" : `${m} မိနစ်က`;
}

export function ThreatPanel({
  threats,
}: {
  threats: ThreatWithReporter[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [here, setHere] = React.useState<{ lat: number; lng: number } | null>(
    null,
  );

  React.useEffect(() => {
    getCurrentPosition()
      .then((p) => setHere({ lat: p.latitude, lng: p.longitude }))
      .catch(() => undefined);
  }, []);

  async function report(kind: ThreatKind) {
    setBusy(true);
    setError(null);
    try {
      const p = await getCurrentPosition();
      const res = await reportThreat({
        kind,
        latitude: p.latitude,
        longitude: p.longitude,
        heading: p.heading ?? null,
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Location unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* Active warnings — the loudest thing on the page. */}
      {threats.length > 0 ? (
        <div className="space-y-2 rounded-xl border-2 border-destructive bg-destructive/10 p-3">
          <p className="flex items-center gap-2 font-bold text-destructive">
            <Siren className="h-5 w-5 animate-pulse" /> ⚠️ အရေးပေါ် သတိပေးချက် (
            {threats.length})
          </p>
          <ul className="space-y-1.5">
            {threats.map((t) => {
              const meta = THREAT_META[t.kind];
              const meters = here
                ? distanceMeters(here.lat, here.lng, t.latitude, t.longitude)
                : null;
              const dir = bearingLabelMy(t.heading);
              const near =
                meters != null && meters <= meta.radiusKm * 1000;
              return (
                <li
                  key={t.id}
                  className={`flex items-center justify-between gap-2 rounded-lg p-2 text-sm ${
                    near ? "bg-destructive/15" : "bg-background/60"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {meta.emoji} {meta.label}
                      {near ? (
                        <span className="ml-1 text-xs font-bold text-destructive">
                          · သင့်နယ်မြေအတွင်း!
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {meters != null ? `${formatDistance(meters)} အကွာ` : "—"}
                      {dir ? ` · ${dir}မှ` : ""} · {minsAgo(t.created_at)}
                    </p>
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${t.latitude},${t.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border hover:bg-muted/50"
                    aria-label="Map"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* Report a threat */}
      {open ? (
        <div className="space-y-2 rounded-xl border-2 border-destructive bg-card p-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-destructive">
              ⚠️ အန္တရာယ် သတင်းပို့မည်
            </p>
            <button type="button" onClick={() => setOpen(false)} aria-label="ပိတ်">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            အနီးအနားက user များ ချက်ချင်း သတိပေးချက် ရရှိပါမည်။
          </p>
          <div className="grid grid-cols-3 gap-2">
            {KINDS.map((k) => {
              const meta = THREAT_META[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => report(k)}
                  disabled={busy}
                  className="flex flex-col items-center gap-1 rounded-lg border p-2 text-xs hover:bg-destructive/10 disabled:opacity-60"
                >
                  <span className="text-xl">{meta.emoji}</span>
                  {meta.label}
                </button>
              );
            })}
          </div>
          {busy ? (
            <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> ပို့နေသည်…
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">❌ {error}</p> : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-destructive/50 bg-destructive/5 px-4 py-2.5 text-sm font-bold text-destructive"
        >
          <AlertTriangle className="h-5 w-5" /> ⚠️ အန္တရာယ် သတင်းပို့ (လေယာဉ်/ဗုံး/ဘေး)
        </button>
      )}
    </div>
  );
}
