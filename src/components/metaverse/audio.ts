import * as THREE from "three";

/// Spatial audio — ခြေသံတွေကို ဘယ်/ညာ ခွဲကြားရဖို့။
///
/// ★ **အသံဖိုင် တစ်ခုမှ မသုံးဘူး** — ခြေသံ ၄ မျိုးကို download ခိုင်းရင်
///   ဖုန်း data နဲ့ ဝင်လာသူအတွက် ကုန်ကျစရိတ်ဖြစ်တယ်။ ဒီနေရာမှာ noise burst
///   (filtered white noise + envelope) နဲ့ ဖန်တီးတယ် — byte တစ်လုံးမှ
///   မဆွဲဘူး၊ လူတိုင်းရဲ့ ခြေသံလည်း အနည်းငယ်စီ ကွဲတယ် (id ကနေ တွက်လို့)။
/// ★ **Browser က user gesture မရှိဘဲ audio ကို ခွင့်မပြုဘူး** — ဒါကြောင့်
///   default က ပိတ်ထားပြီး ခလုတ်တစ်ခုနဲ့မှ ဖွင့်ရတယ်။ ဖွင့်ခြင်းမရှိဘဲ
///   AudioContext ဆောက်ရင် "suspended" အဖြစ် ကျန်နေပြီး ဘာသံမှ မထွက်ဘဲ
///   memory ပဲ စားနေမယ်။
/// ★ AudioContext က lazy — ပိတ်ထားသရွေ့ လုံးဝ မဆောက်ဘူး။

export type SpatialAudio = {
  readonly enabled: boolean;
  /// ★ user gesture (click/tap) ထဲကနေသာ ခေါ်ရမယ်
  enable(): Promise<boolean>;
  disable(): void;
  /// နားထောင်သူ = ကင်မရာ။ Frame တိုင်း ခေါ်ရမယ် — မဟုတ်ရင် လှည့်လိုက်တဲ့အခါ
  /// အသံက နေရာဟောင်းမှာ ကျန်နေမယ်။
  syncListener(camera: THREE.Camera): void;
  /// Player တစ်ယောက်ရဲ့ ရွေ့လျားမှု — cadence ကို ဒီထဲမှာ တွက်ပြီး အချိန်တန်မှ
  /// ခြေသံ ထုတ်တယ်။ ခေါ်တဲ့ဘက်က "ခြေချပြီလား" စဉ်းစားစရာမလိုဘူး။
  move(
    id: string,
    x: number,
    y: number,
    z: number,
    speed: number,
    dt: number,
    airborne: boolean,
  ): void;
  /// ထွက်သွားတဲ့ player ရဲ့ node တွေ ရှင်း
  drop(id: string): void;
  dispose(): void;
};

/// ခြေတစ်လှမ်း အလျား (မီတာ) — ဒီထက် ကျဲရင် ခြေသံက နှေးလွန်းပြီး ရုပ်ရှင်ထဲက
/// slow motion လို ဖြစ်တယ်။
const STRIDE_WALK = 1.05;
const STRIDE_RUN = 1.85;

type Source = {
  panner: PannerNode;
  /// ခြေချဖို့ ကျန်နေတဲ့ အကွာအဝေး
  phase: number;
  /// id ကနေ တွက်ထားတဲ့ အသံအနိမ့်အမြင့် — လူတိုင်း ခြေသံ မတူဖို့
  tone: number;
};

function toneFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return 0.82 + (h % 100) / 250; // 0.82 – 1.22
}

export function createSpatialAudio(): SpatialAudio {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let on = false;
  const sources = new Map<string, Source>();

  // ကင်မရာရဲ့ ဦးတည်ရာ တွက်ဖို့ — frame တိုင်း အသစ်မဆောက်ဘူး
  const fwd = new THREE.Vector3();
  const up = new THREE.Vector3();
  const pos = new THREE.Vector3();

  /// ၀.၂ စက္ကန့်စာ white noise — source တိုင်းက ဒီ buffer တစ်ခုတည်းကို
  /// မျှသုံးတယ် (playbackRate နဲ့ filter က တစ်ယောက်နဲ့တစ်ယောက် ကွဲစေတယ်)။
  function makeNoise(c: AudioContext): AudioBuffer {
    const len = Math.floor(c.sampleRate * 0.2);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      // အဆုံးဘက် တဖြည်းဖြည်း သေးသွားအောင် — "ဖွတ်" ဆိုတဲ့ ခြေသံပုံစံ
      const decay = (1 - i / len) ** 3;
      data[i] = (Math.random() * 2 - 1) * decay;
    }
    return buf;
  }

  function ensureSource(id: string): Source | null {
    if (!ctx || !master) return null;
    const found = sources.get(id);
    if (found) return found;
    const panner = ctx.createPanner();
    // ★ HRTF က နားနှစ်ဖက်ရဲ့ အချိန်ကွာဟမှုကို တွက်တာမို့ ဘယ်/ညာ ခွဲကြားရတယ်။
    // "equalpower" က အသံကျယ်/တိုးပဲ ပြောင်းတာမို့ ဦးတည်ရာ မသိရဘူး။
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = 3;
    panner.maxDistance = 40;
    panner.rolloffFactor = 1.4;
    panner.connect(master);
    const src: Source = { panner, phase: 0, tone: toneFor(id) };
    sources.set(id, src);
    return src;
  }

  function setPannerPos(p: PannerNode, x: number, y: number, z: number) {
    if (p.positionX) {
      p.positionX.value = x;
      p.positionY.value = y;
      p.positionZ.value = z;
    } else {
      // Safari အဟောင်း — deprecated ပေမယ့် ဒီမှာပဲ ရှိတယ်
      p.setPosition(x, y, z);
    }
  }

  function footstep(src: Source, x: number, y: number, z: number) {
    if (!ctx || !noise) return;
    const now = ctx.currentTime;

    const node = ctx.createBufferSource();
    node.buffer = noise;
    node.playbackRate.value = src.tone * (0.9 + Math.random() * 0.2);

    // Lowpass — ကြမ်းပြင်ကို ဆောင့်လိုက်တဲ့ "ဒုန်း" သံ ဖြစ်အောင်။ ဖယ်လိုက်ရင်
    // radio static လို နားထဲ စူးတယ်။
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 780 * src.tone;
    lp.Q.value = 0.9;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.5, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    node.connect(lp).connect(gain).connect(src.panner);
    setPannerPos(src.panner, x, y, z);
    node.start(now);
    node.stop(now + 0.2);
    // ★ Node တွေကို ကိုယ်တိုင် ဖြုတ်ရမယ် — ခြေသံ တစ်သောင်းပြီးရင်
    // disconnect မလုပ်ထားတဲ့ node တွေ စုပုံနေမယ်။
    node.onended = () => {
      node.disconnect();
      lp.disconnect();
      gain.disconnect();
    };
  }

  const api: SpatialAudio = {
    get enabled() {
      return on;
    },

    async enable() {
      try {
        if (!ctx) {
          const Ctor =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext;
          if (!Ctor) return false;
          ctx = new Ctor();
          master = ctx.createGain();
          master.gain.value = 0.55;
          master.connect(ctx.destination);
          noise = makeNoise(ctx);
        }
        // ★ gesture ထဲက ခေါ်မှ resume() အလုပ်လုပ်တယ်
        await ctx.resume();
        on = ctx.state === "running";
        return on;
      } catch {
        return false;
      }
    },

    disable() {
      on = false;
      void ctx?.suspend();
    },

    syncListener(camera) {
      if (!on || !ctx) return;
      camera.getWorldPosition(pos);
      camera.getWorldDirection(fwd);
      up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      const l = ctx.listener;
      if (l.positionX) {
        l.positionX.value = pos.x;
        l.positionY.value = pos.y;
        l.positionZ.value = pos.z;
        l.forwardX.value = fwd.x;
        l.forwardY.value = fwd.y;
        l.forwardZ.value = fwd.z;
        l.upX.value = up.x;
        l.upY.value = up.y;
        l.upZ.value = up.z;
      } else {
        l.setPosition(pos.x, pos.y, pos.z);
        l.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
      }
    },

    move(id, x, y, z, speed, dt, airborne) {
      if (!on || !ctx) return;
      const src = ensureSource(id);
      if (!src) return;
      setPannerPos(src.panner, x, y + 0.2, z);

      // လေထဲမှာ ဒါမှမဟုတ် ရပ်နေရင် ခြေသံမရှိဘူး၊ phase ကို ပြန်ချိန်ထားတယ် —
      // ပြန်လျှောက်တာနဲ့ ချက်ချင်း ခြေတစ်လှမ်း ကျအောင်။
      if (airborne || speed < 0.4) {
        src.phase = STRIDE_WALK * 0.55;
        return;
      }
      const stride = speed > 5 ? STRIDE_RUN : STRIDE_WALK;
      src.phase -= speed * dt;
      if (src.phase <= 0) {
        src.phase += stride;
        footstep(src, x, y, z);
      }
    },

    drop(id) {
      const src = sources.get(id);
      if (!src) return;
      src.panner.disconnect();
      sources.delete(id);
    },

    dispose() {
      on = false;
      for (const s of sources.values()) s.panner.disconnect();
      sources.clear();
      master?.disconnect();
      void ctx?.close().catch(() => {});
      ctx = null;
      master = null;
      noise = null;
    },
  };

  return api;
}
