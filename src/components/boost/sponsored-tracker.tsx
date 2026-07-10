"use client";

import * as React from "react";

import { recordBoostClick, recordBoostImpression } from "@/lib/actions/boosts";

/**
 * Fires record_boost_impression once when a sponsored card has been at least
 * half visible for a second — the same "counted view" rule as post views. The
 * server bills at most once per viewer per day, so re-firing is harmless.
 * Renders an invisible 1px strip (zero-area nodes never cross a threshold).
 */
export function SponsoredImpression({ boostId }: { boostId: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const sent = React.useRef(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node || sent.current) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting ?? false;
        if (visible && !sent.current && timer === null) {
          timer = setTimeout(() => {
            sent.current = true;
            observer.disconnect();
            void recordBoostImpression(boostId);
          }, 1000);
        } else if (!visible && timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => {
      if (timer !== null) clearTimeout(timer);
      observer.disconnect();
    };
  }, [boostId]);

  return (
    <span ref={ref} aria-hidden className="absolute inset-x-0 top-1/2 h-px" />
  );
}

/** Records a click on a sponsored card at most once (free pCTR signal). */
export function useBoostClick(boostId: string | null | undefined) {
  const clicked = React.useRef(false);
  return React.useCallback(() => {
    if (!boostId || clicked.current) return;
    clicked.current = true;
    void recordBoostClick(boostId);
  }, [boostId]);
}
