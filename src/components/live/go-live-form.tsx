"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Radio } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Create a stream via /api/live/create, then jump to the host view. */
export function GoLiveForm({
  browserBroadcast = false,
}: {
  browserBroadcast?: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [mode, setMode] = React.useState<"camera" | "rtmp">(
    browserBroadcast ? "camera" : "rtmp",
  );
  // Opt-in recording — on by default (international standard) so the broadcast
  // becomes a replay after it ends; the host can turn it off.
  const [record, setRecord] = React.useState(true);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/live/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          mode,
          record,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        id?: string;
        error?: string;
      } | null;
      if (!response.ok || !body?.id) {
        throw new Error(body?.error ?? "Failed to create the stream.");
      }
      router.push(`/live/${body.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create the stream.",
      );
      setPending(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="live-title">Title</Label>
            <Input
              id="live-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What are you streaming today?"
              maxLength={120}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>ဘယ်လို လွှင့်မလဲ</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("camera")}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  mode === "camera"
                    ? "border-primary bg-primary/10"
                    : "hover:bg-muted/50"
                }`}
              >
                <span className="font-medium">📱 ဖုန်းကင်မရာ</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  ဒီစက်ရဲ့ ကင်မရာ/မိုက်နဲ့ တိုက်ရိုက်လွှင့်
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMode("rtmp")}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  mode === "rtmp"
                    ? "border-primary bg-primary/10"
                    : "hover:bg-muted/50"
                }`}
              >
                <span className="font-medium">🎮 OBS / Game</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  RTMP URL + stream key နဲ့ OBS ကနေလွှင့်
                </span>
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="live-description">Description (optional)</Label>
            <Textarea
              id="live-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Tell viewers what to expect…"
              maxLength={1000}
              rows={3}
            />
          </div>
          {/* Record → replay (international standard, host's choice). */}
          <button
            type="button"
            onClick={() => setRecord((r) => !r)}
            aria-pressed={record}
            className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
              record ? "border-primary bg-primary/10" : "hover:bg-muted/50"
            }`}
          >
            <span
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                record ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                  record ? "left-[22px]" : "left-0.5"
                }`}
              />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Radio className="h-4 w-4 text-red-600" /> ဒီ Live ကို Record
                လုပ်မယ် (Replay သိမ်း)
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {record
                  ? "Live ပြီးရင် Replay အဖြစ် ပြန်ကြည့်လို့ရပါမယ်။"
                  : "Record ပိတ်ထားရင် Replay ပြန်ကြည့်လို့ မရပါ။"}
              </span>
            </span>
          </button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending || !title.trim()}>
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Radio className="mr-2 h-4 w-4" />
            )}
            Create stream
          </Button>
          <p className="text-xs text-muted-foreground">
            {browserBroadcast
              ? "You'll broadcast straight from this device's camera and mic on the next screen — no extra app needed."
              : "You'll get an RTMP URL and a private stream key for OBS or any streaming app on the next screen."}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
