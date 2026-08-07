"use client";

import * as React from "react";

/**
 * Invisible presence beacon: pings /api/heartbeat once a minute while a
 * signed-in page is open, so this account shows the "Active now" dot in the
 * messenger (app + web). Fire-and-forget — failures are ignored.
 */
export function PresenceHeartbeat() {
  React.useEffect(() => {
    // 🔋 နောက်ကွယ်ရောက်နေချိန် ping မလုပ်ဘူး — tab ဖွင့်ထားရုံနဲ့ တစ်မိနစ်
    // တစ်ခါ network/radio နှိုးနေတာက ဖုန်း battery ကို အလကား စားတယ်။
    // ပြန်ပေါ်တာနဲ့ ချက်ချင်း တစ်ချက် ping ပြန်ပို့တယ် — "Active now" မမှားဘူး။
    const beat = () => {
      if (document.hidden) return;
      void fetch("/api/heartbeat", { method: "POST" }).catch(() => {});
    };
    beat();
    const timer = setInterval(beat, 60_000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);
  return null;
}
