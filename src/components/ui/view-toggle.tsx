"use client";

import * as React from "react";
import { LayoutGrid, LayoutList, Rows3 } from "lucide-react";

import { usePersistentState } from "@/lib/hooks/use-persistent-state";
import { cn } from "@/lib/utils";

/** Display modes a collection can be shown in. */
export type ViewMode = "grid" | "list" | "compact";

const ICONS: Record<ViewMode, typeof LayoutGrid> = {
  grid: LayoutGrid,
  list: LayoutList,
  compact: Rows3,
};

const LABELS: Record<ViewMode, string> = {
  grid: "ကွက်ကွက် (Grid)",
  list: "စာရင်း (List)",
  compact: "ကျစ်လျစ် (Compact)",
};

/**
 * Remembers the viewer's chosen layout for a given collection (per storage
 * key), so games / lessons / other lists reopen in the view they last picked.
 */
export function useViewMode(
  storageKey: string,
  initial: ViewMode = "grid",
): [ViewMode, (m: ViewMode) => void] {
  const [mode, setMode] = usePersistentState<ViewMode>(
    `view.${storageKey}`,
    initial,
  );
  return [mode, setMode];
}

/**
 * A small segmented control letting the user switch how a collection is laid
 * out. Reusable across games, lessons, shop, strains — anywhere a list can be
 * shown more than one way. Pass only the modes you support.
 */
export function ViewToggle({
  value,
  onChange,
  modes = ["grid", "list"],
  className,
}: {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  modes?: ViewMode[];
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="View"
      className={cn("inline-flex rounded-lg border p-0.5", className)}
    >
      {modes.map((m) => {
        const Icon = ICONS[m];
        const active = value === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            aria-label={LABELS[m]}
            aria-pressed={active}
            title={LABELS[m]}
            className={cn(
              "flex h-7 w-8 items-center justify-center rounded-md transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
