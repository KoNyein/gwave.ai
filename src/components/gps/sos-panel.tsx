"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ExternalLink,
  HandHelping,
  Loader2,
  ShieldCheck,
  Siren,
  X,
} from "lucide-react";

import {
  raiseSos,
  respondToSos,
  setSosStatus,
  type SosCategory,
} from "@/lib/actions/sos";
import {
  distanceMeters,
  formatDistance,
  getCurrentPosition,
} from "@/lib/geolocation";
import type { SosAlert, SosCategory as Cat } from "@/types/database";
import type { SosAlertWithPerson } from "@/lib/db/sos";

/** Category emoji + Burmese label, in the order shown on the picker. */
const CATEGORIES: { key: SosCategory; emoji: string; label: string }[] = [
  { key: "medical", emoji: "🚑", label: "ဆေးကုသ" },
  { key: "disaster", emoji: "🌊", label: "သဘာဝဘေး" },
  { key: "conflict", emoji: "⚠️", label: "စစ်ဘေး" },
  { key: "fire", emoji: "🔥", label: "မီးလောင်" },
  { key: "trapped", emoji: "🆘", label: "ပိတ်မိ" },
  { key: "other", emoji: "❗", label: "အခြား" },
];

function catMeta(key: Cat) {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[5]!;
}

export function SosPanel({
  myAlert,
  alerts,
  myUserId,
}: {
  myAlert: SosAlert | null;
  alerts: SosAlertWithPerson[];
  myUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState<SosCategory>("medical");
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [here, setHere] = React.useState<{ lat: number; lng: number } | null>(
    null,
  );

  // A single position read to show distances to people in danger.
  React.useEffect(() => {
    getCurrentPosition()
      .then((p) => setHere({ lat: p.latitude, lng: p.longitude }))
      .catch(() => undefined);
  }, []);

  const others = alerts.filter((a) => a.user_id !== myUserId);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const pos = await getCurrentPosition();
      const res = await raiseSos({
        category,
        message,
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy: pos.accuracy,
      });
      if (res.ok) {
        setOpen(false);
        setMessage("");
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

  async function markStatus(status: "safe" | "resolved") {
    if (!myAlert) return;
    setBusy(true);
    await setSosStatus(myAlert.id, status);
    setBusy(false);
    router.refresh();
  }

  async function respond(alertId: string) {
    setBusy(true);
    await respondToSos(alertId);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {/* My active alert, or the button to raise one. */}
      {myAlert ? (
        <div className="space-y-2 rounded-xl border-2 border-destructive bg-destructive/10 p-3">
          <p className="flex items-center gap-2 font-semibold text-destructive">
            <Siren className="h-5 w-5 animate-pulse" />
            🆘 သင့် အကူအညီတောင်း လွှင့်နေသည် · {catMeta(myAlert.category).emoji}{" "}
            {catMeta(myAlert.category).label}
          </p>
          {myAlert.message ? (
            <p className="text-sm">{myAlert.message}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => markStatus("safe")}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              <ShieldCheck className="h-4 w-4" /> ဘေးကင်းပြီ
            </button>
            <button
              type="button"
              onClick={() => markStatus("resolved")}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium"
            >
              <Check className="h-4 w-4" /> ပိတ်မယ်
            </button>
          </div>
        </div>
      ) : open ? (
        <div className="space-y-3 rounded-xl border-2 border-destructive bg-card p-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-destructive">
              🆘 အကူအညီ တောင်းမည်
            </p>
            <button type="button" onClick={() => setOpen(false)} aria-label="ပိတ်">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-xs ${
                  category === c.key
                    ? "border-destructive bg-destructive/10 font-semibold"
                    : "hover:bg-muted/50"
                }`}
              >
                <span className="text-xl">{c.emoji}</span>
                {c.label}
              </button>
            ))}
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="အခြေအနေ အတိုချုပ် (ရွေးချယ်)"
            className="w-full rounded-lg border bg-background p-2 text-sm"
          />
          {error ? <p className="text-sm text-destructive">❌ {error}</p> : null}
          <button
            type="button"
            onClick={send}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-base font-bold text-white disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Siren className="h-5 w-5" />
            )}
            တည်နေရာနှင့်အတူ လွှင့်မည်
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-3 text-base font-bold text-white shadow-sm"
        >
          <Siren className="h-5 w-5" /> 🆘 အကူအညီတောင်း (SOS)
        </button>
      )}

      {/* People near you who need help. */}
      {others.length > 0 ? (
        <div className="space-y-2 rounded-xl border bg-card p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <Siren className="h-4 w-4" /> အကူအညီ လိုအပ်သူများ ({others.length})
          </p>
          <ul className="divide-y">
            {others.map((a) => {
              const meta = catMeta(a.category);
              const meters = here
                ? distanceMeters(here.lat, here.lng, a.latitude, a.longitude)
                : null;
              return (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-xl">{meta.emoji}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {a.person.full_name || a.person.username || "User"}
                        {a.status === "safe" ? (
                          <span className="ml-1 text-xs text-emerald-600">
                            · ဘေးကင်းပြီ
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {meta.label}
                        {meters != null ? ` · ${formatDistance(meters)}` : ""}
                        {a.responder_count > 0
                          ? ` · ${a.responder_count} ကူညီနေ`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${a.latitude},${a.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-muted/50"
                      aria-label="Map"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => respond(a.id)}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                    >
                      <HandHelping className="h-3.5 w-3.5" /> ကူညီမယ်
                    </button>
                    {a.person.username ? (
                      <Link
                        href={`/u/${a.person.username}`}
                        className="inline-flex h-8 items-center rounded-lg border px-2 text-xs hover:bg-muted/50"
                      >
                        Chat
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
