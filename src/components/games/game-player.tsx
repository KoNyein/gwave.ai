"use client";

import * as React from "react";

import { buildGameDoc } from "@/components/games/game-sandbox";
import { recordGamePlay } from "@/lib/actions/games";

/**
 * Runs a community game inside a fully sandboxed srcdoc iframe. With only
 * allow-scripts (no allow-same-origin) the game gets an opaque origin: no
 * cookies, no storage, no parent access — and the injected meta CSP (see
 * game-sandbox.ts) blocks every network request. One play is counted per
 * mount for approved games.
 */
export function GamePlayer({
  gameId,
  code,
  title,
  countPlay,
}: {
  gameId: string;
  code: string;
  title: string;
  countPlay: boolean;
}) {
  const counted = React.useRef(false);

  React.useEffect(() => {
    if (!countPlay || counted.current) return;
    counted.current = true;
    void recordGamePlay(gameId);
  }, [countPlay, gameId]);

  return (
    <iframe
      title={title}
      sandbox="allow-scripts"
      srcDoc={buildGameDoc(code)}
      className="h-[70vh] w-full rounded-xl border bg-white"
    />
  );
}
