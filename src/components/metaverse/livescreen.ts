import * as THREE from "three";

/// မြို့လယ်က ကြီးမားတဲ့ မျက်နှာပြင် — Gwave ရဲ့ AWS IVS live stream ကို
/// လောကထဲမှာ တိုက်ရိုက် ပြတယ်။
///
/// ★ **`muted` မဖြစ်မနေ** — browser တိုင်းက အသံပါတဲ့ video ကို user gesture
///   မရှိဘဲ autoplay ခွင့်မပြုဘူး။ muted မထားရင် `play()` က reject ဖြစ်ပြီး
///   မျက်နှာပြင်က အမည်းအတိုင်း ကျန်နေမယ် — error လည်း မတက်ဘူး၊ ဒါကြောင့်
///   ဘာလို့လဲ ဆိုတာ ရှာရ ခက်တယ်။
/// ★ **နားရောက်မှ ဖွင့်တယ်** — မြို့တစ်ဖက်ခြမ်းမှာ ရှိနေတုန်း HLS segment
///   တွေ ဆွဲနေရင် ဖုန်း data အလကားကုန်တယ်။ ဝေးသွားရင် pause လုပ်တယ်။
/// ★ Stream မရှိရင် **error မတက်ရ** — offline placeholder (canvas texture)
///   ကို ပြပြီး ငြိမ်နေတယ်။
/// ★ `hls.js` ကို **dynamic import** လုပ်တယ် — metaverse မဝင်ဘဲ gwave.cc ရဲ့
///   တခြားစာမျက်နှာဖွင့်တဲ့သူတိုင်းကို 150KB ထပ်ဆွဲခိုင်းစရာ မလိုဘူး။

export type LiveScreen = {
  /// Frame တိုင်း — player နဲ့ အကွာအဝေးပေါ်မူတည်ပြီး play/pause လုပ်တယ်
  update(playerX: number, playerZ: number): void;
  readonly playing: boolean;
  dispose(): void;
};

/// ဒီအကွာအဝေးအတွင်း ရောက်မှ ဖွင့်တယ်၊ ဒီထက်ဝေးရင် ရပ်တယ် (hysteresis —
/// အနားမှာ ရပ်နေသူတစ်ယောက်က play/pause ကို တစ်စက္ကန့် ၆၀ ခါ ခလုတ်နှိပ်မနေဖို့)။
const PLAY_WITHIN = 34;
const STOP_BEYOND = 42;

const SCREEN_POS = { x: 0, z: -14 };

function placeholderTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 288;
  const c = canvas.getContext("2d");
  if (c) {
    const g = c.createLinearGradient(0, 0, 0, 288);
    g.addColorStop(0, "#111826");
    g.addColorStop(1, "#0a0f18");
    c.fillStyle = g;
    c.fillRect(0, 0, 512, 288);
    c.fillStyle = "#1f2937";
    c.fillRect(0, 138, 512, 2);
    c.fillStyle = "#94a3b8";
    c.font = "600 30px system-ui, sans-serif";
    c.textAlign = "center";
    c.fillText("GWAVE LIVE", 256, 122);
    c.fillStyle = "#64748b";
    c.font = "20px system-ui, sans-serif";
    c.fillText(text, 256, 178);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function attachLiveScreen(
  screenMesh: THREE.Mesh,
  playbackUrl: string,
): LiveScreen {
  const offline = placeholderTexture(
    playbackUrl ? "ယခု တိုက်ရိုက်လွှင့်မှု မရှိပါ" : "တိုက်ရိုက်လွှင့်မှု မသတ်မှတ်ရသေး",
  );
  const offlineMat = new THREE.MeshBasicMaterial({
    map: offline,
    side: THREE.DoubleSide,
  });
  const oldMat = screenMesh.material as THREE.Material;
  screenMesh.material = offlineMat;

  let video: HTMLVideoElement | null = null;
  let videoTex: THREE.VideoTexture | null = null;
  let videoMat: THREE.MeshBasicMaterial | null = null;
  let hls: { destroy(): void } | null = null;
  let playing = false;
  let disposed = false;
  let live = false; // stream တကယ် လာနေလား

  if (playbackUrl) {
    video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true; // ★ autoplay ရဖို့ မဖြစ်မနေ
    video.playsInline = true;
    video.loop = false;
    video.preload = "none";

    const onReady = () => {
      if (disposed || !video) return;
      live = true;
      videoTex = new THREE.VideoTexture(video);
      videoTex.colorSpace = THREE.SRGBColorSpace;
      videoMat = new THREE.MeshBasicMaterial({
        map: videoTex,
        side: THREE.DoubleSide,
      });
      screenMesh.material = videoMat;
    };
    video.addEventListener("loadeddata", onReady);

    // ★ stream ကျသွားရင် placeholder ကို ပြန်ပြ — အမည်းအတိုင်း မကျန်စေရ
    const onFail = () => {
      if (disposed) return;
      live = false;
      screenMesh.material = offlineMat;
    };
    video.addEventListener("error", onFail);
    video.addEventListener("stalled", onFail);

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari / iOS — native HLS
      video.src = playbackUrl;
    } else {
      void import("hls.js")
        .then((mod) => {
          if (disposed || !video) return;
          const Hls = mod.default;
          if (!Hls.isSupported()) return;
          const inst = new Hls({ lowLatencyMode: true, backBufferLength: 12 });
          inst.loadSource(playbackUrl);
          inst.attachMedia(video);
          // ★ HLS error တွေက fatal မဟုတ်ရင် hls.js ကိုယ်တိုင် ပြန်ကြိုးစားတယ်။
          // fatal မှသာ placeholder ပြရမယ် — မဟုတ်ရင် segment တစ်ခု နှေးတိုင်း
          // မျက်နှာပြင်က ခဏခဏ လှန်နေမယ်။
          inst.on(Hls.Events.ERROR, (_e, data) => {
            if (data.fatal) onFail();
          });
          hls = inst;
        })
        .catch(() => {
          /* hls.js ဆွဲမရရင် placeholder နဲ့ပဲ ဆက်သွားတယ် */
        });
    }
  }

  return {
    get playing() {
      return playing;
    },
    update(px, pz) {
      if (!video || disposed) return;
      const d = Math.hypot(px - SCREEN_POS.x, pz - SCREEN_POS.z);
      if (!playing && d < PLAY_WITHIN) {
        playing = true;
        // play() က Promise ပြန်ပေးပြီး reject ဖြစ်နိုင်တယ် (autoplay policy)
        void video.play().catch(() => {
          playing = false;
        });
      } else if (playing && d > STOP_BEYOND) {
        playing = false;
        video.pause();
      }
      if (live && videoTex) videoTex.needsUpdate = true;
    },
    dispose() {
      disposed = true;
      hls?.destroy();
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
      videoTex?.dispose();
      videoMat?.dispose();
      offlineMat.dispose();
      offline.dispose();
      screenMesh.material = oldMat;
    },
  };
}
