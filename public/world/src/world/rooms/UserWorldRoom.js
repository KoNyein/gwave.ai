// ============================================================
// UserWorldRoom.js — ကစားသမား ကိုယ်ပိုင် Metaverse ကမ္ဘာ
// ✔ RDS game.worlds မှ data ဖြင့် dynamic တည်ဆောက်
// ✔ ကိုယ်ပိုင်ကမ္ဘာဖြစ်လျှင် Build Mode [B] — ကိုယ်တိုင် create/edit
// ✔ Room id = world:<owner_key> — multiplayer အလိုအလျောက်ရ
//   (တူညီသောကမ္ဘာထဲ ရောက်နေသူချင်း တွေ့မြင်နိုင်)
//
// Build Mode ခလုတ်များ —
//   B     — Build mode ဖွင့်/ပိတ် (ပိတ်လျှင် အလိုအလျောက် save)
//   1-5   — Block အမျိုးအစား (ကြမ်း/နံရံ/တိုင်/သစ်ပင်/မီးတိုင်)
//   C     — အရောင်ပြောင်း
//   F     — ရှေ့မှာ ချထား (grid snap)
//   X     — အနီးဆုံး block ဖျက်
// ============================================================
import * as THREE from 'three';
import {Room, addRoomLighting } from '../Room.js';
import { NPC } from '../../entities/NPC.js';
import { loadGLB } from '../../core/Assets.js';

const BLOCK_TYPES = [
  { id: 'floor',  name_mm: 'ကြမ်းပြား',  size: [2, 0.2, 2] },
  { id: 'wall',   name_mm: 'နံရံ',       size: [2, 2.4, 0.3] },
  { id: 'pillar', name_mm: 'တိုင်',       size: [0.4, 3, 0.4] },
  { id: 'tree',   name_mm: 'သစ်ပင်',     size: [1.2, 2.4, 1.2], shape: 'cone' },
  { id: 'lamp',   name_mm: 'မီးတိုင်',    size: [0.3, 2.6, 0.3], glow: true },
  { id: 'prop', prop: 'prop_bench',   name_mm: '🪑 ထိုင်ခုံ (GLB)',   size: [1.8, 1, 0.5] },
  { id: 'prop', prop: 'prop_stall',   name_mm: '🏪 ဈေးဆိုင်စင် (GLB)', size: [1.9, 2, 1.2] },
  { id: 'prop', prop: 'prop_planter', name_mm: '🪴 ပန်းအိုး (GLB)',   size: [0.9, 1.1, 0.9] },
  { id: 'npc',  name_mm: '🧍 NPC ဇာတ်ကောင်', size: [0.8, 1.9, 0.8] },
];
const COLORS = ['#c9b48a', '#8ecbff', '#3ddc97', '#f5c542', '#d8324a', '#7f5cff', '#ffffff', '#5a4a3a'];
const snap = (v) => Math.round(v);

export class UserWorldRoom extends Room {
  constructor(ctx, { key, name, data, own }) {
    super(`world:${key}`, own ? `🌍 ${name} (ကိုယ်ပိုင်)` : `🌍 ${name}`);
    this.ctx = ctx;
    this.ownerKey = key;
    this.worldName = name;
    this.data = data;
    this.own = own;
    this.background = parseInt((data.sky || '#87b7d9').slice(1), 16);
    this.buildMode = false;
    this.typeIndex = 0;
    this.colorIndex = 0;
    this.placedMeshes = []; // { mesh, obj } — ဖျက်ရန်/save ရန်
  }

  build() {
    const d = this.data;
    // မြေပြင် + အလင်း
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ color: d.ground || '#2c4a2e', roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    this.group.add(ground);
    this.group.add(new THREE.GridHelper(100, 100, 0x335533, 0x2a3a2a));
    addRoomLighting(this, 'day');

    // သိမ်းထားသော object များ ပြန်တည်ဆောက်
    for (const obj of d.objects || []) this.spawnObject(obj);

    // Ghost (build preview)
    this.ghost = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, wireframe: false })
    );
    this.ghost.visible = false;
    this.group.add(this.ghost);

    // 👤 Profile Board — ပိုင်ရှင့် stats ကို ကမ္ဘာထဲ billboard ဖြင့်ပြ
    this.buildProfileBoard(new THREE.Vector3(-8, 3, 8));

    // Portal — Yangon hub သို့ပြန်
    this.addPortal({
      position: new THREE.Vector3(0, 0, 20),
      targetRoomId: 'yangon',
      label: 'Cyber-Yangon သို့ပြန်ရန်',
      color: 0x7f5cff,
    });
    this.spawn.set(0, 0, 14);
  }

  // 👤 ကမ္ဘာပိုင်ရှင် profile billboard — stats API မှ XP/GP fetch ပြီးရေး
  buildProfileBoard(position) {
    const canvas = document.createElement('canvas');
    canvas.width = 768; canvas.height = 384;
    const tex = new THREE.CanvasTexture(canvas);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 4.5),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    board.position.copy(position);
    board.rotation.y = Math.PI / 5;
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(9.5, 5, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x141b30, metalness: 0.7, roughness: 0.3 })
    );
    frame.position.copy(position); frame.position.z -= 0.16; frame.rotation.y = Math.PI / 5;
    this.group.add(frame, board);

    const draw = (stats, wallet) => {
      const c = canvas.getContext('2d');
      c.clearRect(0, 0, 768, 384);
      c.fillStyle = 'rgba(6,9,19,.85)'; c.fillRect(0, 0, 768, 384);
      c.fillStyle = '#f5c542'; c.font = 'bold 42px Padauk, sans-serif';
      c.fillText(`👤 ${this.worldName}`, 30, 64);
      c.strokeStyle = '#f5c542'; c.globalAlpha = .5;
      c.beginPath(); c.moveTo(30, 86); c.lineTo(738, 86); c.stroke();
      c.globalAlpha = 1;
      c.font = '32px Padauk, sans-serif';
      c.fillStyle = '#eaf0ff';
      c.fillText(`⭐ XP: ${stats?.xp ?? '—'}   🔫 K/D: ${stats?.kills ?? 0}/${stats?.deaths ?? 0}   🎯 HS: ${stats?.headshots ?? 0}`, 30, 150);
      c.fillStyle = '#3ddc97';
      c.fillText(`💰 GP: ${wallet?.points ?? '—'}   🎒 Items: ${wallet?.inventory?.length ?? 0}`, 30, 210);
      c.fillStyle = '#8a97b8'; c.font = '26px Padauk, sans-serif';
      c.fillText(this.own ? '🔨 [B] နှိပ်ပြီး ကမ္ဘာကို ဆက်တည်ဆောက်ပါ' : '🌍 ဒီကမ္ဘာကို လာလည်နေသည်', 30, 280);
      tex.needsUpdate = true;
    };
    draw(null, null);
    const base = this.ctx.statsUrl;
    if (base) {
      Promise.all([
        fetch(`${base}/player/${encodeURIComponent(this.ownerKey)}`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${base}/wallet/${encodeURIComponent(this.ownerKey)}`).then(r => r.ok ? r.json() : null).catch(() => null),
      ]).then(([stats, wallet]) => draw(stats, wallet));
    }
  }

  // object data → mesh (+ collider)
  spawnObject(obj) {
    // 🧍 NPC — ရှိပြီးသား NPC class ကိုပဲသုံး (wander + label + E စကားပြော)
    if (obj.t === 'npc') {
      const npc = new NPC({
        name: obj.name || 'NPC',
        color: parseInt((obj.c || '#f5c542').slice(1), 16),
        home: new THREE.Vector3(obj.p[0], 0, obj.p[2]),
        range: 5,
        dialogue: obj.lines?.length ? obj.lines : ['မင်္ဂလာပါ!'],
      });
      this.addNPC(npc);
      this.placedMeshes.push({ holder: npc.group, obj, box: null, npc });
      return;
    }
    // 🪑 GLB Prop — assets/props.glb ထဲက named child ကို clone
    if (obj.t === 'prop') {
      const holder = new THREE.Group();
      holder.position.set(obj.p[0], obj.p[1] || 0, obj.p[2]);
      this.group.add(holder);
      const entry = { holder, obj, box: null };
      this.placedMeshes.push(entry);
      loadGLB('./assets/props.glb').then((gltf) => {
        const src = gltf.scene.getObjectByName(obj.prop);
        if (!src) return;
        const clone = src.clone(true);
        // props.glb ထဲမှာ offset နဲ့ထားထားလို့ world position ကို 0 ပြန်ချ
        const srcBox = new THREE.Box3().setFromObject(src);
        const center = srcBox.getCenter(new THREE.Vector3());
        clone.position.set(-center.x, 0, -center.z);
        clone.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        holder.add(clone);
        holder.updateMatrixWorld(true);
        entry.box = new THREE.Box3().setFromObject(holder);
        this.colliders.push(entry.box);
      }).catch(e => console.warn('prop load fail:', e));
      return;
    }
    const type = BLOCK_TYPES.find(t => t.id === obj.t) || BLOCK_TYPES[0];
    const [w, h, dd] = obj.s || type.size;
    let mesh;
    if (type.shape === 'cone') {
      mesh = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.8, 8),
        new THREE.MeshStandardMaterial({ color: 0x5a4a3a }));
      trunk.position.y = 0.4;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(w / 2, h - 0.8, 8),
        new THREE.MeshStandardMaterial({ color: obj.c || '#3ddc97' }));
      leaf.position.y = 0.8 + (h - 0.8) / 2;
      mesh.add(trunk, leaf);
    } else {
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, dd),
        new THREE.MeshStandardMaterial({
          color: obj.c || '#c9b48a', roughness: 0.8,
          emissive: type.glow ? new THREE.Color(obj.c || '#f5c542') : 0x000000,
          emissiveIntensity: type.glow ? 0.7 : 0,
        })
      );
      mesh.position.y = h / 2;
      mesh.castShadow = true; mesh.receiveShadow = true;
    }
    const holder = new THREE.Group();
    holder.add(mesh);
    holder.position.set(obj.p[0], obj.p[1] || 0, obj.p[2]);
    this.group.add(holder);
    if (type.glow) {
      const light = new THREE.PointLight(obj.c || 0xf5c542, 12, 12);
      light.position.y = h; holder.add(light);
    }
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder);
    this.colliders.push(box);
    this.placedMeshes.push({ holder, obj, box });
  }

  removeNearest(pos) {
    let best = null, bestD = 3;
    for (const pm of this.placedMeshes) {
      const d = pm.holder.position.distanceTo(pos);
      if (d < bestD) { best = pm; bestD = d; }
    }
    if (!best) return false;
    this.group.remove(best.holder);
    if (best.box) this.colliders.splice(this.colliders.indexOf(best.box), 1);
    if (best.npc) this.npcs.splice(this.npcs.indexOf(best.npc), 1);
    this.placedMeshes.splice(this.placedMeshes.indexOf(best), 1);
    return true;
  }

  currentType() { return BLOCK_TYPES[this.typeIndex]; }

  saveData() {
    return {
      ground: this.data.ground || '#2c4a2e',
      sky: this.data.sky || '#87b7d9',
      objects: this.placedMeshes.map(pm => pm.obj),
    };
  }

  toggleBuild(hud, net) {
    if (!this.own) { hud.addToast('🔒 ဒီကမ္ဘာက သင့်ကမ္ဘာမဟုတ်ပါ — ကြည့်ရှုရုံသာ'); return; }
    this.buildMode = !this.buildMode;
    this.ghost.visible = this.buildMode;
    if (this.buildMode) {
      hud.addToast('🔨 Build Mode — [1-5] block [6-8] GLB props [9] NPC ၊ [C] အရောင် ၊ [F] ချ ၊ [X] ဖျက် ၊ [B] သိမ်း+ထွက်');
    } else {
      net?.saveWorld(this.worldName, this.saveData());
      hud.addToast('💾 ကမ္ဘာကို သိမ်းနေသည်…');
    }
  }

  update(dt, time) {
    super.update(dt, time);
    const { input, avatar, hud, net } = this.ctx;

    if (input.justPressed('KeyB')) this.toggleBuild(hud, net);
    if (!this.buildMode) return;

    // Block type / အရောင် ရွေး
    for (let i = 0; i < 9; i++) {
      if (input.justPressed(`Digit${i + 1}`)) {
        this.typeIndex = i;
        hud.addToast(`🧱 ${this.currentType().name_mm}`);
      }
    }
    if (input.justPressed('KeyC')) {
      this.colorIndex = (this.colorIndex + 1) % COLORS.length;
      hud.addToast(`🎨 အရောင် ${this.colorIndex + 1}/${COLORS.length}`);
    }

    // Ghost — ကစားသမားရှေ့ 3m, grid snap
    const f = avatar.forward();
    const type = this.currentType();
    const [w, h, dd] = type.size;
    const gx = snap(avatar.group.position.x + f.x * 3);
    const gz = snap(avatar.group.position.z + f.z * 3);
    this.ghost.scale.set(w, h, dd);
    this.ghost.position.set(gx, h / 2, gz);
    this.ghost.material.color.set(COLORS[this.colorIndex]);

    // ချထား / ဖျက်
    if (input.justPressed('KeyF')) {
      if (this.placedMeshes.length >= 400) { hud.addToast('⚠️ Block 400 ပြည့်ပြီ'); return; }
      if (type.id === 'npc') {
        const npcCount = this.placedMeshes.filter(pm => pm.obj.t === 'npc').length;
        if (npcCount >= 10) { hud.addToast('⚠️ NPC ၁၀ ယောက် ပြည့်ပြီ'); return; }
        const name = (window.prompt('NPC နာမည်', 'ကိုမောင်') || 'NPC').slice(0, 24);
        const raw = window.prompt('NPC ပြောမည့်စကားများ ( | ခြားရေးပါ)', 'မင်္ဂလာပါ! | ကျွန်တော့်ကမ္ဘာကို ကြိုဆိုပါတယ်') || '';
        const lines = raw.split('|').map(l => l.trim()).filter(Boolean).slice(0, 6);
        this.spawnObject({ t: 'npc', p: [gx, 0, gz], name, lines, c: COLORS[this.colorIndex] });
      } else if (type.id === 'prop') {
        this.spawnObject({ t: 'prop', prop: type.prop, p: [gx, 0, gz] });
      } else {
        this.spawnObject({ t: type.id, p: [gx, 0, gz], s: type.size, c: COLORS[this.colorIndex] });
      }
    }
    if (input.justPressed('KeyX')) {
      if (this.removeNearest(avatar.group.position)) hud.addToast('🗑️ ဖျက်ပြီး');
    }
  }
}
