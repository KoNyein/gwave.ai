"use client";

import * as React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Segment error boundary for the (iot) area. Unlike the root
 * global-error, this keeps the app chrome and — importantly — surfaces the
 * error's digest so a screenshot is enough to pinpoint the failing request in
 * the logs. A single crashing page no longer blanks the entire app.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertTriangle className="h-10 w-10 text-amber-500" />
      <div className="space-y-1">
        <h1 className="text-lg font-bold">တစ်ခုခု မှားယွင်းသွားပါတယ်</h1>
        <p className="text-sm text-muted-foreground">
          ဒီစာမျက်နှာကို ဖွင့်ရာတွင် ပြဿနာ တစ်ခု ဖြစ်ခဲ့ပါတယ်။ ထပ်ကြိုးစားကြည့်ပါ။
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <RotateCcw className="h-4 w-4" /> ထပ်ကြိုးစားပါ
      </button>
      {error.digest ? (
        <p className="select-all font-mono text-[11px] text-muted-foreground">
          error id: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
