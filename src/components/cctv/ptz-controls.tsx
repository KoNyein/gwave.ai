"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Home,
  Loader2,
  Minus,
  Move,
  Plus,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { ptzCommand } from "@/lib/actions/cctv";
import { cn } from "@/lib/utils";

type Move =
  | "up"
  | "down"
  | "left"
  | "right"
  | "zoom_in"
  | "zoom_out"
  | "home";

/** Pan / tilt / zoom pad for a camera with a PTZ endpoint configured. */
export function PtzControls({ cameraId }: { cameraId: string }) {
  const t = useTranslations("cctv");
  const [busy, setBusy] = React.useState<Move | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function send(move: Move) {
    setBusy(move);
    setError(null);
    const res = await ptzCommand(cameraId, move);
    setBusy(null);
    if (!res.ok) setError(res.error);
  }

  const Btn = ({ move, children }: { move: Move; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => send(move)}
      disabled={busy !== null}
      aria-label={move}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-lg border transition-colors hover:bg-muted disabled:opacity-50",
        busy === move && "bg-muted",
      )}
    >
      {busy === move ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );

  return (
    <div className="rounded-xl border p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Move className="h-4 w-4 text-primary" /> {t("ptzTitle")}
      </p>
      <div className="flex items-center gap-4">
        {/* D-pad */}
        <div className="grid grid-cols-3 gap-1">
          <span />
          <Btn move="up">
            <ChevronUp className="h-5 w-5" />
          </Btn>
          <span />
          <Btn move="left">
            <ChevronLeft className="h-5 w-5" />
          </Btn>
          <Btn move="home">
            <Home className="h-4 w-4" />
          </Btn>
          <Btn move="right">
            <ChevronRight className="h-5 w-5" />
          </Btn>
          <span />
          <Btn move="down">
            <ChevronDown className="h-5 w-5" />
          </Btn>
          <span />
        </div>
        {/* Zoom */}
        <div className="flex flex-col gap-1">
          <Btn move="zoom_in">
            <Plus className="h-5 w-5" />
          </Btn>
          <Btn move="zoom_out">
            <Minus className="h-5 w-5" />
          </Btn>
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
