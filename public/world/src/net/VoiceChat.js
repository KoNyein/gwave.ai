// ============================================================
// VoiceChat.js — WebRTC Proximity Voice Chat (mesh)
// ✔ Room တစ်ခုတည်းက ကစားသမားချင်း အသံပြောနိုင်
// ✔ Proximity — အနီးရောက်လေ အသံကျယ်လေ (3D positional audio)
// ✔ Push-to-talk [V] သို့ toggle mic ၊ speaking indicator (အစိမ်းရောင်ကွင်း)
// ✔ Signaling က game server (ws) ကနေ relay — server က media မကိုင်
//
// မှတ်ချက် — mic ခွင့်ပြုချက် (HTTPS သို့ localhost) လိုအပ်သည်
// ============================================================
const RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const HEAR_RANGE = 22;   // မီတာ — ဒီထက်ဝေးလျှင် အသံမကြား
const FULL_RANGE = 4;    // ဒီအတွင်း အသံအပြည့်

export class VoiceChat {
  constructor({ net, avatar, world, hud }) {
    this.net = net; this.avatar = avatar; this.world = world; this.hud = hud;
    this.peers = new Map();   // netId → { pc, audio, el }
    this.enabled = false;
    this.muted = true;
    this.stream = null;
    this.localSpeaking = false;
  }

  // 🎙️ Mic ဖွင့် — user gesture ကနေသာ ခေါ်ရမည် (browser policy)
  async enable() {
    if (this.enabled) return true;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      this.enabled = true;
      this.setMuted(false);
      this.startLevelMeter();
      this.net.voiceReady();          // server ကို "voice အသင့်" ဟုပြော
      this.hud.addToast('🎙️ Voice chat ဖွင့်ပြီး — [V] နှိပ်၍ mic ပိတ်/ဖွင့်');
      return true;
    } catch (e) {
      this.hud.addToast('❌ Mic ခွင့်ပြုချက် မရပါ (HTTPS လိုအပ်သည်)');
      return false;
    }
  }

  setMuted(m) {
    this.muted = m;
    this.stream?.getAudioTracks().forEach(t => (t.enabled = !m));
    this.net.setSpeaking(!m && this.localSpeaking);
    document.querySelector('#micBtn')?.classList.toggle('micOn', !m);
  }

  toggleMute() {
    if (!this.enabled) { this.enable(); return; }
    this.setMuted(!this.muted);
    this.hud.addToast(this.muted ? '🔇 Mic ပိတ်ထား' : '🎙️ Mic ဖွင့်ထား');
  }

  // အသံအတိုးအကျယ် တိုင်း → speaking indicator
  startLevelMeter() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaStreamSource(this.stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    setInterval(() => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const speaking = !this.muted && avg > 12;
      if (speaking !== this.localSpeaking) {
        this.localSpeaking = speaking;
        this.net.setSpeaking(speaking);
        document.querySelector('#micBtn')?.classList.toggle('micTalk', speaking);
      }
    }, 200);
  }

  // ---- Peer connection (polite/impolite ကို id နှိုင်းယှဉ်ဖြင့် ဆုံးဖြတ်) ----
  async getPeer(id, initiator) {
    let peer = this.peers.get(id);
    if (peer) return peer;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peer = { pc, gain: null, panner: null };
    this.peers.set(id, peer);

    if (this.stream) for (const t of this.stream.getTracks()) pc.addTrack(t, this.stream);

    pc.onicecandidate = (e) => {
      if (e.candidate) this.net.voiceSignal(id, { ice: e.candidate });
    };
    pc.ontrack = (e) => this.attachRemoteAudio(peer, e.streams[0]);
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) this.removePeer(id);
    };

    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.net.voiceSignal(id, { sdp: pc.localDescription });
    }
    return peer;
  }

  // Positional audio — WebAudio panner ဖြင့် အကွာအဝေးအလိုက် အသံချိန်
  attachRemoteAudio(peer, stream) {
    const ctx = (this.audioCtx ||= new (window.AudioContext || window.webkitAudioContext)());
    // Chrome bug workaround — stream ကို <audio> နဲ့ကိုင်မှ track စီးဆင်း
    const el = document.createElement('audio');
    el.srcObject = stream; el.muted = true; el.autoplay = true;
    document.body.appendChild(el);
    peer.el = el;

    const src = ctx.createMediaStreamSource(stream);
    peer.gain = ctx.createGain();
    peer.gain.gain.value = 0;
    src.connect(peer.gain).connect(ctx.destination);
  }

  async onSignal(from, data) {
    const peer = await this.getPeer(from, false);
    const pc = peer.pc;
    if (data.sdp) {
      await pc.setRemoteDescription(data.sdp);
      if (data.sdp.type === 'offer') {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.net.voiceSignal(from, { sdp: pc.localDescription });
      }
    } else if (data.ice) {
      try { await pc.addIceCandidate(data.ice); } catch {}
    }
  }

  // Server က "ဒီသူတွေ voice အသင့်" ဟုပြောလျှင် — id ကြီးသူက offer လုပ်
  onPeerList(ids) {
    if (!this.enabled) return;
    for (const id of ids) {
      if (id === this.net.myId) continue;
      if (!this.peers.has(id)) this.getPeer(id, this.net.myId > id);
    }
  }

  removePeer(id) {
    const peer = this.peers.get(id);
    if (!peer) return;
    peer.pc.close();
    peer.el?.remove();
    this.peers.delete(id);
  }

  // frame တိုင်း — အကွာအဝေးအလိုက် အသံအတိုးအကျယ် ချိန်
  update() {
    const me = this.avatar.group.position;
    for (const [id, peer] of this.peers) {
      if (!peer.gain) continue;
      const remote = this.net.remotes.get(id);
      let vol = 0;
      if (remote) {
        const d = remote.group.position.distanceTo(me);
        vol = d <= FULL_RANGE ? 1 : d >= HEAR_RANGE ? 0 : 1 - (d - FULL_RANGE) / (HEAR_RANGE - FULL_RANGE);
      }
      peer.gain.gain.value = vol;
    }
  }
}
