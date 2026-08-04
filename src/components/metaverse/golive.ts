import { getLiveStageToken, goLive } from "@/lib/actions/live";

/// 🔴 Metaverse Go Live — game မြင်ကွင်း (WebGL canvas) + မိုက်အသံ +
/// (ရွေးချယ်နိုင်တဲ့) host ကင်မရာ PiP ကို ရှိပြီးသား LiveKit Go Live
/// pipeline ကနေ **newsfeed ရဲ့ Live rail** ဆီ တိုက်ရိုက် လွှင့်တယ်။
///
/// ★ Pipeline အသစ် လုံးဝ မဆောက်ဘူး — /api/live/create (LiveKit row) +
///   getLiveStageToken + goLive + /api/live/[id]/end ဆိုတဲ့ browser Go
///   Live ရဲ့ လမ်းကြောင်းအတိုင်းပဲ။
/// ★ **Compositor** — WebGL canvas ကို တိုက်ရိုက် drawImage လုပ်ရင်
///   preserveDrawingBuffer:false မို့ browser အချို့မှာ အလွတ်ထွက်တယ်။
///   ဒါကြောင့် game canvas ရဲ့ captureStream ကို <video> ထဲ ထည့်ပြီး
///   အဲဒီ video ကိုသာ 2D compositor canvas ပေါ် ဆွဲတယ် — video ကနေ
///   drawImage က browser တိုင်းမှာ သေချာ အလုပ်လုပ်တယ်။ ကင်မရာဖွင့်ရင်
///   ညာအောက်ထောင့်မှာ PiP အဖြစ် ထပ်ဆွဲပြီး မျက်နှာကင်မရာကို
///   selfie ပုံစံ ဘယ်ညာလှန် ပြတယ်။
/// ★ **Error က throw နဲ့ ထွက်တယ်** — အရင်ဗားရှင်းက error တွေ တိတ်တိတ်
///   မျိုသွားလို့ "ခလုတ်နှိပ်လို့ မရဘူး" ဖြစ်နေတယ်။ ခုက message ပါတဲ့
///   Error ကို UI ဆီ ရောက်အောင် ပြန်ပစ်ပေးတယ်။
/// ★ မိုက်ခွင့် မရရင် **ဗီဒီယိုသက်သက်နဲ့ ဆက်လွှင့်တယ်**၊ ကင်မရာခွင့်
///   မရရင်လည်း game မြင်ကွင်းသက်သက်နဲ့ ဆက်လွှင့်တယ် — ခွင့်တစ်ခု
///   ငြင်းရုံနဲ့ Live တစ်ခုလုံး မပျက်စေရဘူး။
/// ★ `livekit-client` ကို dynamic import — Go Live မနှိပ်တဲ့သူတိုင်း
///   SDK ~200KB ဆွဲစရာ မလိုဘူး။

/// ကင်မရာ mode — off / မျက်နှာ (front) / အနောက် (back)
export type MvCamMode = "off" | "user" | "environment";

export type MvGoLive = {
  readonly active: boolean;
  readonly camMode: MvCamMode;
  /// Live စတင် — အောင်ရင် stream id ပြန်ပေးတယ်၊ error ဆို message ပါတဲ့
  /// Error ကို throw လုပ်တယ် (UI က ဖမ်းပြီး toast ပြရမယ်)
  start(title: string): Promise<string>;
  /// Live ရပ် — server ကို end ပြောပြီး track/room အကုန် ရှင်းတယ်
  stop(): Promise<void>;
  /// ကင်မရာ ပြောင်း — live မတိုင်ခင်ရော live နေစဉ်ရော ခေါ်လို့ရတယ်။
  /// ကင်မရာခွင့် မရရင် throw (mode က off ကို ပြန်ကျတယ်)။
  setCamera(mode: MvCamMode): Promise<void>;
};

/// PiP အရွယ် — frame အနံရဲ့ 28%၊ ညာအောက်ထောင့် margin 2.5%
const PIP_W_FRAC = 0.28;
const PIP_MARGIN_FRAC = 0.025;
/// Encode စရိတ် သက်သာအောင် ထုတ်လွှင့်မှု frame ကို ဒီအနံထက် မကျော်စေဘူး
const MAX_OUT_W = 1280;
const FPS = 30;

export function createMvGoLive(canvas: HTMLCanvasElement): MvGoLive {
  let active = false;
  let camMode: MvCamMode = "off";
  let streamId: string | null = null;
  let room: { disconnect(): Promise<void> } | null = null;

  // Compositor pieces — live နေစဉ်သာ ရှိတယ်
  let gameTrack: MediaStreamTrack | null = null;
  let gameVideo: HTMLVideoElement | null = null;
  let comp: HTMLCanvasElement | null = null;
  let compTrack: MediaStreamTrack | null = null;
  let micTrack: MediaStreamTrack | null = null;
  let camStream: MediaStream | null = null;
  let camVideo: HTMLVideoElement | null = null;
  let rafId = 0;
  let lastDraw = 0;

  function makeVideo(): HTMLVideoElement {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.autoplay = true;
    return v;
  }

  function stopCamera() {
    camStream?.getTracks().forEach((t) => t.stop());
    camStream = null;
    camVideo = null;
  }

  async function startCamera(mode: "user" | "environment") {
    stopCamera();
    // ideal (exact မဟုတ်) — laptop မှာ back camera မရှိလည်း front နဲ့
    // ဆက်အလုပ်လုပ်စေတယ်
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: mode, width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    camStream = stream;
    const v = makeVideo();
    v.srcObject = stream;
    void v.play().catch(() => undefined);
    camVideo = v;
  }

  /// Frame တစ်ချပ် ဆွဲ — game အပြည့် + ကင်မရာ PiP (ဖွင့်ထားရင်)
  function drawFrame() {
    if (!comp || !gameVideo) return;
    const c = comp.getContext("2d");
    if (!c) return;
    const w = comp.width;
    const h = comp.height;
    if (gameVideo.videoWidth > 0) {
      c.drawImage(gameVideo, 0, 0, w, h);
    } else {
      c.fillStyle = "#0a0f18";
      c.fillRect(0, 0, w, h);
    }
    const cv = camVideo;
    if (cv && cv.videoWidth > 0) {
      const pw = Math.round(w * PIP_W_FRAC);
      const ph = Math.round((pw * cv.videoHeight) / cv.videoWidth);
      const m = Math.round(w * PIP_MARGIN_FRAC);
      const x = w - pw - m;
      const y = h - ph - m;
      c.save();
      // PiP ဘောင် — အနက်ရိပ် + အဖြူဘောင်ပါး
      c.beginPath();
      const r = Math.round(pw * 0.06);
      c.roundRect(x, y, pw, ph, r);
      c.clip();
      if (camMode === "user") {
        // Selfie မှန်ပြောင်း — မျက်နှာကင်မရာကို လူတွေ မြင်နေကျ ပုံစံ
        c.translate(x + pw, y);
        c.scale(-1, 1);
        c.drawImage(cv, 0, 0, pw, ph);
      } else {
        c.drawImage(cv, x, y, pw, ph);
      }
      c.restore();
      c.strokeStyle = "rgba(255,255,255,0.85)";
      c.lineWidth = Math.max(2, Math.round(w / 640));
      c.beginPath();
      c.roundRect(x, y, pw, ph, r);
      c.stroke();
    }
  }

  function loop(now: number) {
    rafId = requestAnimationFrame(loop);
    // ~30fps ထက် ပိုမဆွဲ — battery ချွေတာ
    if (now - lastDraw < 1000 / FPS - 4) return;
    lastDraw = now;
    drawFrame();
  }

  async function cleanup() {
    cancelAnimationFrame(rafId);
    rafId = 0;
    try {
      await room?.disconnect();
    } catch {
      /* disconnect fail လည်း track တွေ ဆက်ရှင်းရမယ် */
    }
    room = null;
    compTrack?.stop();
    compTrack = null;
    gameTrack?.stop();
    gameTrack = null;
    gameVideo = null;
    comp = null;
    micTrack?.stop();
    micTrack = null;
    stopCamera();
    if (streamId) {
      // Server ဘက် status ကို ended ပြောင်း — feed rail ကနေ ပျောက်ဖို့
      void fetch(`/api/live/${streamId}/end`, { method: "POST" }).catch(() => {
        /* network ကျရင် webhook/heartbeat က နောက်မှ ရှင်းလိမ့်မယ် */
      });
      streamId = null;
    }
    active = false;
  }

  return {
    get active() {
      return active;
    },
    get camMode() {
      return camMode;
    },

    async start(title: string) {
      if (active) throw new Error("already live");
      // ၁။ LiveKit stream row ဆောက် — feed မှာ ပေါ်မယ့် live post
      // ★ provider:"livekit" — production ရဲ့ default provider က IVS မို့
      //   ပုံမှန် create က IVS stage ဆောက်ပေးပြီး LiveKit token တောင်းတဲ့
      //   ဒီ pipeline နဲ့ မကိုက်ဘူး ("This stream is not a LiveKit
      //   stream." — user report)။ Metaverse Go Live က livekit-client နဲ့
      //   လွှင့်တာမို့ LiveKit room ကို အတိအကျ တောင်းတယ်။
      const created = await fetch("/api/live/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          kind: "stream",
          // ★ record:true — user report: "live stream save မရ၊ replay မရ"။
          //   goLive() က record_enabled && egressConfigured() ဆို LiveKit
          //   room ကို S3 MP4 အဖြစ် record စပြီး sweep က replay ဖြစ်အောင်
          //   လုပ်ပေးတယ်။ Server မှာ LIVEKIT_EGRESS_S3_* envs မရှိရင်
          //   ဒီ flag က ဘာမှ မဖြစ်စေဘူး (recording ကျော်တယ်) — အန္တရာယ်ကင်း။
          record: true,
          provider: "livekit",
        }),
      });
      if (!created.ok) {
        const e = (await created.json().catch(() => null)) as { error?: string } | null;
        // 401 ကို သီးခြား message — "ခလုတ်မရ" လို့ ထင်နေတဲ့ အဖြစ်များဆုံး
        // အကြောင်းက login မဝင်ထားတာ
        if (created.status === 401) {
          throw new Error("Live လွှင့်ဖို့ အကောင့်အရင် ဝင်ထားပေးပါ");
        }
        throw new Error(e?.error ?? "Live ဖန်တီးလို့ မရဘူး");
      }
      const { id } = (await created.json()) as { id: string };
      streamId = id;

      try {
        // ၂။ Host token ယူပြီး SFU ချိတ်
        const tok = await getLiveStageToken(id);
        if (!tok.ok) throw new Error(tok.error);
        const lk = await import("livekit-client");
        const r = new lk.Room();
        await r.connect(tok.data.url, tok.data.token);
        room = r;

        // ၃။ Game မြင်ကွင်း → hidden <video> → compositor canvas → LiveKit
        const gs = canvas.captureStream(FPS);
        const gt = gs.getVideoTracks()[0];
        if (!gt) throw new Error("Game မြင်ကွင်း ဖမ်းလို့ မရဘူး");
        gameTrack = gt;
        const gv = makeVideo();
        gv.srcObject = gs;
        void gv.play().catch(() => undefined);
        gameVideo = gv;

        const outW = Math.min(canvas.width, MAX_OUT_W);
        const outH = Math.round((outW * canvas.height) / canvas.width) || 720;
        const cc = document.createElement("canvas");
        cc.width = outW;
        cc.height = outH;
        comp = cc;
        drawFrame();
        const cs = cc.captureStream(FPS);
        const ct = cs.getVideoTracks()[0];
        if (!ct) throw new Error("Compositor ဖမ်းလို့ မရဘူး");
        compTrack = ct;
        rafId = requestAnimationFrame(loop);

        await r.localParticipant.publishTrack(ct, {
          source: lk.Track.Source.Camera,
          name: "metaverse",
        });

        // ၄။ ကင်မရာ ကြိုရွေးထားရင် ဖွင့် — ခွင့်မရလည်း live မပျက်ဘူး
        if (camMode !== "off") {
          try {
            await startCamera(camMode);
          } catch {
            camMode = "off";
          }
        }

        // ၅။ မိုက် — ခွင့်မရရင် ဗီဒီယိုသက်သက်နဲ့ ဆက်သွားတယ်
        try {
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
          const at = mic.getAudioTracks()[0];
          if (at) {
            micTrack = at;
            await r.localParticipant.publishTrack(at, {
              source: lk.Track.Source.Microphone,
            });
          }
        } catch {
          /* mic ငြင်း — video-only broadcast */
        }

        // ၆။ status → live (feed Live rail + metaverse screen ကြေညာချက်)
        const live = await goLive(id);
        if (!live.ok) throw new Error(live.error);

        active = true;
        return id;
      } catch (err) {
        await cleanup();
        throw err;
      }
    },

    async stop() {
      if (!active && !streamId) return;
      await cleanup();
    },

    async setCamera(mode: MvCamMode) {
      const prev = camMode;
      camMode = mode;
      if (mode === "off") {
        stopCamera();
        return;
      }
      // Live မဟုတ်သေးရင် mode ကိုပဲ မှတ်ထား — start() မှာ ဖွင့်မယ်။
      // ဒီနေရာမှာ ကင်မရာ စမ်းမဖွင့်ဘူး — permission dialog က Go Live
      // မလုပ်ခင် ကတည်းက ပေါ်နေရင် စိတ်ရှုပ်စရာ ဖြစ်တယ်။
      if (!active) return;
      try {
        await startCamera(mode);
      } catch {
        camMode = prev === mode ? "off" : prev;
        stopCamera();
        throw new Error("ကင်မရာခွင့် မရဘူး — browser/app ရဲ့ camera permission စစ်ပေးပါ");
      }
    },
  };
}
