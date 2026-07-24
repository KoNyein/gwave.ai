import { Activity, Clock, Gauge, Music4, Smile } from "lucide-react";

import type { AudioTrack } from "@/lib/db/audio";

/**
 * "Audio features" strip — the musical metadata a modern music store shows:
 * tempo (BPM), key, time signature, mood and release year. Renders only the
 * fields that are set.
 */
export function AudioFeatures({
  track,
  labels,
}: {
  track: AudioTrack;
  labels: { bpm: string; key: string; timeSig: string; mood: string; year: string };
}) {
  const chips: { icon: React.ReactNode; label: string; value: string }[] = [];
  if (track.bpm) chips.push({ icon: <Gauge className="h-3.5 w-3.5" />, label: labels.bpm, value: `${track.bpm}` });
  if (track.music_key) chips.push({ icon: <Music4 className="h-3.5 w-3.5" />, label: labels.key, value: track.music_key });
  if (track.time_sig) chips.push({ icon: <Clock className="h-3.5 w-3.5" />, label: labels.timeSig, value: track.time_sig });
  if (track.mood) chips.push({ icon: <Smile className="h-3.5 w-3.5" />, label: labels.mood, value: track.mood });
  if (track.release_year) chips.push({ icon: <Activity className="h-3.5 w-3.5" />, label: labels.year, value: `${track.release_year}` });

  if (chips.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {chips.map((c) => (
        <div
          key={c.label}
          className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2"
        >
          <span className="text-primary">{c.icon}</span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {c.label}
            </p>
            <p className="truncate text-sm font-semibold">{c.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
