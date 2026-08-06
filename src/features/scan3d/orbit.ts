"use client";

/// 🧭 Orbit capture engine — room/object scan ရဲ့ "လှည့်ရင်း frame စု" အပိုင်း။
///
/// ★ Gyro (deviceorientation alpha) ရရင် yaw အလိုက် sector ၂၄ ခု (15°) ထဲ
///   frame ချထားတယ် — ပတ်ပြီးမပြီး coverage ကနေ သိတယ်။
/// ★ iOS က permission API (requestPermission) တောင်းရတယ်; Android WebView
///   က တန်းရတယ်; ဘာမှ မရရင် **timer fallback** — 700ms တစ်ချပ် ဖမ်းပြီး
///   sector တွေ အစဉ်လိုက် ဖြည့်တယ် (user ကို ဖြည်းဖြည်း လှည့်ခိုင်းထား)။
/// ★ Frame က JPEG blob — memory မကုန်အောင် sector တစ်ခု တစ်ချပ်ပဲ သိမ်း။

export const SECTORS = 24;

export type OrbitFrame = { sector: number; blob: Blob };

export type OrbitCapture = {
  start(): Promise<void>;
  stop(): void;
  /// Loop ကနေ frame တိုင်း ခေါ် — လိုအပ်ရင် ဒီ sector အတွက် capture လုပ်တယ်
  tick(video: HTMLVideoElement): void;
  readonly coverage: number; // 0..1
  readonly count: number;
  readonly currentCovered: boolean; // ချိန်ထားတဲ့ direction က ဖမ်းပြီးပြီလား
  frames(): OrbitFrame[];
  dispose(): void;
};

export function createOrbitCapture(): OrbitCapture {
  const got = new Map<number, Blob>();
  let yaw: number | null = null; // degrees 0..360 (gyro ရမှ)
  let running = false;
  let fallbackSector = 0;
  let lastShot = 0;
  let disposed = false;

  const onOrient = (e: DeviceOrientationEvent) => {
    if (typeof e.alpha === "number") yaw = ((e.alpha % 360) + 360) % 360;
  };

  const shoot = (video: HTMLVideoElement, sector: number) => {
    if (got.has(sector)) return;
    const c = document.createElement("canvas");
    // 960px အနံ — viewer အတွက် လုံလောက်ပြီး sector ၂၄ ချပ် စုစုပေါင်း
    // မြေပြင်ကျကျ (~2-3MB) ပဲ ရှိတယ်
    const w = Math.min(960, video.videoWidth);
    c.width = w;
    c.height = Math.round((w * video.videoHeight) / video.videoWidth);
    c.getContext("2d")?.drawImage(video, 0, 0, c.width, c.height);
    c.toBlob(
      (b) => {
        if (b && !disposed && !got.has(sector)) got.set(sector, b);
      },
      "image/jpeg",
      0.82,
    );
  };

  return {
    async start() {
      got.clear();
      fallbackSector = 0;
      running = true;
      // iOS 13+ — permission မတောင်းရင် event မလာဘူး
      const D = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      };
      try {
        if (typeof D.requestPermission === "function") {
          const r = await D.requestPermission();
          if (r !== "granted") yaw = null;
        }
      } catch {
        /* ငြင်း/မထောက်ပံ့ — timer fallback နဲ့ ဆက်သွား */
      }
      window.addEventListener("deviceorientation", onOrient);
    },
    stop() {
      running = false;
      window.removeEventListener("deviceorientation", onOrient);
    },
    tick(video) {
      if (!running || video.videoWidth === 0) return;
      const now = Date.now();
      if (yaw !== null) {
        const sector = Math.floor((yaw / 360) * SECTORS) % SECTORS;
        shoot(video, sector);
      } else if (now - lastShot > 700 && fallbackSector < SECTORS) {
        // gyro မရ — အချိန်အလိုက် အစဉ်ဖြည့် (user က တဖြည်းဖြည်း လှည့်နေရမယ်)
        lastShot = now;
        shoot(video, fallbackSector);
        fallbackSector += 1;
      }
    },
    get coverage() {
      return got.size / SECTORS;
    },
    get count() {
      return got.size;
    },
    get currentCovered() {
      if (yaw === null) return false;
      return got.has(Math.floor((yaw / 360) * SECTORS) % SECTORS);
    },
    frames() {
      return [...got.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([sector, blob]) => ({ sector, blob }));
    },
    dispose() {
      disposed = true;
      window.removeEventListener("deviceorientation", onOrient);
      got.clear();
    },
  };
}
