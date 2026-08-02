import type { NetClient } from "./net";

/// Spatial voice chat — WebRTC mesh + Web Audio PannerNode (Phase 14)。
///
/// ★ Audio က **P2P** — server က ဘယ်တော့မှ မမြင်ဘူး၊ recording လည်း မလုပ်ဘူး။
/// ★ Spatial: peer တစ်ယောက်ချင်းရဲ့ stream ကို `<audio>` နဲ့ မဖွင့်ဘဲ
///   Web Audio ရဲ့ PannerNode (HRTF) ဖြတ်တယ် — ဘယ်ဘက်ကလူက ဘယ်နားကြပ်မှာ
///   ကျယ်တယ်၊ ၂၅ unit ကျော်ရင် မကြားရ (spec 14.3)。
/// ★ Bandwidth: **အနီးဆုံး ၈ ယောက်**နဲ့သာ ချိတ်တယ်၊ ၁ စက္ကန့်တစ်ခါ
///   ပြန်စစ်ပြီး ဝေးသွားသူကို ဖြုတ်တယ်။
/// ★ Mic default **ပိတ်** — track.enabled=false (silence ပို့တယ်)。
///   Permission ငြင်းရင် listen-only နဲ့ ဆက်သွားတယ်၊ ဘယ်တော့မှ မကျဘူး。

const MAX_PEERS = 8;
const HEAR_DISTANCE = 25;
const RESCAN_MS = 1000;

type PeerConn = {
  pc: RTCPeerConnection;
  panner: PannerNode | null;
  gain: GainNode | null;
  /// User က ဒီလူကို ကိုယ်တိုင် mute ထားလား (nearest ပြန်ချိတ်လည်း ကျန်ရမယ်)
  userMuted: boolean;
  /// Polite/impolite — glare (နှစ်ဘက်လုံး offer ပို့မိတာ) ဖြေရှင်းဖို့
  polite: boolean;
  makingOffer: boolean;
};

export type VoiceChat = {
  /// Voice ထဲ ဝင်တယ် (server က ၁၈+ စစ်တယ်) — mic permission လည်း တောင်းတယ်
  join(): Promise<void>;
  leave(): void;
  /// Mic ဖွင့်/ပိတ် — default ပိတ်
  setMic(on: boolean): void;
  /// Peer တစ်ယောက်ချင်း mute
  mutePeer(id: string, muted: boolean): void;
  isPeerMuted(id: string): boolean;
  /// Server ကနေ လာတဲ့ message များ — scene ရဲ့ net handler တွေက ခေါ်တယ်
  onPeers(peers: { id: string; muted: boolean }[]): void;
  onSignal(from: string, data: unknown): void;
  onLeft(id: string): void;
  /// Frame တိုင်း — နားထောင်သူ (ကိုယ်) နဲ့ peer တွေရဲ့ နေရာ sync
  update(
    me: { x: number; y: number; z: number; ry: number },
    positions: Map<string, { x: number; y: number; z: number }>,
  ): void;
  readonly active: boolean;
  readonly micOn: boolean;
  dispose(): void;
};

export function createVoiceChat(
  net: () => NetClient | null,
  myId: () => string,
  /// ICE config — TURN ပါမှ carrier NAT မှာ အသံထွက်တယ် (CLAUDE.md)
  fetchIce: () => Promise<RTCIceServer[]>,
): VoiceChat {
  let actx: AudioContext | null = null;
  let mic: MediaStream | null = null;
  let active = false;
  let micOn = false;
  const peers = new Map<string, PeerConn>();
  /// Voice ထဲရှိသူ အားလုံး (ချိတ်ထား/မချိတ်ထား နှစ်မျိုးလုံး)
  let roster: string[] = [];
  let iceServers: RTCIceServer[] = [];
  let rescan: ReturnType<typeof setInterval> | null = null;
  let lastPositions: Map<string, { x: number; y: number; z: number }> = new Map();
  let lastMe = { x: 0, y: 0, z: 0, ry: 0 };
  /// Peer mute ကို connection မရှိချိန်မှာလည်း မှတ်ထားရမယ်
  const userMutes = new Set<string>();

  const ensureCtx = () => {
    if (!actx) {
      actx = new AudioContext();
    }
    void actx.resume().catch(() => {});
    return actx;
  };

  const distTo = (id: string) => {
    const p = lastPositions.get(id);
    if (!p) return Infinity;
    return Math.hypot(p.x - lastMe.x, p.z - lastMe.z);
  };

  const attachStream = (peer: PeerConn, stream: MediaStream) => {
    const ctx = ensureCtx();
    const source = ctx.createMediaStreamSource(stream);
    const panner = ctx.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = 4; // ဒီအကွာအဝေးအထိ အပြည့်ကြားရ
    panner.maxDistance = HEAR_DISTANCE;
    panner.rolloffFactor = 1.6;
    const gain = ctx.createGain();
    gain.gain.value = peer.userMuted ? 0 : 1;
    source.connect(panner).connect(gain).connect(ctx.destination);
    peer.panner = panner;
    peer.gain = gain;

    // ★ Chromium ရဲ့ ချို့ယွင်းချက် — remote stream ကို media element တစ်ခုနဲ့
    // မချိတ်ရင် WebAudio ထဲ အသံ မဝင်ဘူး။ Muted element နဲ့ ချိတ်ထားတယ်။
    const el = new Audio();
    el.srcObject = stream;
    el.muted = true;
    void el.play().catch(() => {});
  };

  const makePeer = (id: string): PeerConn => {
    // ★ Glare: id ငယ်တဲ့ဘက်က "polite" — နှစ်ဘက်လုံး offer ပို့မိရင်
    // polite ဘက်က ကိုယ့် offer ကို စွန့်ပြီး လက်ခံတယ် (perfect negotiation)。
    const polite = myId() < id;
    const pc = new RTCPeerConnection({ iceServers });
    const peer: PeerConn = {
      pc,
      panner: null,
      gain: null,
      userMuted: userMutes.has(id),
      polite,
      makingOffer: false,
    };

    if (mic) {
      for (const track of mic.getAudioTracks()) pc.addTrack(track, mic);
    } else {
      // Listen-only — mic မရလည်း တခြားသူ့အသံ ကြားရမယ်
      pc.addTransceiver("audio", { direction: "recvonly" });
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) net()?.sendVoiceSignal(id, { ice: e.candidate.toJSON() });
    };
    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        net()?.sendVoiceSignal(id, { sdp: pc.localDescription });
      } catch {
        /* ချိတ်မရရင် rescan က နောက်တစ်ခါ ကြိုးစားမယ် */
      } finally {
        peer.makingOffer = false;
      }
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      attachStream(peer, stream);
    };

    peers.set(id, peer);
    return peer;
  };

  const dropPeer = (id: string) => {
    const peer = peers.get(id);
    if (!peer) return;
    try {
      peer.pc.close();
    } catch {
      /* ignore */
    }
    peers.delete(id);
  };

  /// ၁ စက္ကန့်တစ်ခါ — အနီးဆုံး ၈ ယောက်နဲ့သာ ချိတ်ထား (spec 14.3)
  const rescanPeers = () => {
    if (!active) return;
    const me = myId();
    const candidates = roster
      .filter((id) => id !== me && distTo(id) <= HEAR_DISTANCE)
      .sort((a, b) => distTo(a) - distTo(b))
      .slice(0, MAX_PEERS);
    const want = new Set(candidates);

    for (const id of peers.keys()) {
      if (!want.has(id)) dropPeer(id); // ဝေးသွားပြီ
    }
    for (const id of candidates) {
      if (!peers.has(id)) makePeer(id);
    }
  };

  return {
    get active() {
      return active;
    },
    get micOn() {
      return micOn;
    },

    async join() {
      if (active) return;
      active = true;
      iceServers = await fetchIce().catch(() => []);
      // ★ Mic ကို ကြိုတောင်းတယ် (join က user ရဲ့ နှိပ်ချက်မို့ ခွင့်ပြုချက်
      // dialog က အဆင်ပြေတယ်) — ဒါပေမယ့် **track ကို ပိတ်ထား** (default mute)。
      // ငြင်းရင် listen-only — error မတက်ဘူး (spec 14.6)。
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        for (const track of mic.getAudioTracks()) track.enabled = false;
      } catch {
        mic = null;
      }
      micOn = false;
      net()?.sendVoiceJoin();
      rescan = setInterval(rescanPeers, RESCAN_MS);
    },

    leave() {
      if (!active) return;
      active = false;
      net()?.sendVoiceLeave();
      if (rescan) clearInterval(rescan);
      rescan = null;
      for (const id of [...peers.keys()]) dropPeer(id);
      mic?.getTracks().forEach((t) => t.stop());
      mic = null;
      micOn = false;
      roster = [];
    },

    setMic(on) {
      if (!mic) {
        micOn = false;
        return;
      }
      micOn = on;
      for (const track of mic.getAudioTracks()) track.enabled = on;
      net()?.sendVoiceMute(!on);
    },

    mutePeer(id, muted) {
      if (muted) userMutes.add(id);
      else userMutes.delete(id);
      const peer = peers.get(id);
      if (peer) {
        peer.userMuted = muted;
        if (peer.gain) peer.gain.gain.value = muted ? 0 : 1;
      }
    },

    isPeerMuted: (id) => userMutes.has(id),

    onPeers(list) {
      roster = list.map((p) => p.id);
      rescanPeers();
    },

    onLeft(id) {
      roster = roster.filter((r) => r !== id);
      dropPeer(id);
    },

    async onSignal(from, data) {
      if (!active) return;
      const d = (data ?? {}) as {
        sdp?: RTCSessionDescriptionInit;
        ice?: RTCIceCandidateInit;
      };
      let peer = peers.get(from);
      if (!peer) {
        // Peer ဘက်က အရင် ချိတ်လာတာ — ကိုယ့် nearest ထဲ မပါသေးလည်း လက်ခံတယ်
        if (peers.size >= MAX_PEERS) return;
        peer = makePeer(from);
      }
      const { pc } = peer;
      try {
        if (d.sdp) {
          const collision =
            d.sdp.type === "offer" &&
            (peer.makingOffer || pc.signalingState !== "stable");
          if (collision && !peer.polite) return; // impolite — ကိုယ့် offer အတိုင်း
          await pc.setRemoteDescription(d.sdp);
          if (d.sdp.type === "offer") {
            await pc.setLocalDescription();
            net()?.sendVoiceSignal(from, { sdp: pc.localDescription });
          }
        } else if (d.ice) {
          await pc.addIceCandidate(d.ice).catch(() => {});
        }
      } catch {
        // Signaling ကျရင် ဒီ peer ကို ဖြုတ် — rescan က ပြန်ကြိုးစားမယ်
        dropPeer(from);
      }
    },

    update(me, positions) {
      lastMe = me;
      lastPositions = positions;
      const ctx = actx;
      if (!ctx || !active) return;
      // ★ နားထောင်သူ (ကိုယ်) ရဲ့ နေရာနဲ့ ဦးတည်ရာ — ဒါမပါရင် "ဘယ်/ညာ"
      // က ကမ္ဘာ့ axis အတိုင်းဖြစ်ပြီး ကိုယ့်လှည့်ထောင့်နဲ့ မကိုက်ဘူး။
      const l = ctx.listener;
      const t = ctx.currentTime;
      if (l.positionX) {
        l.positionX.setValueAtTime(me.x, t);
        l.positionY.setValueAtTime(me.y + 1.5, t);
        l.positionZ.setValueAtTime(me.z, t);
        l.forwardX.setValueAtTime(Math.sin(me.ry), t);
        l.forwardY.setValueAtTime(0, t);
        l.forwardZ.setValueAtTime(Math.cos(me.ry), t);
        l.upX.setValueAtTime(0, t);
        l.upY.setValueAtTime(1, t);
        l.upZ.setValueAtTime(0, t);
      }
      for (const [id, peer] of peers) {
        const p = positions.get(id);
        if (!p || !peer.panner) continue;
        peer.panner.positionX.setValueAtTime(p.x, t);
        peer.panner.positionY.setValueAtTime(p.y + 1.5, t);
        peer.panner.positionZ.setValueAtTime(p.z, t);
      }
    },

    dispose() {
      this.leave();
      void actx?.close().catch(() => {});
      actx = null;
    },
  };
}
