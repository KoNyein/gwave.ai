"use client";

import * as React from "react";
import { BookOpen } from "lucide-react";

/** Collapsible "how to use this tool" panel, in Burmese. */
export function ToolGuide({ steps }: { steps: string[] }) {
  const [open, setOpen] = React.useState(false);
  if (steps.length === 0) return null;
  return (
    <div className="rounded-lg border bg-muted/40 p-2.5 text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between font-medium"
      >
        <span className="flex items-center gap-1.5">
          <BookOpen className="h-4 w-4 text-primary" /> အသုံးပြုနည်း လမ်းညွှန်
        </span>
        <span className="text-muted-foreground">{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          {steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
