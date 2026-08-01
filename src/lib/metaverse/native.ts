/// Gwave Android app ရဲ့ WebView bridge (Phase 17)。
///
/// ★ **Native မရှိလည်း အားလုံး အလုပ်လုပ်ရမယ်** — browser မှာ ဖွင့်တဲ့သူက
///   အများစုဖြစ်တယ်။ ဒါကြောင့် function တိုင်းက native မရှိရင် တိတ်တိတ်
///   ဘာမှမလုပ်ဘဲ ပြန်တယ်၊ ဘယ်တော့မှ မကျဘူး။
/// ★ Bridge က page load ပြီးမှ ရောက်တတ်တယ် (Android က script ကို
///   onPageStarted/onPageFinished မှာ ထည့်တယ်) — ဒါကြောင့် `isInApp()` က
///   **URL ရဲ့ `app=1`** ကို ကြည့်တယ်။ Bridge ကို စောင့်နေရင် ပထမ frame
///   အတွက် အရည်အသွေး ဆုံးဖြတ်ချက် နောက်ကျမယ်။

type NativeApi = {
  v: number;
  platform: string;
  vibrate(ms: number): void;
  setKeepAwake(on: boolean): void;
  openNative(route: string): void;
  onMetaverseReady(): void;
};

declare global {
  interface Window {
    GwaveNative?: NativeApi;
  }
}

/// App ထဲမှာ ဖွင့်နေလား။
///
/// ★ Bridge မရောက်သေးလည်း မှန်ကန်စွာ ဖြေနိုင်ရမယ် — Flutter screen က URL မှာ
///   `app=1` အမြဲ ထည့်ပေးတယ်။
export function isInApp(): boolean {
  if (typeof window === "undefined") return false;
  if (window.GwaveNative) return true;
  try {
    return new URLSearchParams(window.location.search).get("app") === "1";
  } catch {
    return false;
  }
}

/// Bridge ရောက်ပြီးမှ လုပ်ရမယ့်အရာအတွက်။ App ထဲ မဟုတ်ရင် `null` နဲ့
/// ချက်ချင်း ပြန်တယ် — browser မှာ ဘယ်တော့မှ မစောင့်ဘူး။
export function whenNative(timeoutMs = 2500): Promise<NativeApi | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.GwaveNative) return Promise.resolve(window.GwaveNative);
  if (!isInApp()) return Promise.resolve(null);

  return new Promise((resolve) => {
    let done = false;
    const finish = (api: NativeApi | null) => {
      if (done) return;
      done = true;
      window.removeEventListener("gwave-native-ready", onReady);
      clearTimeout(timer);
      resolve(api);
    };
    const onReady = () => finish(window.GwaveNative ?? null);
    // ★ Timeout မထားရင် app ရဲ့ bridge ကျနေတဲ့အခါ promise က ဘယ်တော့မှ
    // မပြီးဘဲ ကျန်နေမယ် (ခေါ်တဲ့ဘက်က await လုပ်ရင် ထိုင်နေမယ်)。
    const timer = setTimeout(() => finish(null), timeoutMs);
    window.addEventListener("gwave-native-ready", onReady);
  });
}

/// အောက်က helper တွေက native ရှိမှသာ အလုပ်လုပ်တယ်။
export const native = {
  vibrate(ms: number) {
    try {
      window.GwaveNative?.vibrate(ms);
    } catch {
      /* bridge ကျနေလည်း လောကက ဆက်လည်ရမယ် */
    }
  },
  setKeepAwake(on: boolean) {
    try {
      window.GwaveNative?.setKeepAwake(on);
    } catch {
      /* ignore */
    }
  },
  ready() {
    try {
      window.GwaveNative?.onMetaverseReady();
    } catch {
      /* ignore */
    }
  },
  back() {
    try {
      window.GwaveNative?.openNative("back");
    } catch {
      /* ignore */
    }
  },
};
