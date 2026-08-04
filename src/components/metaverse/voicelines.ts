/// 🗣 မြန်မာအသံ voice lines — ဖုန်း/browser ရဲ့ **built-in TTS**
/// (speechSynthesis) နဲ့ ပြောတယ်။
///
/// ★ ဘာလို့ TTS လဲ — audio ဖိုင်တွေ ကြိုသွင်းရင် (၁) မြန်မာအသံ recording
///   စတူဒီယို လိုတယ်၊ (၂) ဖိုင်အရွယ် ဒေါင်းရတယ်။ Android ရဲ့ Google TTS
///   မှာ မြန်မာ (my-MM) voice ပါပြီးသားမို့ user အများစုမှာ ချက်ချင်း
///   အလုပ်လုပ်တယ်။ မရှိတဲ့ device မှာ **တိတ်တိတ် ကျော်တယ်** — game
///   မပျက်ဘူး။ နောက်ပိုင်း စတူဒီယို mp3 တွေ ရလာရင် ဒီ module ရဲ့
///   `say()` နောက်ကွယ်ကိုပဲ လဲလိုက်ရုံ။
/// ★ Throttle — line တစ်ခုချင်း ၃ စက္ကန့်၊ စုစုပေါင်း ၁.၂ စက္ကန့် ကြား
///   ခြားတယ်။ kill streak မှာ အသံတွေ ထပ်ပြွတ်နေရင် စကားလုံးတွေ
///   မကြားရတော့ဘူး။
/// ★ NPC (ဓားပြ) စကားက pitch နိမ့်နိမ့် — ကိုယ့်ကြေညာသံနဲ့ ကွဲအောင်။

export type VoiceKey =
  | "start"
  | "win"
  | "kill"
  | "wrongKill"
  | "death"
  | "respawn"
  | "pickup"
  | "befriend"
  | "taunt";

const LINES: Record<VoiceKey, { text: string; npc?: boolean }> = {
  start: { text: "ပွဲစပြီ၊ သတိထား" },
  win: { text: "အနိုင်ရပြီ" },
  kill: { text: "ပစ်မှတ် ရှင်းပြီ" },
  wrongKill: { text: "လူမှားသွားပြီ" },
  death: { text: "အသတ်ခံရပြီ" },
  respawn: { text: "ပြန်ရှင်ပြီ" },
  pickup: { text: "လက်နက်ရပြီ" },
  /// 🏴‍☠️ ဓားပြ NPC ရဲ့ မြန်မာသံ တုံ့ပြန်ချက်များ
  befriend: { text: "ကောင်းပြီ သူငယ်ချင်း၊ ငါကူမယ်", npc: true },
  taunt: { text: "သတ္တိရှိရင် လာခဲ့", npc: true },
};

const PER_LINE_GAP_MS = 3000;
const GLOBAL_GAP_MS = 1200;

export type VoiceLines = {
  say(key: VoiceKey): void;
  dispose(): void;
};

export function createVoiceLines(): VoiceLines {
  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;
  let myVoice: SpeechSynthesisVoice | null = null;
  let lastGlobal = 0;
  const lastByKey = new Map<VoiceKey, number>();
  let disposed = false;

  const pickVoice = () => {
    if (!supported) return;
    const voices = window.speechSynthesis.getVoices();
    // my-MM အတိအကျ → my* → မတွေ့ရင် null (default voice နဲ့ ကြိုးစားမယ် —
    // မြန်မာစာကို ဖတ်နိုင်တဲ့ default ရှိတတ်လို့)
    myVoice =
      voices.find((v) => v.lang?.toLowerCase() === "my-mm") ??
      voices.find((v) => v.lang?.toLowerCase().startsWith("my")) ??
      null;
  };
  if (supported) {
    pickVoice();
    // Voice list က async ဖြည့်တယ် (Chrome) — ပြည့်မှ ပြန်ရွေး
    window.speechSynthesis.addEventListener?.("voiceschanged", pickVoice);
  }

  return {
    say(key) {
      if (!supported || disposed) return;
      const line = LINES[key];
      if (!line) return;
      const now = Date.now();
      if (now - lastGlobal < GLOBAL_GAP_MS) return;
      if (now - (lastByKey.get(key) ?? 0) < PER_LINE_GAP_MS) return;
      lastGlobal = now;
      lastByKey.set(key, now);
      try {
        const u = new SpeechSynthesisUtterance(line.text);
        if (myVoice) u.voice = myVoice;
        u.lang = "my-MM";
        u.rate = 1.05;
        u.volume = 0.9;
        // NPC သံ — နိမ့်တဲ့ pitch နဲ့ ခွဲပြ
        u.pitch = line.npc ? 0.75 : 1.0;
        window.speechSynthesis.speak(u);
      } catch {
        /* TTS ကျရင် တိတ်တိတ်ပဲ — game ဆက်သွားတယ် */
      }
    },
    dispose() {
      disposed = true;
      if (supported) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* ignore */
        }
        window.speechSynthesis.removeEventListener?.("voiceschanged", pickVoice);
      }
    },
  };
}
