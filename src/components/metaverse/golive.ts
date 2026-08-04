import { getLiveStageToken, goLive } from "@/lib/actions/live";

/// 🔴 Metaverse Go Live — game မြင်ကွင်း (WebGL canvas) + မိုက်အသံကို
/// ရှိပြီးသား LiveKit Go Live pipeline ကနေ **newsfeed ရဲ့ Live rail** ဆီ
/// တိုက်ရိုက် လွှင့်တယ်။
///
/// ★ Pipeline အသစ် လုံးဝ မဆောက်ဘူး — /api/live/create (LiveKit row) +
///   getLiveStageToken + goLive + /api/live/[id]/end ဆိုတဲ့ browser Go
///   Live ရဲ့ လမ်းကြောင်းအတိုင်းပဲ။ ကွာတာက ကင်မရာအစား
///   `canvas.captureStream(30)` — ကစားနေတဲ့ မြင်ကွင်းအတိုင်း ထွက်တယ်။
/// ★ မိုက်ခွင့် မရရင် **ဗီဒီယိုသက်သက်နဲ့ ဆက်လွှင့်တယ်** — မိုက်ငြင်းရုံနဲ့
///   Live တစ်ခုလုံး မပျက်စေရဘူး။
/// ★ `livekit-client` ကို dynamic import — Go Live မနှိပ်တဲ့သူတိုင်း
///   SDK ~200KB ဆွဲစရာ မလိုဘူး။

export type MvGoLive = {
  readonly active: boolean;
  /// Live စတင် — အောင်ရင် stream id ပြန်ပေးတယ်၊ error ဆို throw
  start(title: string): Promise<string>;
  /// Live ရပ် — server ကို end ပြောပြီး track/room အကုန် ရှင်းတယ်
  stop(): Promise<void>;
};

export function createMvGoLive(canvas: HTMLCanvasElement): MvGoLive {
  let active = false;
  let streamId: string | null = null;
  let room: { disconnect(): Promise<void> } | null = null;
  let canvasTrack: MediaStreamTrack | null = null;
  let micTrack: MediaStreamTrack | null = null;

  async function cleanup() {
    try {
      await room?.disconnect();
    } catch {
      /* disconnect fail လည်း track တွေ ဆက်ရှင်းရမယ် */
    }
    room = null;
    canvasTrack?.stop();
    canvasTrack = null;
    micTrack?.stop();
    micTrack = null;
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

    async start(title: string) {
      if (active) throw new Error("already live");
      // ၁။ LiveKit stream row ဆောက် — feed မှာ ပေါ်မယ့် live post
      const created = await fetch("/api/live/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, kind: "stream", record: false }),
      });
      if (!created.ok) {
        const e = (await created.json().catch(() => null)) as { error?: string } | null;
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

        // ၃။ Game မြင်ကွင်း — canvas ကနေ 30fps ဗီဒီယို track
        const stream = canvas.captureStream(30);
        const vt = stream.getVideoTracks()[0];
        if (!vt) throw new Error("canvas capture မရဘူး");
        canvasTrack = vt;
        await r.localParticipant.publishTrack(vt, {
          source: lk.Track.Source.Camera,
          name: "metaverse",
        });

        // ၄။ မိုက် — ခွင့်မရရင် ဗီဒီယိုသက်သက်နဲ့ ဆက်သွားတယ်
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

        // ၅။ status → live (feed Live rail + metaverse screen ကြေညာချက်)
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
  };
}
