// ============================================================
// NetClient.js — Multiplayer Client v2 (PvP + Server-Authoritative)
// Server မရှိလျှင်လည်း ဂိမ်း ပုံမှန်ဆက်ကစားနိုင် (offline-safe)
// ✔ Remote players interpolation ✔ snap-back ✔ PvP shoot claims
// ✔ Hit/Kill/Respawn events (server ကသာ ဆုံးဖြတ်) ✔ Cognito token ပို့
// ============================================================
import * as THREE from 'three';
import { makeNameLabel } from '../ui/label.js';
import { EmotePlayer } from '../entities/Emotes.js';
import { Locomotion } from '../entities/Locomotion.js';
import { loadGLB } from '../core/Assets.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

/// အခြားသူများ ဝတ်မယ့် ခန္ဓာကိုယ် — Idle/Walk/Run clip အပြည့်ပါတဲ့ ဖိုင်။
/// (Character3/4/5 မှာ clip တစ်ခုမှ မရှိလို့ remote အတွက် မသင့်တော်ဘူး)
const REMOTE_BODY = '/metaverse/realistic/Soldier.glb';

const SEND_HZ = 15;

// ---- Remote ကစားသမား ----
class RemotePlayer {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.group = new THREE.Group();

    const hue = (id * 47) % 360;
    const color = new THREE.Color(`hsl(${hue}, 70%, 55%)`);
    this.bodyMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 1.0, 6, 12),
      new THREE.MeshStandardMaterial({ color, roughness: 0.55 })
    );
    this.bodyMesh.position.y = 0.95; this.bodyMesh.castShadow = true;
    this.headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffd9a0 })
    );
    this.headMesh.position.y = 1.75;
    // PvP raycast အတွက် — Weapon က ဒီ userData ကိုကြည့်သည်
    this.bodyMesh.userData.netId = id;
    this.headMesh.userData.netId = id;
    this.group.add(this.bodyMesh, this.headMesh, makeNameLabel(name, '#8ecbff'));

    this.targetPos = new THREE.Vector3();
    this.targetYaw = 0;
    this.emotes = new EmotePlayer(this); // အခြားသူများ၏ emote မြင်ရရန်
    this.speaking = false;
    this.sitting = false;
    this._prev = new THREE.Vector3();
    this._speed = 0;
    this.lodFar = false;
    this._lodTick = 0;

    // 🚶 တကယ့် ခန္ဓာကိုယ် — အရင်က capsule + ဘောလုံး ပဲ ဖြစ်လို့ သူများတွေက
    //    ခြေမလှမ်းဘဲ လျှောသွားနေတယ် (user: "ခြေလှမ်းတာ မလုပ်ဘူး")。
    //    ★ SkeletonUtils.clone — SkinnedMesh ကို ရိုးရိုး clone() လုပ်လို့
    //      မရဘူး (အရိုးတွေ မျှသုံးမိပြီး အားလုံး တစ်ထပ်တည်း လှုပ်မယ်)。
    //    ★ Load မရရင် capsule နဲ့ပဲ ဆက်သွားတယ် — ကျမသွားစေရ။
    void loadGLB(REMOTE_BODY).then((gltf) => {
      const model = cloneSkinned(gltf.scene);
      model.traverse((o) => {
        if (o.isMesh) { o.castShadow = true; o.userData.netId = id; }
      });
      this.group.add(model);
      this.model = model;
      this.loco = new Locomotion(model, gltf.animations || []);
      // ခန္ဓာကိုယ် ရောက်ပြီ — placeholder ဖျောက်တယ် (raycast အတွက် ကျန်ထား၊
      // မမြင်ရအောင်သာ)
      this.bodyMesh.visible = false;
      this.headMesh.visible = false;
    }).catch(() => { /* capsule ပဲ ဆက်သုံး */ });
  }

  // 🎙️ စကားပြောနေချိန် နာမည်အောက် အစိမ်းရောင်ကွင်း
  setSpeaking(on) {
    if (this.speaking === on) return;
    this.speaking = on;
    if (!this.voiceRing) {
      this.voiceRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.6, 0.05, 8, 28),
        new THREE.MeshBasicMaterial({ color: 0x3ddc97, transparent: true, opacity: 0.85 })
      );
      this.voiceRing.rotation.x = Math.PI / 2;
      this.voiceRing.position.y = 0.06;
      this.group.add(this.voiceRing);
    }
    this.voiceRing.visible = on;
  }

  setState(p, yaw, alive, skin, emote) {
    // 🪑 ထိုင်တာက gesture မဟုတ်ဘဲ အနေအထား — Locomotion က ကိုင်တယ်
    this.sitting = emote === 'sit';
    if (emote && emote !== 'sit' && emote !== this.lastEmote) {
      this.emotes.play(emote);
      this.lastEmote = emote;
    }
    if (!emote) this.lastEmote = null;
    this.targetPos.set(p[0], p[1], p[2]);
    this.targetYaw = yaw;
    this.group.visible = alive !== 0; // သေဆုံးနေချိန် ဖျောက်
    if (skin && this.skin !== skin) { // ဆိုင်ကဝယ်ထားသော skin — အားလုံးမြင်ရ
      this.skin = skin;
      this.bodyMesh.material.color.set(skin);
    }
  }

  update(dt) {
    this.emotes.update(dt);
    const k = Math.min(1, dt * 10);
    this.group.position.lerp(this.targetPos, k);
    let d = this.targetYaw - this.group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.group.rotation.y += d * k;

    // ── ခြေလှမ်း — ဖန်သားပြင်ပေါ်မှာ တကယ် ရွေ့နေတဲ့ အမြန်နှုန်းကနေ ─────
    // ★ target ဆီက အကွာအဝေး မဟုတ်ဘူး — packet တစ်ခု နောက်ကျရင်
    //   ရုတ်တရက် ပြေးသလို ဖြစ်မယ်။ တကယ် ရွေ့ခဲ့တာကိုပဲ တိုင်းတယ်။
    const g = this.group.position;
    const moved = Math.hypot(g.x - this._prev.x, g.z - this._prev.z);
    this._prev.copy(g);
    const inst = dt > 0 ? moved / dt : 0;
    // အနည်းငယ် ချောစေတယ် — network jitter က ခြေလှမ်းကို တုန်မစေရ
    this._speed += (inst - this._speed) * Math.min(1, dt * 6);
    this.loco?.setMotion({
      speed: this._speed,
      running: this._speed > 6,
      grounded: true,
      sitting: this.sitting,
    });
    // 🔋 အဝေးက လူတွေရဲ့ animation မတွက်ဘူး — ရုပ်က မမြင်သာလောက်တဲ့
    //    အကွာအဝေးမှာ mixer/bone တွက်ချက်မှုက ဖုန်း CPU ကို အလကား စားတယ်။
    //    နေရာကတော့ ဆက်လိုက်တယ် (မဟုတ်ရင် အနားရောက်လာချိန် ခုန်မယ်)。
    if (dt > 0 && (!this.lodFar || this._lodTick-- <= 0)) {
      this.loco?.update(this.lodFar ? dt * 4 : dt);
      if (this.lodFar) this._lodTick = 3;
    }
  }
}

// ---- Net Client ----
export class NetClient {
  constructor({ engine, world, avatar, hud }) {
    this.engine = engine;
    this.world = world;
    this.avatar = avatar;
    this.hud = hud;
    this.remotes = new Map();
    this.myId = null;
    this.connected = false;
    this.sendTimer = 0;
    // StrikeRoom က ချိတ်မည့် callbacks
    this.onHit = null;        // ({dmg, hp, headshot}) — ကိုယ်အထိခံရချိန်
    this.onKilled = null;     // ({byName}) — ကိုယ်သေချိန်
    this.onKillFeedText = null;
    engine.register(this);
  }

  connect(url, { name, token = null } = {}) {
    this.name = name;
    try { this.ws = new WebSocket(url); }
    catch (e) { console.warn('🌐 Server မချိတ်နိုင် — offline mode', e); return; }

    this.ws.onopen = () => this.ws.send(JSON.stringify({ t: 'hello', name, token }));
    this.ws.onmessage = (ev) => this.onMessage(JSON.parse(ev.data));
    this.ws.onclose = () => {
      const was = this.connected;
      this.connected = false;
      this.clearRemotes();
      if (was) this.hud.addToast?.('🌐 Server နှင့် အဆက်ပြတ်သွားသည် — offline mode');
      else console.log('🌐 Multiplayer server မတွေ့ပါ — offline mode ဖြင့် ဆက်ကစားနိုင်သည်');
    };
    this.ws.onerror = () => {};
  }

  onMessage(msg) {
    switch (msg.t) {
      case 'welcome':
        this.myId = msg.id;
        this.connected = true;
        this.hud.addToast?.(`🌐 ချိတ်ဆက်ပြီး — #${msg.id} ${msg.name}` +
          (msg.auth === 'cognito' ? ' 🔐 (gwave.cc တရားဝင် login)' : ''));
        break;
      case 'auth_error':
        this.hud.addToast?.(`🔐 Login မအောင်မြင် — ${msg.reason}။ gwave.cc မှ ပြန်ဝင်ပါ`);
        break;
      case 'join':
        this.hud.addToast?.(`👋 ${msg.name} ဝင်ရောက်လာသည်`);
        break;
      case 'leave':
        this.hud.addToast?.(`🚪 ${msg.name} ထွက်သွားသည်`);
        this.removeRemote(msg.id);
        break;
      case 'snapback':
        // Server က ရွေ့လျားမှုကို ငြင်းပယ် — တရားဝင်နေရာသို့ ပြန်ဆွဲ
        this.avatar.teleport(new THREE.Vector3(msg.p[0], msg.p[1], msg.p[2]));
        break;
      case 'hit':
        if (msg.target === this.myId) {
          this.onHit?.({ dmg: msg.dmg, hp: msg.hp, headshot: msg.headshot });
        } else if (msg.by === this.myId) {
          this.hud.addToast?.(msg.headshot ? '🎯 ဦးခေါင်းထိမှန်!' : `🎯 ထိမှန် −${msg.dmg}`);
        }
        break;
      case 'kill': {
        const hs = msg.headshot ? ' (ဦးခေါင်း!)' : '';
        this.onKillFeedText?.(`💥 ${msg.byName} ⟶ ${msg.targetName}${hs}`);
        if (msg.target === this.myId) this.onKilled?.({ byName: msg.byName });
        if (msg.board) {
          const top = msg.board.sort((a, b) => b.k - a.k)[0];
          if (top) this.onKillFeedText?.(`🏆 ထိပ်ဆုံး: ${top.n} (${top.k} kills)`);
        }
        break;
      }
      case 'respawn':
        if (msg.id === this.myId) {
          this.avatar.teleport(new THREE.Vector3(msg.p[0], msg.p[1], msg.p[2]));
        }
        break;
      // ---------- Economy (Phase 0) ----------
      case 'points':
        if (msg.earnedTotal > 0) this.hud.addToast?.(`💰 +${msg.earnedTotal} GP (လက်ကျန် ${msg.balance})`);
        this.hud.setPoints?.(msg.balance);
        break;
      case 'quest_done':
        this.hud.addToast?.(`✅ Quest ပြီးဆုံး: ${msg.name_mm} +${msg.reward} GP`);
        break;
      case 'streak':
        this.hud.addToast?.(`${msg.label} — ${msg.name} (${msg.streak} kills ဆက်တိုက်)`);
        break;
      case 'wallet':
        this.hud.setWalletPanel?.(msg.wallet, msg.shop,
          (itemId) => this.sendBuy(itemId),
          (itemId) => { // ⛓️ NFT mint — MetaMask address လိုအပ်
            const addr = this.web3Address?.();
            if (!addr) { this.hud.addToast?.('🦊 အရင် Wallet ချိတ်ပါ (ညာဘက်အပေါ်ခလုတ်)'); return; }
            this.sendNftMint(itemId, addr);
          });
        break;
      case 'quests':
        this.hud.setQuestsPanel?.(msg.quests);
        break;
      case 'toast':
        this.hud.addToast?.(msg.text);
        break;
      case 'world':
        this.onWorld?.(msg); // main.js က room ဆောက်ပြီး ကူးပေးမည်
        break;
      case 'world_save_result':
        this.hud.addToast?.(msg.ok ? '✅ ကမ္ဘာ သိမ်းပြီးပါပြီ' : `❌ သိမ်း၍မရ — ${msg.error || ''}`);
        break;
      case 'rewards':
        this.hud.setRewardsPanel?.(msg.catalog, msg.redemptions, (id) => this.sendRedeem(id));
        break;
      case 'redeem_result':
        if (msg.ok) {
          this.hud.addToast?.(`🎁 ${msg.reward.name_mm} — Code: ${msg.code} (ဆိုင်မှာပြပါ)`);
          this.hud.setPoints?.(msg.points);
          this.requestRewards();
        } else this.hud.addToast?.(`❌ ${msg.error} (လက်ကျန် ${msg.points ?? '?'} GP)`);
        break;
      // ---------- 🎙️ Voice ----------
      case 'voice_peers':
        this.voice?.onPeerList(msg.ids || []);
        break;
      case 'voice_signal':
        this.voice?.onSignal(msg.from, msg.data);
        break;

      // ---------- 🏛️ Meetings ----------
      case 'meeting_spaces':
        this.hud.setMeetingPanel?.(msg.spaces, msg.active,
          (space, title) => this.meetingCreate(space, title),
          (code) => this.meetingJoin(code));
        break;
      case 'meeting_created':
        this.hud.addToast?.(`🏛️ အစည်းအဝေး ဖန်တီးပြီး — Code: ${msg.code} (မျှဝေပါ)`);
        this.onMeeting?.(msg);
        break;
      case 'meeting_joined':
        this.onMeeting?.(msg);
        break;
      case 'meeting_error':
        this.hud.addToast?.(`❌ ${msg.error}`);
        break;

      case 'trophies':
        this.hud.setTrophiesSection?.(msg.trophies || [], msg.chain_mode, (season) => {
          const addr = this.web3Address?.();
          if (!addr) { this.hud.addToast?.('🦊 အရင် Wallet ချိတ်ပါ'); return; }
          this.ws.send(JSON.stringify({ t: 'trophy_mint', season, wallet: addr }));
        });
        break;
      case 'trophy_result':
        if (msg.ok) {
          this.hud.addToast?.(`🏆 Season Trophy NFT ထုတ်ပြီး! ${msg.item_id} — Token #${msg.token_id}` +
            (msg.explorer ? ` — ${msg.explorer}` : ''));
          this.requestTrophies();
        } else this.hud.addToast?.(`❌ ${msg.error}`);
        break;
      case 'nft_result':
        if (msg.ok) {
          this.hud.addToast?.(`⛓️ NFT ထုတ်ပြီး! Token #${msg.token_id}` +
            (msg.mode === 'mock' ? ' (mock)' : '') + (msg.explorer ? ` — ${msg.explorer}` : ''));
          this.requestWallet();
        } else this.hud.addToast?.(`❌ ${msg.error}`);
        break;
      case 'buy_result':
        if (msg.ok) {
          this.hud.addToast?.(`🛍️ ${msg.item.name_mm} ဝယ်ပြီး (−${msg.item.price} GP, လက်ကျန် ${msg.points})`);
          this.hud.setPoints?.(msg.points);
          if (msg.equipped_skin) this.avatar.setSkin?.(msg.equipped_skin);
          this.requestWallet(); // panel ပြန် refresh
        } else {
          this.hud.addToast?.(`❌ ${msg.error || 'ဝယ်၍မရပါ'} (လက်ကျန် ${msg.points ?? '?'} GP)`);
        }
        break;
      case 'snap': {
        const seen = new Set();
        for (const pl of msg.players) {
          if (pl.id === this.myId) continue;
          seen.add(pl.id);
          let r = this.remotes.get(pl.id);
          if (!r) {
            r = new RemotePlayer(pl.id, pl.n);
            this.remotes.set(pl.id, r);
            this.world.current?.group.add(r.group);
            r.group.position.set(pl.p[0], pl.p[1], pl.p[2]);
          }
          r.setState(pl.p, pl.y, pl.a, pl.c, pl.e);
          r.setSpeaking(!!pl.sp);
        }
        for (const id of [...this.remotes.keys()])
          if (!seen.has(id)) this.removeRemote(id);
        break;
      }
    }
  }

  // PvP — Weapon raycast အတွက် remote player meshes
  getTargetMeshes() {
    const meshes = [];
    for (const r of this.remotes.values())
      if (r.group.visible) meshes.push(r.bodyMesh, r.headMesh);
    return meshes;
  }

  // 🎭 Emote
  sendEmote(id) { if (this.connected) this.ws.send(JSON.stringify({ t: 'emote', id })); }
  // 🎙️ Voice
  voiceReady() { if (this.connected) this.ws.send(JSON.stringify({ t: 'voice_ready' })); }
  voiceSignal(to, data) { if (this.connected) this.ws.send(JSON.stringify({ t: 'voice_signal', to, data })); }
  setSpeaking(on) {
    this.localSpeaking = on;
    if (this.connected) this.ws.send(JSON.stringify({ t: 'speaking', on }));
  }
  // 🏛️ Meetings
  requestMeetings() { if (this.connected) this.ws.send(JSON.stringify({ t: 'meeting_spaces' })); }
  meetingCreate(space, title) { if (this.connected) this.ws.send(JSON.stringify({ t: 'meeting_create', space, title })); }
  meetingJoin(code) { if (this.connected) this.ws.send(JSON.stringify({ t: 'meeting_join', code })); }

  requestWallet() { if (this.connected) this.ws.send(JSON.stringify({ t: 'wallet' })); }
  requestRewards() { if (this.connected) this.ws.send(JSON.stringify({ t: 'rewards' })); }
  requestTrophies() { if (this.connected) this.ws.send(JSON.stringify({ t: 'trophies' })); }
  sendRedeem(rewardId) { if (this.connected) this.ws.send(JSON.stringify({ t: 'redeem', reward_id: rewardId })); }
  requestWorld(key = null) { if (this.connected) this.ws.send(JSON.stringify({ t: 'world_load', key })); }
  saveWorld(name, data) { if (this.connected) this.ws.send(JSON.stringify({ t: 'world_save', name, data })); }
  sendNftMint(itemId, wallet) { if (this.connected) this.ws.send(JSON.stringify({ t: 'nft_mint', item_id: itemId, wallet })); }
  requestQuests() { if (this.connected) this.ws.send(JSON.stringify({ t: 'quests' })); }
  sendBuy(itemId) { if (this.connected) this.ws.send(JSON.stringify({ t: 'buy', item_id: itemId })); }

  // Server ဆီ hit claim ပို့ — အပြီးသတ်ဆုံးဖြတ်ချက်က server ဘက်မှာ
  sendShoot(targetId, origin, dir) {
    if (!this.connected) return;
    this.ws.send(JSON.stringify({
      t: 'shoot', target: targetId,
      o: [+origin.x.toFixed(2), +origin.y.toFixed(2), +origin.z.toFixed(2)],
      d: [+dir.x.toFixed(3), +dir.y.toFixed(3), +dir.z.toFixed(3)],
    }));
  }

  removeRemote(id) {
    const r = this.remotes.get(id);
    if (!r) return;
    r.group.parent?.remove(r.group);
    this.remotes.delete(id);
  }

  clearRemotes() {
    for (const id of [...this.remotes.keys()]) this.removeRemote(id);
  }

  onRoomSwitch() { this.clearRemotes(); }

  update(dt) {
    // အကွာအဝေး LOD — ကင်မရာနဲ့ ၃၅m ကျော်ရင် animation ကို လျှော့တွက်
    const cam = this.engine?.camera?.position;
    for (const r of this.remotes.values()) {
      if (cam) r.lodFar = r.group.position.distanceToSquared(cam) > 35 * 35;
      r.update(dt);
    }
    if (!this.connected) return;
    this.sendTimer -= dt;
    if (this.sendTimer <= 0) {
      this.sendTimer = 1 / SEND_HZ;
      const p = this.avatar.group.position;
      this.ws.send(JSON.stringify({
        t: 's',
        r: this.world.current?.id || 'yangon',
        p: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
        y: +this.avatar.group.rotation.y.toFixed(2),
      }));
    }
  }
}
