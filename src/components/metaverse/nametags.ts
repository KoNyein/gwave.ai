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
  add(id: string, name: string, authed: boolean, pic?: string | null): void;
  rename(id: string, name: string): void;
  /// 🖼 Profile ဓာတ်ပုံ ပြ/ဖျောက် — null = ဖျောက်။ https URL သာ ပြတယ်
  /// (server ကလည်း စစ်ထားပေမယ့် ဒီမှာ ထပ်ကာတယ် — defense in depth)။
  setPic(id: string, url: string | null): void;
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

/// URL ကာကွယ်ချက် — https + ကိုယ့် origin (ဒါမှမဟုတ် ကိုယ့် site က ပြပြီး
/// သား S3/CDN) ကသာ ပုံပြခွင့်ရှိတယ်။ Client တစ်ယောက်က ကြိုက်တဲ့ URL
/// ပို့လာလို့ရလို့ — ပြင်ပ host ဆီ ပုံတောင်း request မထွက်စေရဘူး
/// (IP leak / tracking pixel ဖြစ်နိုင်လို့)။
function safePicUrl(url: string | null): string | null {
  if (!url || !url.startsWith("https://")) return null;
  try {
    const u = new URL(url);
    const cdn = process.env.NEXT_PUBLIC_S3_CDN;
    if (u.origin === window.location.origin) return url;
    if (cdn && url.startsWith(cdn)) return url;
    // Production origin — app WebView ထဲမှာ origin က gwave.cc ပဲ ဖြစ်ပေမယ့်
    // localhost dev မှာလည်း production ပုံတွေ ပြလို့ရအောင်
    if (u.hostname === "gwave.cc" || u.hostname.endsWith(".gwave.cc")) return url;
    return null;
  } catch {
    return null;
  }
}

export function createNametags(host: HTMLElement): Nametags {
  const tags = new Map<string, { el: HTMLElement; img: HTMLImageElement; text: HTMLElement }>();
  const v = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  let last = 0;

  const applyPic = (t: { img: HTMLImageElement }, url: string | null) => {
    const safe = safePicUrl(url);
    if (safe) {
      t.img.src = safe;
      t.img.style.display = "block";
    } else {
      t.img.removeAttribute("src");
      t.img.style.display = "none";
    }
  };

  return {
    add(id, name, authed, pic = null) {
      if (tags.has(id)) return;
      const el = document.createElement("div");
      el.className =
        "pointer-events-none absolute left-0 top-0 flex flex-col items-center will-change-transform";
      el.style.opacity = "0";
      // 🖼 Profile ဓာတ်ပုံ — နာမည်အပေါ် စက်ဝိုင်းပုံသေး (ပြထားသူသာ)
      const img = document.createElement("img");
      img.className = "mb-0.5 h-9 w-9 rounded-full border border-white/40 object-cover shadow";
      img.style.display = "none";
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      img.onerror = () => {
        img.style.display = "none";
      };
      el.appendChild(img);
      const text = document.createElement("div");
      text.className =
        "whitespace-nowrap rounded bg-black/55 px-1.5 py-0.5 text-[11px] leading-none text-white/90 backdrop-blur-sm";
      // ★ textContent — innerHTML မသုံးရ။ နာမည်က ဧည့်သည်တစ်ယောက်က
      // ကိုယ်တိုင်ပေးတာမို့ HTML အဖြစ် ဘယ်တော့မှ မသုံးရဘူး။
      text.textContent = authed ? name : `${name} · ဧည့်သည်`;
      el.appendChild(text);
      host.appendChild(el);
      const t = { el, img, text };
      tags.set(id, t);
      applyPic(t, pic);
    },
    rename(id, name) {
      const t = tags.get(id);
      if (!t) return;
      // ဧည့်သည်အမှတ်အသားက server ရဲ့ authed အလံကနေသာ လာတယ်၊ ဒီမှာ
      // ရှိပြီးသားကို ထိန်းထားတယ် (ဧည့်သည်ကသာ နာမည်ပြောင်းလို့ရတယ်)
      t.text.textContent = `${name} · ဧည့်သည်`;
    },
    setPic(id, url) {
      const t = tags.get(id);
      if (t) applyPic(t, url);
    },
    remove(id) {
      const t = tags.get(id);
      if (!t) return;
      t.el.remove();
      tags.delete(id);
    },
    update(camera, width, height, people) {
      const now = performance.now();
      if (now - last < UPDATE_GAP_MS) return;
      last = now;
      camera.getWorldPosition(camPos);

      for (const p of people) {
        const el = tags.get(p.id)?.el;
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
      for (const t of tags.values()) t.el.remove();
      tags.clear();
    },
  };
}
