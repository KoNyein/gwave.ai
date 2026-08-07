"use client";

import * as React from "react";

/**
 * `setInterval` အစား သုံးရမယ့် hook — **tab မမြင်ရချိန် ရပ်တယ်**။
 *
 * Gwave က page တစ်ခုမှာ poller ဆယ်ခုလောက် တစ်ပြိုင်နက် ဖွင့်ထားတတ်တယ်
 * (feed, presence, viewer count, dashboard, game timer …)။ ပုံမှန်
 * `setInterval` က tab ကို နောက်ပိုင်း ပို့လိုက်လည်း ဆက်ပြေးနေတယ် —
 * အဲဒါက ဖုန်း CPU ပူတာ၊ ဘက်ထရီ ကုန်တာရဲ့ အဓိက အကြောင်းရင်း။
 *
 * ဒီ hook က:
 *  ★ `document.hidden` ဖြစ်နေရင် timer ကို **အပြီး ရပ်** (clearInterval) —
 *    ရိုးရိုး early-return မဟုတ်ဘူး၊ timer ကိုယ်တိုင် မရှိတော့ဘူး။
 *  ★ tab ပြန်ရောက်တဲ့အခါ တစ်ခါ ချက်ချင်း run ပြီး (ဒေတာ အသစ်ဖြစ်ဖို့)
 *    cadence ကို ပြန်စတယ်။ `runOnResume: false` ဆိုရင် cadence ပဲ ပြန်စတယ်။
 *  ★ `ms` က `null` ဆိုရင် လုံးဝ မဖွင့်ဘူး (conditional poller တွေအတွက်)。
 */
export function useVisibleInterval(
  fn: () => void,
  ms: number | null,
  opts?: { runOnResume?: boolean },
) {
  const saved = React.useRef(fn);
  saved.current = fn;
  const runOnResume = opts?.runOnResume !== false;

  React.useEffect(() => {
    if (ms == null) return;
    let id: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (id != null) {
        clearInterval(id);
        id = null;
      }
    };
    const start = () => {
      if (id != null) return;
      id = setInterval(() => saved.current(), ms);
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        if (runOnResume) saved.current();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ms, runOnResume]);
}
