import type { Collider } from "./world";

/// Minimap — 2D canvas overlay။ 3D မဟုတ်လို့ ဈေးအလွန်ပေါတယ်။
///
/// ★ **10Hz ပဲ ဆွဲတယ်** — frame တိုင်း (60Hz) ဆွဲရင် canvas 2D က main thread
///   ပေါ်မှာ လုပ်တာဖြစ်လို့ 3D render နဲ့ တိုက်ပြီး frame ကျတယ်။ မြေပုံလေးက
///   တစ်စက္ကန့် ၁၀ ခါ update ဖြစ်ရင် လုံလောက်လွန်းတယ် — မျက်လုံးက မခွဲနိုင်ဘူး။
/// ★ Canvas ရဲ့ backing store ကို devicePixelRatio နဲ့ မြှင့်တယ် — မဟုတ်ရင်
///   retina မှာ ဝါးနေမယ်။

export type MinimapTarget = { x: number; z: number; ry: number };

export type Minimap = {
  /// Frame တိုင်း ခေါ်လို့ရတယ် — အထဲမှာ ကိုယ်တိုင် နှုန်းချုပ်တယ်။
  draw(me: MinimapTarget, others: Iterable<{ x: number; z: number }>): void;
  resize(): void;
  dispose(): void;
};

const DRAW_GAP_MS = 100; // 10Hz

export function createMinimap(
  canvas: HTMLCanvasElement,
  colliders: Collider[],
  worldRadius: number,
): Minimap {
  const ctx = canvas.getContext("2d");
  let last = 0;
  let cssSize = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssSize = canvas.clientWidth || 132;
    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    last = 0; // ချက်ချင်း ပြန်ဆွဲ
  }
  resize();

  function draw(me: MinimapTarget, others: Iterable<{ x: number; z: number }>) {
    if (!ctx) return;
    const now = performance.now();
    if (now - last < DRAW_GAP_MS) return;
    last = now;

    const s = cssSize;
    const half = s / 2;
    // လောက (radius) → မြေပုံ (pixel)
    const k = half / worldRadius;
    const toX = (x: number) => half + x * k;
    // ★ +z က canvas ရဲ့ အောက်ဘက် — မလှန်ဘူး။ ဒါကြောင့် မြေပုံရဲ့ "အပေါ်" က
    // လောကရဲ့ -z ဖြစ်ပြီး မြို့လယ် screen (z = -14) က အပေါ်မှာ ပေါ်တယ်။
    const toY = (z: number) => half + z * k;

    ctx.clearRect(0, 0, s, s);

    // နောက်ခံ စက်ဝိုင်း
    ctx.beginPath();
    ctx.arc(half, half, half - 1, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(8,12,20,0.62)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // စက်ဝိုင်းအပြင်ဘက် ဘာမှ မထွက်အောင်
    ctx.save();
    ctx.beginPath();
    ctx.arc(half, half, half - 1, 0, Math.PI * 2);
    ctx.clip();

    // အဆောက်အအုံ box တွေ
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    for (const c of colliders) {
      ctx.fillRect(
        toX(c.minX),
        toY(c.minZ),
        Math.max(1, (c.maxX - c.minX) * k),
        Math.max(1, (c.maxZ - c.minZ) * k),
      );
    }

    // တခြား player — အစိမ်း အစက်
    ctx.fillStyle = "#4ade80";
    for (const o of others) {
      ctx.beginPath();
      ctx.arc(toX(o.x), toY(o.z), 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // ကိုယ်တိုင် — မျက်နှာမူရာ ပြတဲ့ တြိဂံ
    ctx.save();
    ctx.translate(toX(me.x), toY(me.z));
    // ★ ry က +z ဘက်ကို ၀ လို့ တွက်ထားတာမို့ canvas ရဲ့ "အပေါ်" (-y) နဲ့
    // ကိုက်ဖို့ ry ကို တိုက်ရိုက်သုံးပြီး တြိဂံရဲ့ ထိပ်ကို +y ဘက် ထားတယ်။
    ctx.rotate(-me.ry);
    ctx.beginPath();
    ctx.moveTo(0, 5.5);
    ctx.lineTo(-3.6, -3.6);
    ctx.lineTo(3.6, -3.6);
    ctx.closePath();
    ctx.fillStyle = "#f8fafc";
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  return {
    draw,
    resize,
    dispose() {
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
