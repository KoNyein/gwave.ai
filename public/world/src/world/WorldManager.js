import { sfx } from '../core/Sfx.js';
// ============================================================
// WorldManager.js — Room များအားလုံးကို စီမံသည့် World Map စနစ်
// register() ဖြင့် room ထည့် → switchTo() ဖြင့် ကူးပြောင်း
// Room ကူးတိုင်း — colliders, camera mode, background, onEnter/onExit
// အားလုံးကို အလိုအလျောက် ချိတ်ဆက်ပေးသည်
// ============================================================
export class WorldManager {
  constructor(ctx) {
    // ctx = { engine, input, avatar, hud } — room များသို့လည်း ဆက်ပေးမည်
    this.ctx = ctx;
    this.engine = ctx.engine;
    this.avatar = ctx.avatar;
    this.hud = ctx.hud;
    this.rooms = new Map();
    this.current = null;
    this.time = 0;
    this.engine.register(this);
  }

  register(room) { this.rooms.set(room.id, room); }

  switchTo(roomId) {
    const next = this.rooms.get(roomId);
    if (!next) { console.warn('Room မတွေ့ပါ:', roomId); return; }

    if (this.current) {
      this.current.onExit(this.ctx);
      this.engine.scene.remove(this.current.group);
    }
    if (!next.built) { next.build(); next.built = true; }

    this.engine.scene.add(next.group);

    // Physics + Camera + နောက်ခံရောင် ကို room အလိုက် ချိတ်
    this.avatar.physics.setColliders(next.colliders);
    this.avatar.setMode(next.cameraMode || 'tps');
    // ★ Fallback ကို အနည်းငယ် လင်းစေတယ် — အခန်းအများစုက ကိုယ်ပိုင်
    //   background ကို addRoomLighting ကနေ ရပြီးသား ဖြစ်တယ်။
    const bg = next.background ?? 0x0d1428;
    this.engine.scene.background.set(bg);
    this.engine.scene.fog.color.set(bg);
    // 🌫️ မြူ အကွာအဝေးကိုပါ အခန်းအလိုက် — အပြင်ဘက် အခန်းတွေက တောင်တန်း
    //    မြင်ရဖို့ ဝေးဝေး လိုတယ်၊ အတွင်းခန်းတွေက အနီးမှာပဲ ကောင်းတယ်။
    this.engine.scene.fog.near = next.fogNear ?? 55;
    this.engine.scene.fog.far = next.fogFar ?? 190;

    // 🎧 ပတ်ဝန်းကျင် အသံ — အခန်းအလိုက် (မြို့ ဟိန်းသံ / ပင်လယ် / တောင်လေ)
    sfx.ambient(next.ambient || 'none');
    // 🛻 ကားစနစ်ကို အခန်းအသစ် ပြောပြ — ဟောင်းအခန်းက ကားတွေ မကျန်စေရ
    this.ctx.vehicles?.setRoom(next);
    this.avatar.teleport(next.spawn);
    this.current = next;
    this.hud?.setRoom(next.title);
    // ⚔️ ခလုတ်တန်းက ဒီ class ကို ကြည့်ပြီး 🔫 ကို ပြ/ဖျောက်တယ်
    document.body.classList.toggle('combat', !!next.combat);
    next.onEnter(this.ctx);
  }

  // ကစားသမားနှင့် အနီးဆုံး portal (E နှိပ်ရန် hint အတွက်)
  nearestPortal(maxDist = 2.2) {
    if (!this.current) return null;
    const p = this.avatar.group.position;
    let best = null, bestD = maxDist;
    for (const portal of this.current.portals) {
      const d = portal.position.distanceTo(p);
      if (d < bestD) { best = portal; bestD = d; }
    }
    return best;
  }

  // ကစားသမားနှင့် အနီးဆုံး function station
  nearestStation(maxDist = 2.4) {
    if (!this.current) return null;
    const p = this.avatar.group.position;
    let best = null, bestD = maxDist;
    for (const st of this.current.stations || []) {
      const d = st.position.distanceTo(p);
      if (d < bestD) { best = st; bestD = d; }
    }
    return best;
  }

  // ကစားသမားနှင့် အနီးဆုံး NPC (စကားပြောရန်)
  nearestNPC(maxDist = 2.5) {
    if (!this.current) return null;
    const p = this.avatar.group.position;
    let best = null, bestD = maxDist;
    for (const npc of this.current.npcs) {
      const d = npc.group.position.distanceTo(p);
      if (d < bestD) { best = npc; bestD = d; }
    }
    return best;
  }

  update(dt) {
    this.time += dt;
    this.current?.update(dt, this.time);
  }
}
