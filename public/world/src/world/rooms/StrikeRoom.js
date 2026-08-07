// ============================================================
// StrikeRoom.js — "GWAVE STRIKE Arena" (FPS Combat Room)
// Framework ထဲ ပေါင်းစပ်ထားသော compact FPS — CS/PUBG ခံစားချက်
// FPS mode + သေနတ် + ရန်သူ AI bots + HP/Ammo/Kill feed (မြန်မာ HUD)
// (ရှိပြီးသား GWAVE STRIKE package အပြည့်အစုံကိုလည်း ဒီပုံစံအတိုင်း
//  Room class တစ်ခုအဖြစ် ထုပ်ပိုးပြီး အစားထိုးချိတ်ဆက်နိုင်သည်)
// ============================================================
import * as THREE from 'three';
import { Room } from '../Room.js';
import { Weapon } from '../../game/Weapon.js';
import { EnemyBot } from '../../game/EnemyBot.js';

export class StrikeRoom extends Room {
  constructor(ctx) {
    super('strike', 'GWAVE STRIKE Arena ⚔️');
    this.ctx = ctx; // { engine, input, avatar, hud }
    this.cameraMode = 'fps';
    this.playerHP = 100;
    this.score = 0;
  }

  build() {
    const { engine } = this.ctx;

    // ကြမ်းပြင် — စစ်မြေပြင် ကွန်ကရစ်
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 70),
      new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    this.group.add(ground);
    this.group.add(new THREE.GridHelper(70, 35, 0x3a3f48, 0x30343c));

    // အလင်း
    this.group.add(new THREE.AmbientLight(0xffffff, 0.45));
    const sun = new THREE.DirectionalLight(0xffe8c0, 1.1);
    sun.position.set(25, 40, 15); sun.castShadow = true;
    this.group.add(sun);

    // ပတ်လည်နံရံ ၄ ခု (collision ပါ — arena ပြင်ပ မထွက်နိုင်)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3d434e, roughness: 0.8 });
    const walls = [
      { size: [70, 5, 1], pos: [0, 2.5, -35] },
      { size: [70, 5, 1], pos: [0, 2.5, 35] },
      { size: [1, 5, 70], pos: [-35, 2.5, 0] },
      { size: [1, 5, 70], pos: [35, 2.5, 0] },
    ];
    for (const w of walls) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(...w.size), wallMat);
      wall.position.set(...w.pos); wall.castShadow = true;
      this.group.add(wall);
      this.addCollider(wall);
    }

    // သေတ္တာများ — ခိုကွယ်ရာ (cover) + collision + အပေါ်တက်ရပ်နိုင်
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x8a6d3b, roughness: 0.85 });
    const cratePositions = [
      [-8, -10], [6, -14], [14, 4], [-15, 8], [0, -22],
      [-20, -18], [18, -20], [10, 16], [-6, 20], [22, 10],
    ];
    for (const [x, z] of cratePositions) {
      const h = 1.6 + Math.random() * 1.2;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(2.4, h, 2.4), crateMat);
      crate.position.set(x, h / 2, z); crate.castShadow = true; crate.receiveShadow = true;
      this.group.add(crate);
      this.addCollider(crate);
    }

    // သေနတ် + Bot များ
    this.weapon = new Weapon(engine, this.ctx.avatar.physics);
    this.bots = [
      new EnemyBot({ name: 'Bot-ရဲမင်း', spawn: new THREE.Vector3(-25, 0, -25), physics: this.ctx.avatar.physics }),
      new EnemyBot({ name: 'Bot-သီဟ',   spawn: new THREE.Vector3(25, 0, -25),  physics: this.ctx.avatar.physics }),
      new EnemyBot({ name: 'Bot-ဇော်ဂျီ', spawn: new THREE.Vector3(-25, 0, 25),  physics: this.ctx.avatar.physics }),
      new EnemyBot({ name: 'Bot-နဂါး',  spawn: new THREE.Vector3(25, 0, 25),   physics: this.ctx.avatar.physics }),
    ];
    for (const b of this.bots) this.group.add(b.group);

    // Portal — Cyber-Yangon သို့ပြန်ရန်
    this.addPortal({
      position: new THREE.Vector3(0, 0, 30),
      targetRoomId: 'yangon',
      label: 'Arena မှ ထွက်ရန် (Cyber-Yangon)',
      color: 0xffb020,
    });

    this.spawn.set(0, 0, 26);
  }

  onEnter({ hud, net, avatar }) {
    this.playerHP = 100;
    hud.setCombatVisible(true);
    hud.setHP(this.playerHP);
    this.weapon.setActive(true);
    hud.setAmmo(this.weapon.ammo, this.weapon.magSize);
    hud.addKill('⚔️ Arena ထဲ ဝင်ရောက်ပြီ — Bot ၄ ကောင် စောင့်နေသည်');

    // ---- PvP (server-authoritative) — server ချိတ်ထားလျှင် ----
    if (net) {
      if (net.connected) hud.addKill('🌐 PvP ဖွင့်ထား — အခြားကစားသမားများကိုပါ ပစ်နိုင်သည်');
      net.onKillFeedText = (t) => hud.addKill(t);
      net.onHit = ({ dmg, hp, headshot }) => {
        // Server ကသာ PvP damage ဆုံးဖြတ် — client က ပြသရုံ
        this.playerHP = hp;
        hud.setHP(Math.max(0, hp));
        hud.flashDamage();
        if (headshot) hud.addKill('☠️ ဦးခေါင်းအထိခံရ!');
      };
      net.onKilled = ({ byName }) => {
        hud.addKill(`☠️ ${byName} ⟶ သင် — ၄ စက္ကန့်အကြာ ပြန်ထွက်မည်`);
        this.playerHP = 100;
        hud.setHP(100); // server respawn message က နေရာပြန်ချမည်
      };
    }
  }

  onExit({ hud, net }) {
    hud.setCombatVisible(false);
    this.weapon.setActive(false);
    if (net) { net.onHit = null; net.onKilled = null; net.onKillFeedText = null; }
  }

  update(dt, time) {
    super.update(dt, time);
    const { input, avatar, hud, engine } = this.ctx;
    const playerPos = avatar.group.position;
    const playerHead = new THREE.Vector3(playerPos.x, playerPos.y + 1.6, playerPos.z);

    // ကစားသမား ပစ်ခတ်ခြင်း — PvE bots + PvP remote players
    if ((input.locked || input.touchMode) && input.justClicked()) {
      const meshes = [];
      for (const b of this.bots) if (b.alive) meshes.push(b.bodyMesh, b.headMesh);
      const net = this.ctx.net;
      if (net?.connected) meshes.push(...net.getTargetMeshes()); // PvP ပစ်မှတ်များ
      const hit = this.weapon.shoot(meshes);
      hud.setAmmo(this.weapon.ammo, this.weapon.magSize);
      if (hit?.died) {
        this.score++;
        hud.addKill(`💥 သင် ⟶ ${hit.bot.name} ${hit.headshot ? '(ဦးခေါင်း!) ' : ''}— ရမှတ် ${this.score}`);
      }
      if (hit?.netId != null) {
        // PvP — server ဆီ claim ပို့ (server rewind + validate ပြီးမှ damage ကျ)
        net.sendShoot(hit.netId, hit.origin, hit.dir);
      }
    }
    if (input.justPressed('KeyR')) {
      this.weapon.startReload();
      hud.addKill('🔄 ကျည်ထည့်နေသည်…');
    }
    this.weapon.update(dt, hud);

    // Bot AI + Bot ပစ်ခတ်မှု
    for (const bot of this.bots) {
      const fired = bot.update(dt, playerPos, playerHead);
      if (fired) {
        // Tracer — bot မှ ကစားသမားဆီ
        const from = new THREE.Vector3(bot.position.x, bot.position.y + 1.5, bot.position.z);
        const geo = new THREE.BufferGeometry().setFromPoints([from, playerHead]);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff5566, transparent: true, opacity: 0.8 }));
        engine.scene.add(line);
        setTimeout(() => {
          engine.scene.remove(line);
          geo.dispose(); line.material.dispose();
        }, 80);

        // ထိမှန်နှုန်း — အကွာအဝေးအလိုက် လျော့
        const dist = bot.position.distanceTo(playerPos);
        if (Math.random() < Math.max(0.15, 0.65 - dist * 0.012)) {
          this.playerHP -= 8 + Math.floor(Math.random() * 7);
          hud.setHP(Math.max(0, this.playerHP));
          hud.flashDamage();
          if (this.playerHP <= 0) {
            hud.addKill(`☠️ ${bot.name} ⟶ သင့်ကို ပစ်ချ — ပြန်စတင်မည်`);
            this.playerHP = 100;
            hud.setHP(this.playerHP);
            avatar.teleport(this.spawn);
          }
        }
      }
    }
  }
}
