"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";

import { mediaRef } from "@/lib/media-url";
import { metalName, metalStyle } from "@/components/knowledge/mine-data";

interface Site {
  id: string;
  metal: string;
  name: string;
  region: string;
  township: string;
  latitude: number;
  longitude: number;
  photos: string[];
  scale: string;
  status: string;
  operator: string | null;
  report_count: number;
  updated_at: string;
}

interface Report {
  reason: string;
  created_at: string;
}

/**
 * One row of the admin mine-site queue: the listing as users see it, the report
 * reasons if any, and the delete button. Deleting goes through the same
 * admin-gated API the map uses, then hides the row — no separate server action,
 * so there is one code path for removal.
 */
export function MineModerationRow({
  site,
  reports,
}: {
  site: Site;
  reports: Report[];
}) {
  const [busy, setBusy] = React.useState(false);
  const [gone, setGone] = React.useState(false);
  const photo = mediaRef(site.photos?.[0]);
  const style = metalStyle(site.metal);

  async function remove() {
    if (!window.confirm(`Delete "${site.name}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/mine/sites?id=${encodeURIComponent(site.id)}`,
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
        site.report_count > 0 ? "border-amber-400" : ""
      }`}
    >
      <div className="flex gap-3 p-3">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={site.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-20 w-20 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg text-2xl"
            style={{ backgroundColor: `${style.color}22` }}
          >
            {style.emoji}
          </div>
        )}
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">
            {style.emoji} {site.name}
          </p>
          <p className="text-xs" style={{ color: style.color }}>
            {metalName(site.metal, "en")} · {site.scale} · {site.status}
          </p>
          <p className="text-xs text-muted-foreground">
            {site.township}, {site.region} ·{" "}
            <a
              href={`https://www.openstreetmap.org/?mlat=${site.latitude}&mlon=${site.longitude}#map=15/${site.latitude}/${site.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {site.latitude.toFixed(5)}, {site.longitude.toFixed(5)}
            </a>
          </p>
          {site.operator ? (
            <p className="text-xs text-muted-foreground">🏗 {site.operator}</p>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            {site.photos?.length ?? 0} photos ·{" "}
            {new Date(site.updated_at).toLocaleString()}
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
