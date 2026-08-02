import * as THREE from "three";

/// နာမည်တံဆိပ်တွေ — **3D sprite မဟုတ်ဘဲ DOM**။
///
/// ★ ဘာလို့ DOM လဲ: နာမည်တစ်ခုကို 3D မှာ ပြဖို့ canvas texture တစ်ခုစီ
///   ဆောက်ရမယ် (player ၅၀ = texture ၅၀ + draw call ၅၀)၊ ပြီးတော့ ဗမာစာက
///   ဆက်စပ်အက္ခရာတွေ ရှိလို့ canvas ပေါ်မှာ တစ်ခါတလေ ပုံပျက်တယ်။ DOM မှာ
///   browser ရဲ့ စာစီစနစ်ကို အတိုင်း ရတယ်၊ GPU ကိုလည်း ဘာမှ မထပ်ပေးရဘူး။
/// ★ **transform နဲ့ opacity ပဲ ပြောင်းတယ်** — `left`/`top` ကို ပြောင်းရင်
///   browser က layout ပြန်တွက်တယ် (reflow)၊ player ၅၀ × 10Hz = တစ်စက္ကန့်
///   reflow ၅၀၀ ဖြစ်ပြီး စာရိုက်တာတောင် ခဲသွားမယ်။ transform က compositor
///   အလွှာမှာသာ ဖြစ်တယ်။
/// ★ ၁၀Hz ပဲ update လုပ်တယ် — frame တိုင်း DOM ကို ထိရင် 3D render နဲ့
///   တိုက်တယ်။
///
/// အကွာအဝေးအလိုက် မှိန်စေတယ် (spec 6.1): ၂၈ အောက် ပြည့်ပြ၊ ၄၀ မှာ ပျောက်။

export type Nametags = {
  add(id: string, name: string, authed: boolean): void;
  rename(id: string, name: string): void;
  remove(id: string): void;
  /// Frame တိုင်း ခေါ်လို့ရတယ် — အထဲမှာ ကိုယ်တိုင် နှုန်းချုပ်တယ်
  update(
    camera: THREE.Camera,
    width: number,
    height: number,
    people: Iterable<{ id: string; x: number; y: number; z: number }>,
  ): void;
  dispose(): void;
};

const FULL_AT = 28;
const GONE_AT = 40;
const UPDATE_GAP_MS = 100;

export function createNametags(host: HTMLElement): Nametags {
  const tags = new Map<string, HTMLElement>();
  const v = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  let last = 0;

  return {
    add(id, name, authed) {
      if (tags.has(id)) return;
      const el = document.createElement("div");
      el.className =
        "pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded bg-black/55 px-1.5 py-0.5 text-[11px] leading-none text-white/90 backdrop-blur-sm will-change-transform";
      el.style.opacity = "0";
      // ★ textContent — innerHTML မသုံးရ။ နာမည်က ဧည့်သည်တစ်ယောက်က
      // ကိုယ်တိုင်ပေးတာမို့ HTML အဖြစ် ဘယ်တော့မှ မသုံးရဘူး။
      el.textContent = authed ? name : `${name} · ဧည့်သည်`;
      host.appendChild(el);
      tags.set(id, el);
    },
    rename(id, name) {
      const el = tags.get(id);
      if (!el) return;
      // ဧည့်သည်အမှတ်အသားက server ရဲ့ authed အလံကနေသာ လာတယ်၊ ဒီမှာ
      // ရှိပြီးသားကို ထိန်းထားတယ် (ဧည့်သည်ကသာ နာမည်ပြောင်းလို့ရတယ်)
      el.textContent = `${name} · ဧည့်သည်`;
    },
    remove(id) {
      const el = tags.get(id);
      if (!el) return;
      el.remove();
      tags.delete(id);
    },
    update(camera, width, height, people) {
      const now = performance.now();
      if (now - last < UPDATE_GAP_MS) return;
      last = now;
      camera.getWorldPosition(camPos);

      for (const p of people) {
        const el = tags.get(p.id);
        if (!el) continue;
        const dist = Math.hypot(p.x - camPos.x, p.z - camPos.z);
        if (dist > GONE_AT) {
          el.style.opacity = "0";
          continue;
        }
        v.set(p.x, p.y + 2.05, p.z).project(camera);
        // ★ z > 1 = ကင်မရာရဲ့ နောက်ကွယ် — မစစ်ရင် နောက်ကလူတွေရဲ့ နာမည်တွေ
        // မျက်နှာပြင်ပေါ် ပြန်ပေါ်လာမယ် (project က ပြောင်းပြန် ထွက်လို့)။
        if (v.z > 1) {
          el.style.opacity = "0";
          continue;
        }
        const x = (v.x * 0.5 + 0.5) * width;
        const y = (-v.y * 0.5 + 0.5) * height;
        el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
        el.style.opacity =
          dist <= FULL_AT
            ? "1"
            : String(Math.max(0, 1 - (dist - FULL_AT) / (GONE_AT - FULL_AT)).toFixed(2));
      }
    },
    dispose() {
      for (const el of tags.values()) el.remove();
      tags.clear();
    },
  };
}
