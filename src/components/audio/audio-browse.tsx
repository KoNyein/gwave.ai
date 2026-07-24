"use client";

import * as React from "react";
import Link from "next/link";
import { Headphones, Music2, Play, Radio } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardContent } from "@/components/ui/card";
import type { AudioTrack } from "@/lib/db/audio";

type Tab = "music" | "podcast" | "audiobook";

interface ContinueItem {
  track: AudioTrack;
  position_s: number;
  duration_s: number | null;
}

export function AudioBrowse({
  music,
  podcasts,
  audiobooks,
  continueList,
}: {
  music: AudioTrack[];
  podcasts: AudioTrack[];
  audiobooks: AudioTrack[];
  continueList: ContinueItem[];
}) {
  const t = useTranslations("audio");
  const [tab, setTab] = React.useState<Tab>("music");

  const tabs: { key: Tab; label: string; icon: React.ReactNode; list: AudioTrack[] }[] = [
    { key: "music", label: t("tabMusic"), icon: <Music2 className="h-4 w-4" />, list: music },
    { key: "podcast", label: t("tabPodcasts"), icon: <Radio className="h-4 w-4" />, list: podcasts },
    { key: "audiobook", label: t("tabAudiobooks"), icon: <Headphones className="h-4 w-4" />, list: audiobooks },
  ];
  const active = tabs.find((x) => x.key === tab)!;

  return (
    <div className="space-y-5">
      {/* Continue listening */}
      {continueList.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t("continue")}
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {continueList.map((c) => {
              const pct =
                c.duration_s && c.duration_s > 0
                  ? Math.min(100, Math.round((c.position_s / c.duration_s) * 100))
                  : 0;
              return (
                <Link
                  key={c.track.id}
                  href={`/audio/${c.track.id}`}
                  className="w-36 shrink-0"
                >
                  <Cover track={c.track} />
                  <p className="mt-1 truncate text-sm font-medium">{c.track.title}</p>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Format tabs */}
      <div className="flex gap-2">
        {tabs.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setTab(x.key)}
            aria-pressed={tab === x.key}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
              tab === x.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-secondary"
            }`}
          >
            {x.icon}
            {x.label}
          </button>
        ))}
      </div>

      {active.list.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {t("browseEmpty")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {active.list.map((track) => (
            <Link key={track.id} href={`/audio/${track.id}`} className="group">
              <Cover track={track} />
              <p className="mt-1.5 truncate text-sm font-medium">{track.title}</p>
              <p className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate">
                  {track.is_premium ? t("premium") : t("free")}
                </span>
                {track.price && track.is_premium ? (
                  <span className="shrink-0 font-medium text-primary">
                    {track.currency} {track.price}
                  </span>
                ) : null}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Cover({ track }: { track: AudioTrack }) {
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
      {track.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={track.cover_url}
          alt={track.title}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <Music2 className="h-8 w-8" />
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/25 group-hover:opacity-100">
        <Play className="h-8 w-8 text-white" />
      </div>
    </div>
  );
}
