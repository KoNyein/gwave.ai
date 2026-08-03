/// Client netcode (Arena spec A5.3) — prediction, reconciliation, interpolation。
///
/// ★ ဖြေရှင်းနေတဲ့ ပြဿနာ ၂ ခု —
///
///   ၁။ **ကိုယ့်ရွေ့လျားမှု** — server ကို စောင့်ပြီးမှ ရွှေ့ရင် ping 200ms
///      ဆိုတာ ခလုတ်နှိပ်ပြီး ၀.၂ စက္ကန့်မှ ရွေ့တာ။ ဒါက မကစားနိုင်ဘူး။
///      ဖြေရှင်းချက် — ချက်ချင်း ရွှေ့လိုက်တယ် (prediction)၊ server ရဲ့
///      အဖြေ ရောက်လာမှ ကွာချက်ကို ညှိတယ် (reconciliation)。
///
///   ၂။ **တခြားသူတွေ** — snapshot က ၂၀Hz ပဲ ရောက်တယ်၊ ဖန်သားပြင်က 60fps。
///      တိုက်ရိုက် ပြရင် စက္ကန့်မှာ ၂၀ ခါ ခုန်တယ်။ ဖြေရှင်းချက် — snapshot
///      ၂ ခုကြားမှာ ကြားညှိတယ် (interpolation)。
///
/// ★ **Extrapolate မလုပ်ရ** — နောက်ကို ခန့်မှန်းပြီး ရှေ့ဆက်ပြရင်၊ တကယ့်
///   ကစားသမားက ရပ်လိုက်တဲ့အခါ နောက်ပြန် ခုန်တယ်။ ၁၀၀ms နောက်ကျပြီး
///   မှန်တာက၊ အချိန်မှန်ပြီး ခုန်တာထက် ကောင်းတယ်။

export type InputCmd = {
  seq: number;
  /// ရွေ့လျားမှု ဦးတည်ချက် (ကမ္ဘာ့ဝင်ရိုး)
  mx: number;
  mz: number;
  /// ဒီ input က ဘယ်လောက်ကြာ အကျုံးဝင်လဲ (စက္ကန့်)
  dt: number;
  run: boolean;
};

export type Vec2 = { x: number; z: number };

/// လမ်းလျှောက်/ပြေး အမြန်နှုန်း。 ★ server ရဲ့ anti-cheat cap
/// (`MAX_SPEED = 8.4`) အောက်မှာ ရှိရမယ် — မဟုတ်ရင် ပုံမှန် ပြေးရုံနဲ့
/// server က ငြင်းပြီး ကစားသမား နောက်ပြန် ဆွဲခံရမယ်။
export const WALK_SPEED = 3.4;
export const RUN_SPEED = 7.2;

/// ★ ဒီထက် ကွာရင် ချက်ချင်း ရွှေ့တယ် (ညင်သာစွာ ဆွဲရင် ကြာလွန်းမယ်)。
const SNAP_THRESHOLD = 2;
/// ညင်သာစွာ ညှိတဲ့ နှုန်း — ၁ ဆိုရင် ချက်ချင်း၊ ၀ ဆိုရင် ဘယ်တော့မှ မညှိဘူး။
const EASE = 0.2;
/// ★ Interpolation buffer — snapshot ၂ ခုကြား ကြားညှိဖို့ ဒီလောက် နောက်ကျ
///   ပြတယ်။ ၂၀Hz ဆိုတော့ tick တစ်ခုက ၅၀ms — ၁၀၀ms က tick ၂ ခုစာ၊
///   တစ်ခု ပျောက်သွားလည်း ချောမွေ့နေဆဲ။
export const INTERP_DELAY_MS = 100;

/// ★ တစ်ခုတည်းသော ရွေ့လျားမှု တွက်နည်း — client ရော server ရော ဒါကိုပဲ
///   သုံးရမယ်။ ၂ နေရာမှာ သီးသန့် ရေးထားရင် ဘယ်လောက်ပဲ တူအောင် ရေးရေး
///   တဖြည်းဖြည်း ကွဲသွားပြီး ကစားသမားက အမြဲ နောက်ပြန် ဆွဲခံရမယ်။
export function simulateMove(pos: Vec2, cmd: InputCmd): Vec2 {
  const len = Math.hypot(cmd.mx, cmd.mz);
  if (len < 1e-4) return { ...pos };
  const speed = cmd.run ? RUN_SPEED : WALK_SPEED;
  const step = speed * cmd.dt;
  return {
    x: pos.x + (cmd.mx / len) * step,
    z: pos.z + (cmd.mz / len) * step,
  };
}

/// ကိုယ့်ရွေ့လျားမှုကို ခန့်မှန်းပြီး၊ server အဖြေနဲ့ ညှိတယ်။
export function createPredictor(start: Vec2) {
  let pos: Vec2 = { ...start };
  let seq = 0;
  /// ★ server မှ အတည်မပြုရသေးတဲ့ input များ — reconciliation မှာ
  ///   server နေရာပေါ်ကနေ ဒါတွေကို ပြန်အသုံးချတယ်။
  const pending: InputCmd[] = [];

  return {
    get position(): Vec2 {
      return { ...pos };
    },
    get pendingCount(): number {
      return pending.length;
    },

    /// Input တစ်ခု — ချက်ချင်း ရွှေ့ပြီး၊ ပို့ဖို့ command ကို ပြန်ပေးတယ်။
    apply(mx: number, mz: number, dt: number, run: boolean): InputCmd {
      const cmd: InputCmd = { seq: ++seq, mx, mz, dt, run };
      pos = simulateMove(pos, cmd);
      pending.push(cmd);
      // ★ အကန့်အသတ်မဲ့ မကြီးလာစေရ — server ဆီက ack ဘယ်တော့မှ
      //   မရောက်ရင် (ပြတ်နေရင်) memory ကုန်မယ်။
      if (pending.length > 240) pending.splice(0, pending.length - 240);
      return cmd;
    },

    /// Server ရဲ့ အဖြေ ရောက်လာပြီ — အတည်ပြုပြီးသား input တွေကို ဖယ်ပြီး
    /// ကျန်တာကို server နေရာပေါ်ကနေ ပြန်တွက်တယ်။
    reconcile(authoritative: Vec2, ackSeq: number): { corrected: boolean; error: number } {
      while (pending.length && pending[0]!.seq <= ackSeq) pending.shift();

      let replayed: Vec2 = { ...authoritative };
      for (const cmd of pending) replayed = simulateMove(replayed, cmd);

      const error = Math.hypot(replayed.x - pos.x, replayed.z - pos.z);
      if (error > SNAP_THRESHOLD) {
        // ★ ကွာလွန်းရင် ချက်ချင်း — ညင်သာစွာ ဆွဲရင် ကစားသမားက
        //   နံရံထဲ လျှောက်နေတဲ့ ခံစားချက် ရမယ်။
        pos = replayed;
        return { corrected: true, error };
      }
      if (error > 0.01) {
        pos = {
          x: pos.x + (replayed.x - pos.x) * EASE,
          z: pos.z + (replayed.z - pos.z) * EASE,
        };
      }
      return { corrected: false, error };
    },

    /// Teleport (ပွဲစချင်း spawn စတာ) — ခန့်မှန်းချက်အားလုံး ဖျက်တယ်။
    reset(to: Vec2) {
      pos = { ...to };
      pending.length = 0;
    },
  };
}

export type RemoteSample = { t: number; x: number; y: number; z: number; ry: number };

/// တခြားကစားသမားတွေကို ချောမွေ့စွာ ပြဖို့ — snapshot ၂ ခုကြား ကြားညှိတယ်။
export function createInterpolator() {
  /// id -> နမူနာ (အချိန်အလိုက်)
  const tracks = new Map<string, RemoteSample[]>();

  return {
    /// Snapshot တစ်ခု ရောက်လာပြီ။
    push(id: string, sample: RemoteSample) {
      let track = tracks.get(id);
      if (!track) {
        track = [];
        tracks.set(id, track);
      }
      // ★ အစဉ်လွဲ ရောက်လာတာကို ပစ် — အဟောင်းကို ထည့်လိုက်ရင် ကြားညှိမှုက
      //   နောက်ပြန် ဆွဲသွားမယ်။
      const last = track[track.length - 1];
      if (last && sample.t <= last.t) return;
      track.push(sample);
      // ၂ စက္ကန့်ထက် ဟောင်းတာ မလိုတော့ဘူး
      while (track.length > 2 && track[1]!.t < sample.t - 2000) track.shift();
    },

    remove(id: string) {
      tracks.delete(id);
    },

    ids(): string[] {
      return [...tracks.keys()];
    },

    /// `now` (client နာရီ) မှာ ဒီကစားသမား ဘယ်နေရာမှာ ရှိသင့်လဲ။
    /// ★ `INTERP_DELAY_MS` နောက်ကျပြီး ပြတယ် — ဒါမှ ကြားညှိဖို့
    ///   နမူနာ ၂ ခု လက်ထဲမှာ ရှိမယ်။
    sample(id: string, now: number): RemoteSample | null {
      const track = tracks.get(id);
      if (!track || track.length === 0) return null;
      const target = now - INTERP_DELAY_MS;

      if (track.length === 1) return track[0]!;
      // ရှေ့ဆုံးထက် အရင် — အဟောင်းဆုံးကို ပြ
      if (target <= track[0]!.t) return track[0]!;
      // နောက်ဆုံးထက် နောက်ကျ — ★ extrapolate မလုပ်ဘဲ ရပ်ထားတယ်
      const newest = track[track.length - 1]!;
      if (target >= newest.t) return newest;

      for (let i = 0; i < track.length - 1; i++) {
        const a = track[i]!;
        const b = track[i + 1]!;
        if (target >= a.t && target <= b.t) {
          const span = b.t - a.t || 1;
          const k = (target - a.t) / span;
          return {
            t: target,
            x: a.x + (b.x - a.x) * k,
            y: a.y + (b.y - a.y) * k,
            z: a.z + (b.z - a.z) * k,
            // ★ ထောင့်ကို တိုတဲ့ဘက်က ညှိရမယ် — 350° ကနေ 10° သွားတာက
            //   ရှေ့ကို ၂၀° လှည့်တာ၊ နောက်ကို ၃၄၀° လှည့်တာ မဟုတ်ဘူး။
            ry: lerpAngle(a.ry, b.ry, k),
          };
        }
      }
      return newest;
    },

    clear() {
      tracks.clear();
    },
  };
}

export function lerpAngle(a: number, b: number, k: number): number {
  const TAU = Math.PI * 2;
  let d = ((b - a) % TAU + TAU) % TAU;
  if (d > Math.PI) d -= TAU;
  return a + d * k;
}
