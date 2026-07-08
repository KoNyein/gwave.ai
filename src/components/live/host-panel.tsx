"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LiveStreamStatus } from "@/types/database";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs">
          {value}
        </code>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8 shrink-0"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

/** RTMP credentials + end control — rendered for the host only. */
export function HostPanel({
  streamId,
  status,
  rtmpUrl,
  streamKey,
}: {
  streamId: string;
  status: LiveStreamStatus;
  rtmpUrl: string;
  streamKey: string | null;
}) {
  const router = useRouter();
  const [ending, setEnding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function endStream() {
    setEnding(true);
    setError(null);
    try {
      const response = await fetch(`/api/live/${streamId}/end`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to end the stream.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end the stream.");
    } finally {
      setEnding(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Broadcast settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {status !== "ended" && streamKey ? (
          <>
            <p className="text-xs text-muted-foreground">
              In OBS (or any RTMP encoder): Settings → Stream → paste these,
              then press <strong>Start Streaming</strong>. The page flips to
              live automatically.
            </p>
            <CopyField label="RTMP server URL" value={rtmpUrl} />
            <CopyField label="Stream key (keep secret!)" value={streamKey} />
          </>
        ) : null}

        {status !== "ended" && (
          <Button
            variant="destructive"
            className="w-full"
            onClick={endStream}
            disabled={ending}
          >
            {ending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Square className="mr-2 h-4 w-4" />
            )}
            End stream
          </Button>
        )}
        {status === "ended" && (
          <p className="text-sm text-muted-foreground">
            This broadcast has ended.
          </p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
