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
export function GoLiveForm() {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
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
            You&apos;ll get an RTMP URL and a private stream key for OBS or any
            streaming app on the next screen.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
