"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Kind = "music" | "podcast" | "audiobook";

/**
 * Admin form to publish a track. Posts to /api/admin/audio, which inserts the
 * base row + facet + chapters with the privileged client. Kept English (admin
 * area convention); the public store is what's localized.
 */
export function AudioPublishForm() {
  const router = useRouter();
  const [kind, setKind] = React.useState<Kind>("music");
  const [premium, setPremium] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const f = new FormData(e.currentTarget);
    const num = (k: string) => {
      const v = f.get(k);
      return v && `${v}`.trim() ? Number(v) : undefined;
    };
    const str = (k: string) => {
      const v = f.get(k);
      return v && `${v}`.trim() ? `${v}`.trim() : undefined;
    };
    const body = {
      kind,
      title: str("title"),
      audio_url: str("audio_url"),
      cover_url: str("cover_url"),
      description: str("description"),
      transcript_url: str("transcript_url"),
      duration_s: num("duration_s"),
      is_premium: premium,
      price: premium ? num("price") : undefined,
      currency: str("currency") ?? "USD",
      artist: str("artist"),
      album: str("album"),
      genre: str("genre"),
      isrc: str("isrc"),
      bpm: num("bpm"),
      music_key: str("music_key"),
      time_sig: str("time_sig"),
      mood: str("mood"),
      release_year: num("release_year"),
      lyrics: str("lyrics"),
      episode_no: num("episode_no"),
      show_notes: str("show_notes"),
      author: str("author"),
      narrator: str("narrator"),
      isbn: str("isbn"),
      chapters: str("chapters"),
    };
    try {
      const res = await fetch("/api/admin/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setMsg({ ok: true, text: "Published." });
        (e.target as HTMLFormElement).reset();
        setPremium(false);
        router.refresh();
      } else {
        setMsg({ ok: false, text: j.error ?? "Failed" });
      }
    } catch {
      setMsg({ ok: false, text: "Network error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={onSubmit} className="space-y-4">
          {/* Kind */}
          <div className="flex gap-2">
            {(["music", "podcast", "audiobook"] as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm capitalize transition-colors ${
                  kind === k
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-secondary"
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title *" name="title" required />
            <Field label="Cover image URL" name="cover_url" />
            <Field label="Audio URL (HLS .m3u8 or file)" name="audio_url" />
            <Field label="Duration (seconds)" name="duration_s" type="number" />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              name="description"
              rows={2}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
            />
          </div>

          {/* Facet fields */}
          {kind === "music" && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Artist" name="artist" />
                <Field label="Album" name="album" />
                <Field label="Genre" name="genre" />
                <Field label="ISRC" name="isrc" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="BPM (tempo)" name="bpm" type="number" />
                <Field label="Key (e.g. C minor)" name="music_key" />
                <Field label="Time signature (e.g. 4/4)" name="time_sig" />
                <Field label="Mood" name="mood" />
                <Field label="Release year" name="release_year" type="number" />
              </div>
              <div>
                <Label htmlFor="lyrics">
                  Lyrics — plain, or LRC (&quot;[00:12.30] line&quot;) for a synced
                  karaoke highlight
                </Label>
                <textarea
                  id="lyrics"
                  name="lyrics"
                  rows={5}
                  placeholder={"[00:00.00] First line\n[00:04.50] Second line"}
                  className="mt-1 w-full rounded-md border border-input bg-background p-2 font-mono text-xs"
                />
              </div>
            </div>
          )}
          {kind === "podcast" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Episode number" name="episode_no" type="number" />
              <Field label="Transcript URL" name="transcript_url" />
              <div className="sm:col-span-2">
                <Label htmlFor="show_notes">Show notes</Label>
                <textarea
                  id="show_notes"
                  name="show_notes"
                  rows={2}
                  className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
                />
              </div>
            </div>
          )}
          {kind === "audiobook" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Author" name="author" />
              <Field label="Narrator" name="narrator" />
              <Field label="ISBN" name="isbn" />
              <Field label="Transcript URL" name="transcript_url" />
              <div className="sm:col-span-2">
                <Label htmlFor="chapters">
                  Chapters — one per line, &quot;mm:ss Title&quot; (or hh:mm:ss)
                </Label>
                <textarea
                  id="chapters"
                  name="chapters"
                  rows={4}
                  placeholder={"00:00 Introduction\n12:30 Chapter 1\n1:05:00 Chapter 2"}
                  className="mt-1 w-full rounded-md border border-input bg-background p-2 font-mono text-xs"
                />
              </div>
            </div>
          )}

          {/* Pricing */}
          <div className="flex flex-wrap items-end gap-3 rounded-lg bg-muted/40 p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={premium}
                onChange={(e) => setPremium(e.target.checked)}
                className="h-4 w-4"
              />
              Premium (paid)
            </label>
            {premium && (
              <>
                <div className="w-28">
                  <Label htmlFor="price">Price</Label>
                  <Input id="price" name="price" type="number" step="0.01" className="mt-1" />
                </div>
                <div className="w-28">
                  <Label htmlFor="currency">Currency</Label>
                  <Input id="currency" name="currency" defaultValue="USD" className="mt-1" />
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1 h-4 w-4" />
              )}
              Publish
            </Button>
            {msg && (
              <span className={`text-sm ${msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                {msg.text}
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} className="mt-1" />
    </div>
  );
}
