"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";

import { mediaRef } from "@/lib/media-url";

interface Place {
  id: string;
  kind: string;
  name: string;
  address: string;
  phone: string;
  city: string | null;
  latitude: number;
  longitude: number;
  photos: string[];
  report_count: number;
  updated_at: string;
}

interface Report {
  reason: string;
  created_at: string;
}

const EMOJI: Record<string, string> = {
  shop: "🏪",
  farm: "🌱",
  clinic: "🏥",
};

/**
 * One row of the admin place queue: the full listing as users see it, the
 * report reasons if any, and the delete button. Deleting goes through the same
 * admin-gated API the map uses, then refreshes — no separate server action, so
 * there is one code path for removal.
 */
export function PlaceModerationRow({
  place,
  reports,
}: {
  place: Place;
  reports: Report[];
}) {
  const [busy, setBusy] = React.useState(false);
  const [gone, setGone] = React.useState(false);
  const photo = mediaRef(place.photos?.[0]);

  async function remove() {
    if (!window.confirm(`Delete "${place.name}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/cannabis/places?id=${encodeURIComponent(place.id)}`,
        { method: "DELETE" },
      );
      if (res.ok) setGone(true);
    } finally {
      setBusy(false);
    }
  }

  if (gone) return null;

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-card ${
        place.report_count > 0 ? "border-amber-400" : ""
      }`}
    >
      <div className="flex gap-3 p-3">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={place.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-20 w-20 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-muted text-2xl">
            {EMOJI[place.kind] ?? "📍"}
          </div>
        )}
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">
            {EMOJI[place.kind] ?? "📍"} {place.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {place.city ? `${place.city} · ` : ""}
            {place.address}
          </p>
          <p className="text-xs text-muted-foreground">
            📞 {place.phone} ·{" "}
            <a
              href={`https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=17/${place.latitude}/${place.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}
            </a>
          </p>
          <p className="text-[11px] text-muted-foreground">
            {place.photos?.length ?? 0} photos ·{" "}
            {new Date(place.updated_at).toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void remove()}
          className="inline-flex h-8 shrink-0 items-center gap-1 self-start rounded-md border border-red-300 px-2 text-xs font-semibold text-red-600 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>
      {reports.length > 0 ? (
        <div className="border-t bg-amber-500/10 px-3 py-2">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            ⚠ {reports.length} တိုင်ကြားချက်
          </p>
          <ul className="mt-1 space-y-0.5">
            {reports.slice(0, 8).map((r) => (
              <li key={`${r.created_at}-${r.reason}`} className="text-xs">
                “{r.reason}”{" "}
                <span className="text-muted-foreground">
                  · {new Date(r.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
