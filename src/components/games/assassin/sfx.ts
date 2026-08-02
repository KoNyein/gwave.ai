/// Assassin — အသံ အကျိုးသက်ရောက်မှုများ (Web Audio နဲ့ တိုက်ရိုက် ဖန်တီး)。
///
/// ★ ဘာလို့ audio file မသုံးလဲ — .mp3 ဆယ်ခုဆိုရင် download အပို၊ CDN
///   မှီခိုမှု (CSP က ပြင်ပ host ကို ပိတ်ထားတယ်)၊ ပြီးတော့ ပထမဆုံး
///   ပစ်ချက်မှာ အသံ နောက်ကျတယ်။ ဖန်တီးထားတာက byte ၀၊ latency ၀။
/// ★ "ရုပ်တည်" ဆန်စေတဲ့ အချက်က **envelope** ပါ — သေနတ်သံဆိုတာ
///   ဆူညံသံ တစ်ချက် (crack) + နိမ့်တဲ့ တုန်ခါမှု (body) + ပဲ့တင်သံ
///   (tail) ပေါင်းစပ်ထားတာ။ တစ်ခုတည်းဆိုရင် အရုပ်ဆိုးတယ်။
/// ★ Browser က user gesture မလုပ်ခင် audio ကို ခွင့်မပြုဘူး — ဒါကြောင့်
///   `resume()` ကို ပထမဆုံး နှိပ်ချက်မှာ ခေါ်ရတယ်။

type Ctx = AudioContext;

export type Sfx = {
  resume(): void;
  shot(weapon: string): void;
  /// ကိုယ့်ပစ်ချက် ထိသွားပြီ — ခေါင်းဆိုရင် ကွဲပြားတဲ့ အသံ
  hitMarker(head: boolean): void;
  /// ကိုယ် ထိခံရတယ်
  hurt(): void;
  reload(): void;
  kill(correct: boolean): void;
  step(): void;
  setVolume(v: number): void;
  dispose(): void;
};

/// ဆူညံသံ buffer — သေနတ်သံရဲ့ အခြေခံ။ တစ်ခါပဲ ဆောက်ပြီး ပြန်သုံးတယ်။
function noiseBuffer(ctx: Ctx, seconds: number): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function createSfx(volume = 0.7): Sfx {
  let ctx: Ctx | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let vol = clamp01(volume);

  function ensure(): Ctx | null {
    if (typeof window === "undefined") return null;
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = vol;
      master.connect(ctx.destination);
      noise = noiseBuffer(ctx, 1);
    }
    return ctx;
  }

  /// ဆူညံသံ တစ်ချက် — filter နဲ့ envelope နဲ့ ပုံဖော်တယ်
  function burst(opts: {
    dur: number;
    gain: number;
    type: BiquadFilterType;
    freq: number;
    q?: number;
    delay?: number;
  }) {
    const c = ensure();
    if (!c || !master || !noise) return;
    const t = c.currentTime + (opts.delay ?? 0);
    const src = c.createBufferSource();
    src.buffer = noise;
    const filter = c.createBiquadFilter();
    filter.type = opts.type;
    filter.frequency.value = opts.freq;
    filter.Q.value = opts.q ?? 1;
    const g = c.createGain();
    // ★ ချက်ချင်း တက်ပြီး မြန်မြန် ကျတာက "ပေါက်ကွဲသံ" ဆန်စေတယ် —
    //   ဖြည်းဖြည်းတက်ရင် လေမှုတ်သံလို ဖြစ်သွားတယ်။
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + opts.dur + 0.02);
  }

  /// အသံစဉ် တစ်ခု — hit marker, reload စတာတွေအတွက်
  function tone(opts: {
    freq: number;
    to?: number;
    dur: number;
    gain: number;
    type?: OscillatorType;
    delay?: number;
  }) {
    const c = ensure();
    if (!c || !master) return;
    const t = c.currentTime + (opts.delay ?? 0);
    const osc = c.createOscillator();
    osc.type = opts.type ?? "square";
    osc.frequency.setValueAtTime(opts.freq, t);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + opts.dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + opts.dur + 0.02);
  }

  return {
    resume() {
      const c = ensure();
      if (c && c.state === "suspended") void c.resume();
    },

    /// ★ လက်နက်တစ်ခုချင်းစီ ကွဲပြားရမယ် — အသံကြားရုံနဲ့ ဘယ်လက်နက်လဲ
    ///   သိရတာက တကယ့် ကစားမှုအချက်အလက် (ဘေးမှာ စနိုက်ပါ ရှိလား)。
    shot(weapon: string) {
      switch (weapon) {
        case "sniper":
          // ကျယ်ပြီး နိမ့်တဲ့ ပဲ့တင်သံ ရှည်ရှည်
          burst({ dur: 0.5, gain: 0.9, type: "lowpass", freq: 1700 });
          burst({ dur: 0.9, gain: 0.28, type: "lowpass", freq: 420, delay: 0.05 });
          tone({ freq: 90, to: 45, dur: 0.35, gain: 0.35, type: "sine" });
          break;
        case "shotgun":
          burst({ dur: 0.34, gain: 0.95, type: "lowpass", freq: 1100 });
          burst({ dur: 0.5, gain: 0.3, type: "lowpass", freq: 300, delay: 0.03 });
          tone({ freq: 70, to: 38, dur: 0.3, gain: 0.4, type: "sine" });
          break;
        case "revolver":
          burst({ dur: 0.3, gain: 0.85, type: "bandpass", freq: 1500, q: 0.8 });
          tone({ freq: 120, to: 55, dur: 0.22, gain: 0.3, type: "sine" });
          break;
        case "smg":
          // တိုတိုနဲ့ ခပ်မြင့်မြင့် — အဆက်မပြတ် ပစ်လို့ တိုရမယ်
          burst({ dur: 0.1, gain: 0.5, type: "bandpass", freq: 2400, q: 0.9 });
          break;
        case "knife":
          burst({ dur: 0.12, gain: 0.35, type: "highpass", freq: 3000 });
          tone({ freq: 2400, to: 900, dur: 0.1, gain: 0.12, type: "triangle" });
          break;
        case "bomb":
          burst({ dur: 0.8, gain: 1.0, type: "lowpass", freq: 700 });
          tone({ freq: 60, to: 28, dur: 0.7, gain: 0.5, type: "sine" });
          break;
        default:
          burst({ dur: 0.22, gain: 0.7, type: "bandpass", freq: 1900, q: 0.9 });
          tone({ freq: 140, to: 65, dur: 0.16, gain: 0.22, type: "sine" });
      }
    },

    /// ★ ထိမှန်ကြောင်း အသံက ဂိမ်းရဲ့ အရေးအကြီးဆုံး တုံ့ပြန်ချက် —
    ///   မမြင်ရတဲ့ အကွာအဝေးကနေ ပစ်တဲ့အခါ ဒါတစ်ခုတည်းက အဖြေ။
    hitMarker(head: boolean) {
      if (head) {
        tone({ freq: 1400, dur: 0.07, gain: 0.3, type: "square" });
        tone({ freq: 2100, dur: 0.09, gain: 0.28, type: "square", delay: 0.06 });
      } else {
        tone({ freq: 1050, dur: 0.06, gain: 0.24, type: "square" });
      }
    },

    hurt() {
      burst({ dur: 0.2, gain: 0.5, type: "lowpass", freq: 600 });
      tone({ freq: 220, to: 110, dur: 0.2, gain: 0.2, type: "sawtooth" });
    },

    reload() {
      // ချောင်းသံ ၂ ချက် — ကျည်ထုတ်/ကျည်သွင်း
      burst({ dur: 0.06, gain: 0.3, type: "bandpass", freq: 2600, q: 2 });
      burst({ dur: 0.08, gain: 0.35, type: "bandpass", freq: 1800, q: 2, delay: 0.16 });
    },

    kill(correct: boolean) {
      if (correct) {
        // တက်သွားတဲ့ သံစဉ် — အောင်မြင်မှု
        tone({ freq: 660, dur: 0.1, gain: 0.26, type: "triangle" });
        tone({ freq: 880, dur: 0.12, gain: 0.26, type: "triangle", delay: 0.09 });
        tone({ freq: 1320, dur: 0.16, gain: 0.24, type: "triangle", delay: 0.19 });
      } else {
        // ★ လူမှားသတ်မိတာကို **ချက်ချင်း သိရမယ်** — ကျသွားတဲ့ သံစဉ်။
        tone({ freq: 400, to: 160, dur: 0.35, gain: 0.3, type: "sawtooth" });
      }
    },

    step() {
      burst({ dur: 0.05, gain: 0.09, type: "lowpass", freq: 520 });
    },

    setVolume(v: number) {
      vol = clamp01(v);
      if (master) master.gain.value = vol;
    },

    dispose() {
      void ctx?.close();
      ctx = null;
      master = null;
      noise = null;
    },
  };
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
