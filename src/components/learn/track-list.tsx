"use client";

import Link from "next/link";
import {
  Blocks,
  BookOpen,
  Bot,
  Braces,
  BrainCircuit,
  Code2,
  Cpu,
  Database,
  FileCode2,
  FlaskConical,
  ListChecks,
  Palette,
  Sprout,
  Terminal,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { ViewToggle, useViewMode } from "@/components/ui/view-toggle";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Blocks,
  FlaskConical,
  Cpu,
  Bot,
  Code2,
  Sprout,
  FileCode2,
  Palette,
  Braces,
  Terminal,
  Database,
  BrainCircuit,
  ListChecks,
};

export interface TrackItem {
  slug: string;
  icon: string;
  title: string;
  description: string;
  lessonCount: number;
  done: number;
}

/**
 * The learn tracks, shown in a user-chosen layout: a full-width list (default,
 * with progress bars) or a compact two-per-row grid. The choice is remembered.
 */
export function TrackList({ tracks }: { tracks: TrackItem[] }) {
  const [view, setView] = useViewMode("learn.tracks", "list");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">
          📚 သင်ခန်းစာ Tracks
        </h2>
        <ViewToggle value={view} onChange={setView} />
      </div>

      <div
        className={cn(
          view === "grid" ? "grid gap-3 sm:grid-cols-2" : "space-y-3",
        )}
      >
        {tracks.map((track) => {
          const Icon = ICONS[track.icon] ?? BookOpen;
          const done = Math.min(track.done, track.lessonCount);
          const pct = Math.round((done / track.lessonCount) * 100);
          return (
            <Link
              key={track.slug}
              href={`/learn/${track.slug}`}
              className="block"
            >
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardContent className="flex items-start gap-3 p-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{track.title}</p>
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                        {done > 0
                          ? `${done}/${track.lessonCount}`
                          : `${track.lessonCount} lessons`}
                      </span>
                    </div>
                    {view === "list" ? (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {track.description}
                      </p>
                    ) : null}
                    {done > 0 ? (
                      <div
                        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
