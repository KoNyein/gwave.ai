"use client";

import * as React from "react";
import { ThumbsUp } from "lucide-react";

import { REACTION_ORDER, REACTIONS } from "@/components/social/reactions";
import { cn } from "@/lib/utils";
import type { ReactionType } from "@/types/database";

/**
 * Facebook-style reaction button: click toggles Like (or clears the current
 * reaction); hovering / long-press opens the 6-reaction picker.
 */
export function ReactionButton({
  current,
  onChange,
  className,
}: {
  current: ReactionType | null;
  onChange: (type: ReactionType | null) => void;
  className?: string;
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function openPicker() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setPickerOpen(true);
  }

  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setPickerOpen(false), 300);
  }

  React.useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const active = current ? REACTIONS[current] : null;

  return (
    <div
      className="relative flex-1"
      onMouseEnter={openPicker}
      onMouseLeave={scheduleClose}
    >
      {pickerOpen ? (
        <div className="absolute bottom-full left-0 z-20 mb-1 flex items-center gap-1 rounded-full border bg-background px-2 py-1 shadow-lg">
          {REACTION_ORDER.map((type) => (
            <button
              key={type}
              type="button"
              aria-label={REACTIONS[type].label}
              className="text-2xl transition-transform hover:scale-125"
              onClick={() => {
                setPickerOpen(false);
                onChange(current === type ? null : type);
              }}
            >
              {REACTIONS[type].emoji}
            </button>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => onChange(current ? null : "like")}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-md py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted",
          active && active.color,
          className,
        )}
      >
        {active ? (
          <span className="text-base leading-none">{active.emoji}</span>
        ) : (
          <ThumbsUp className="h-4 w-4" />
        )}
        {active ? active.label : "Like"}
      </button>
    </div>
  );
}
