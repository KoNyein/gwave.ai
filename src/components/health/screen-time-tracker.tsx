"use client";

import * as React from "react";
import { Smartphone } from "lucide-react";
import { useLocale } from "next-intl";

import { prefersMyanmarScript } from "@/i18n/config";

import {
  readScreenSeconds,
  screenTimeDayKey,
} from "@/components/health/screen-time-recorder";

/**
 * Display card for today's Gwave screen time. Recording happens app-wide in
 * ScreenTimeRecorder (root layout); this just shows the live figure. Browsers
 * cannot read the phone's overall OS screen time — that can still be entered
 * via the manual log.
 */
export function ScreenTimeTracker() {
  const mm = prefersMyanmarScript(useLocale());
  const [seconds, setSeconds] = React.useState<number | null>(null);

  React.useEffect(() => {
    const refresh = () => setSeconds(readScreenSeconds(screenTimeDayKey()));
    refresh();
    const id = setInterval(refresh, 5_000);
    window.addEventListener("storage", refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const mins = seconds != null ? Math.floor(seconds / 60) : null;

  return (
    <div className="space-y-2 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">Screen time</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        {mm
          ? "Gwave သုံးချိန်ကို စာမျက်နှာတိုင်းမှာ အလိုအလျောက်တိုင်းပြီး နေ့စဉ် sync လုပ်ပေးသည်။ ဖုန်းစုစုပေါင်း screen time ကိုတော့ အောက်က ကိုယ်တိုင်မှတ်တမ်းမှာ ထည့်နိုင်သည်။"
          : "Time in Gwave is tracked automatically on every page and synced daily. Your phone's overall screen time can be added in the manual log below."}
      </p>
      <p className="text-2xl font-bold">
        {mins != null && seconds != null ? (
          <>
            {Math.floor(mins / 60) > 0 ? (mm ? `${Math.floor(mins / 60)} နာရီ ` : `${Math.floor(mins / 60)} hr `) : ""}
            {mm ? `${mins % 60} မိနစ် ${Math.floor(seconds % 60)} စက္ကန့်` : `${mins % 60} min ${Math.floor(seconds % 60)} sec`}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {mm ? "ဒီနေ့ (Gwave)" : "today (Gwave)"}
            </span>
          </>
        ) : (
          "—"
        )}
      </p>
    </div>
  );
}
