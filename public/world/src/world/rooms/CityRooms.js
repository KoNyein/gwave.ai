// ============================================================
// CityRooms.js — မြန်မာ/ထိုင်း **မြို့များ**
//
// user: "Metaverse ထဲမှာ မြို့တွေ ဆောက်မယ် — မြန်မာပြည် အထင်ကရ မြို့တွေ
//        ဆောက်ပါ: မြဝတီ, ဘုရားသုံးဆူ, နှင့် ထိုင်းနိုင်ငံ မဲဆောက်,
//        ချင်းမိုင်, ဘန်ကောက်, ဖူးခက် မြို့များ ထည့်ပါ။ NPC များ ထည့်ပါ"
//
// ═══ ဒီဖိုင်က ဘာလို့ တစ်ဖိုင်တည်း လဲ ═══
//
// မြို့ ၅ ခုက **တည်ဆောက်ပုံ တူတယ်** — မြေပြင်, အလင်း, တောင်တန်း, လမ်း,
// အဆောက်အအုံ, NPC。 ကွာတာက **အချက်အလက်** ပဲ။ ဒါကြောင့် class ၅ ခု
// ကူးရေးမယ့်အစား `CityRoom` တစ်ခုနဲ့ spec ၅ ခု ထားတယ် — မြို့အသစ်
// ထည့်ချင်ရင် spec တစ်ခု ရေးရုံပါပဲ။
//
// ★ **အဆောက်အအုံတိုင်း ဝင်လို့ရရမယ်** (user: "သုံးမရတဲ့ အတွင်းသွားလို့
//   မရတဲ့ တိုက်တွေ အကုန် ဖယ်ပါ")。 CityKit ရဲ့ shophouse/tower က ရှေ့မှာ
//   တံခါးဝ ချန်ထားပြီး collider ကို နံရံအလိုက် ခွဲထားတယ် — ဘောက်စ်
//   တစ်ခုတည်းနဲ့ ဖုံးထားတာ မဟုတ်ဘူး။
// ============================================================

import * as THREE from 'three';
import { Room, addRoomLighting } from '../Room.js';
import { addTerrain } from '../Terrain.js';
import { addBuilding } from '../Buildings.js';
import { addManor, addKit, manorSpot } from '../Kit.js';
import { NPC } from '../../entities/NPC.js';
import { shophouse, tower, palm, water, road, gateArch, smallStupa, marketStall } from '../CityKit.js';

/// မြို့တစ်ခုချင်းရဲ့ အချက်အလက်။ `build(room)` က အဲဒီမြို့ရဲ့ ကိုယ်ပိုင်
/// အဆောက်အအုံတွေ ချတယ် — ကျန်တာ (မြေ, အလင်း, တောင်, NPC) က တူတူပဲ။
export class CityRoom extends Room {
  constructor(spec) {
    super(spec.id, spec.title);
    this.spec = spec;
    this.spawn = new THREE.Vector3(0, 0, spec.spawnZ ?? 14);
  }

  build() {
    const s = this.spec;

    // မြေပြင်
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(s.ground, s.ground),
      new THREE.MeshStandardMaterial({ color: s.groundColour, roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.group.add(ground);

    addRoomLighting(this, s.light);
    if (s.background != null) this.background = s.background;
    this.ambient = s.ambient || 'city';   // 🎧 ပတ်ဝန်းကျင် အသံ

    // 🏔️ ပတ်ဝန်းကျင် — မြို့တိုင်းက ပြေပြင်အစစ်ထဲမှာ ရှိရမယ်
    // 🏛️ အိမ်တော် ခြံဝန်းက မြို့ အပြင်မှာ — အဲဒီနေရာကို ပြားထားရမယ်
    const manor = manorSpot(s.ground);
    addTerrain(this, {
      ground: s.ground, palette: s.terrain, seed: s.seed,
      peak: s.peak, hill: s.hill,
      flatSpots: [manor.flatSpot],
    });

    s.build(this);

    // 🏛️ GreenWave Manor — မြို့တိုင်းမှာ ရှိတယ် (မြို့ အနားက ခြံဝန်း)
    void addManor(this, { position: manor.position, rotation: manor.rotation });

    // ══ 🚦 **အလုပ်လုပ်တဲ့ object များ** ══════════════════════════════
    //
    // user: "မြဝတီ နယ်စပ်မြို့တွေကို object များကို system function design
    //        မှန်အောင် လုပ်ပေးပါ"
    //
    // ★ အရင်က မြို့ ၅ ခုလုံးမှာ **portal ၀, station ၀** — ဂိတ်ကြီးက
    //   ကြည့်ရုံ အလှဆင်, ဈေးတန်းက ဝင်လို့ရပေမယ့် ဘာမှ မလုပ်ရ, မြို့ချင်း
    //   သွားလို့ မရ (menu ကနေပဲ ခုန်ရတယ်)。 နယ်စပ်မြို့မှာ **ဂိတ်ဆိုတာ
    //   ဖြတ်ကူးဖို့** — အဲဒါ မလုပ်ရင် object က အလုပ် မလုပ်တာပဲ。
    // ★ အခု ဂိတ်တိုင်းက တကယ့် နယ်စပ် ဖြတ်ကူးရာ ဖြစ်ပြီး ဈေးက shop,
    //   ကုန်သွယ်ရေး ရုံးက job board ကို ဖွင့်တယ်။
    // ★ ဂိတ် တစ်ခုကို tuple `[to, x, z, label, colour]` နဲ့ရော object နဲ့ရော
    //   ရေးလို့ရတယ် — object က `gate` (တိုင်+ဆိုင်းဘုတ်) နဲ့ `arrive`
    //   (ဟိုဘက် ဘယ်နေရာ ချမလဲ) ကို ပေးနိုင်တယ်။ tuple တွေက ရှိပြီးသား
    //   ဂိတ်တွေ မထိရအောင် အတိုင်း ကျန်နေတယ်။
    for (const g of (s.gates || [])) {
      const o = Array.isArray(g)
        ? { to: g[0], x: g[1], z: g[2], label: g[3], colour: g[4] }
        : g;
      this.addPortal({
        position: new THREE.Vector3(o.x, 0, o.z),
        targetRoomId: o.to, label: o.label, color: o.colour ?? 0xffb020,
        gate: o.gate ?? null,
        arrive: o.arrive ? new THREE.Vector3(...o.arrive) : null,
      });
    }
    for (const st of (s.stations || [])) {
      this.addStation({
        position: new THREE.Vector3(st[1], 0, st[2]),
        action: st[0], label: st[3], color: st[4] ?? 0x2de1ff,
      });
    }

    // 🧍 NPC များ — မြို့တစ်ခုချင်း ကိုယ်ပိုင် စကားပြောနဲ့
    for (const n of s.npcs) {
      this.addNPC(new NPC({
        name: n[0],
        home: new THREE.Vector3(n[1], 0, n[2]),
        range: n[3] ?? 7,
        dialogue: n[4],
        color: n[5] ?? 0xf5c542,
      }));
    }
  }
}

// ══════════════════════════════════════════════════════════════════════
// မြို့များ
// ══════════════════════════════════════════════════════════════════════

const CITY_SPECS = [
  // ── 🇲🇲 မြဝတီ — ထိုင်းနယ်စပ် ကုန်သွယ်ရေး မြို့ ─────────────────────
  {
    id: 'myawaddy', ambient: 'city', title: 'မြဝတီ (နယ်စပ် ကုန်သွယ်ရေးမြို့)',
    emoji: '🌉', ground: 150, groundColour: 0x8a8570, light: 'day',
    background: 0x9fc4e0, terrain: 'green', seed: 71, peak: 96, hill: 14,
    blurb: 'ထိုင်း–မြန်မာ ချစ်ကြည်ရေးတံတား, နယ်စပ်ဈေး, ကုန်ကားတန်း',
    build(r) {
      road(r.group, { x: 0, z: 0, w: 14, d: 150 });
      // 🌉 ချစ်ကြည်ရေးတံတား ဂိတ် — မြို့ရဲ့ အထင်ကရ
      gateArch(r, { x: 0, z: -46, w: 20, h: 11, colour: 0xe4dcc8 });
      // ဈေးတန်း — လမ်းနှစ်ဖက်
      for (let i = 0; i < 6; i++) {
        shophouse(r, { x: -16, z: -30 + i * 14, rot: Math.PI / 2, w: 9, d: 9, h: 7,
                       wall: 0xe0d3b8, roof: 0x9c4034, storeys: 2 });
        shophouse(r, { x: 16, z: -24 + i * 14, rot: -Math.PI / 2, w: 9, d: 9, h: 7,
                       wall: 0xd6cbb2, roof: 0x7d5230, storeys: 2 });
      }
      for (let i = 0; i < 5; i++) marketStall(r, { x: -8, z: -10 + i * 9, colour: 0xc94f4f });
      for (const [x, z, rot, col] of [[26, -18, 0, 0xb8863b], [26, 4, 0, 0x2f6f4e],
                                      [-28, 16, Math.PI, 0xd8324a]]) {
        void addBuilding(r, { kind: 'pickup', position: new THREE.Vector3(x, 0, z),
                              rotation: rot, paint: { name: 'MAT_Body_Paint', color: col } });
      }
      void addBuilding(r, { kind: 'stilt', position: new THREE.Vector3(-40, 0, -34),
                            rotation: Math.PI / 2,
                            hollow: { side: '+x', width: 4, step: 2.2 } });
      // 🏛️ ကိုလိုနီ အိမ် — နယ်စပ် ကုန်သွယ်ရေးမြို့မှာ ကိုလိုနီခေတ်
      //    ကုန်သည်အိမ်။ မော်ဒယ် အသစ်မှာ ထပ်တိုင်း တံခါး + ဂိတ် ပါတယ်။
      void addKit(r, { kit: 'colonial', position: new THREE.Vector3(-44, 0, 40) });
      smallStupa(r, { x: 42, z: -40, h: 17 });
    },
    // 🌉 ဂိတ်က တကယ် ဖြတ်ကူးလို့ရတယ် — မြဝတီ ↔ မဲဆောက် (တံတား ၂)
    gates: [['maesot', 0, -44, 'မဲဆောက် (ထိုင်း) သို့ — နယ်စပ် ဂိတ်', 0xffb020],
            ['three-pagodas', 0, 62, 'ဘုရားသုံးဆူ သို့ — တောင်ကြားလမ်း', 0x9ad3ff],
            // 🚕 တက္ကစီမြို့က ဒီကို ဂိတ် ချထားတယ် — ဒါက **ပြန်လာဖို့** ဂိတ်။
            //    မရှိရင် တစ်ဖက်သွား ဖြစ်ပြီး menu ကနေပဲ ပြန်ရတယ်။
            { to: 'taxi-district', x: 0, z: 26, gate: 'x', colour: 0xffd479,
              label: '🚕 တက္ကစီမြို့သို့', arrive: [41, 0, -21] },
            { to: 'taunggyi', x: 8, z: 4, gate: 'z', colour: 0x9ad3ff,
              label: '🎈 တောင်ကြီး သို့ — ရှမ်းကုန်း လမ်း', arrive: [58, 0, 0] },
            { to: 'mandalay', x: -8, z: 4, gate: 'z', colour: 0xffb020,
              label: '🏯 မန္တလေး သို့ — အထက်မြန်မာ လမ်း', arrive: [0, 0, -580] }],
    // 🏪 ဈေးတန်း = ဈေးဆိုင်, ကုန်သွယ်ရေး ရုံး = အလုပ်/ကုန်ပစ္စည်း ဘုတ်
    stations: [['shop', -8, 24, '🏪 နယ်စပ်ဈေး — ဝယ်/ရောင်း', 0x3ddc97],
               ['board', 8, 24, '📋 ကုန်သွယ်ရေး ဘုတ် — အလုပ်/ကုန်စည်', 0xd8324a],
               ['pos', 8, -8, '💳 ငွေလဲ ကောင်တာ (POS)', 0xf5c542]],
    npcs: [
      ['ကိုအောင်', -10, 6, 6, ['မြဝတီကို ကြိုဆိုပါတယ်။ တံတားက မောင်းသွားရင် မဲဆောက် ရောက်တယ်။',
                               'ဒီဈေးမှာ ထိုင်းပစ္စည်း အကုန် ရတယ်ဗျ။']],
      ['ဒေါ်ခင်', 9, -4, 5, ['ကုန်ကား တန်းစီနေတာ နေ့တိုင်းပါပဲ ရှင်။',
                              'ဂိတ်က မနက် ၆ နာရီ ဖွင့်တယ်။']],
      ['မောင်စိုး', -20, 24, 8, ['ကျွန်တော် ကုန်တင်ကား မောင်းတယ်။ ချင်းမိုင်အထိ သွားဖူးတယ်။']],
    ],
  },

  // ── 🛕 ဘုရားသုံးဆူ — နယ်စပ် တောင်ကြား ─────────────────────────────
  {
    id: 'three-pagodas', ambient: 'wind', title: 'ဘုရားသုံးဆူ (နယ်စပ် တောင်ကြား)',
    emoji: '🛕', ground: 130, groundColour: 0x6f7a52, light: 'day',
    background: 0xa8c8dc, terrain: 'green', seed: 89, peak: 118, hill: 20,
    blurb: 'စေတီ သုံးဆူ ယှဉ်တွဲ, နယ်စပ် မှတ်တိုင်, တောင်ကြားလမ်း',
    spawnZ: 26,
    build(r) {
      road(r.group, { x: 0, z: 0, w: 10, d: 130 });
      // 🛕 စေတီ သုံးဆူ — မြို့ရဲ့ နာမည်ရင်းမြစ်
      for (const x of [-13, 0, 13]) smallStupa(r, { x, z: -22, h: x === 0 ? 20 : 16, gold: false });
      gateArch(r, { x: 0, z: -44, w: 14, h: 8, colour: 0xcfc7b4 });
      for (let i = 0; i < 4; i++) {
        shophouse(r, { x: -14, z: 6 + i * 13, rot: Math.PI / 2, w: 8, d: 8, h: 5.5,
                       wall: 0xd8cfba, roof: 0x6b4a33, storeys: 1 });
        shophouse(r, { x: 14, z: 10 + i * 13, rot: -Math.PI / 2, w: 8, d: 8, h: 5.5,
                       wall: 0xcec4ae, roof: 0x5d5b3a, storeys: 1 });
      }
      for (const [x, z] of [[-34, -6], [34, -10], [-36, 30]]) {
        void addBuilding(r, { kind: 'stilt', position: new THREE.Vector3(x, 0, z),
                              rotation: x < 0 ? Math.PI / 2 : -Math.PI / 2,
                              hollow: { side: x < 0 ? '+x' : '-x', width: 4, step: 2.2 } });
      }
    },
    gates: [['myawaddy', 0, -42, 'မြဝတီ သို့ — နယ်စပ်လမ်း', 0xffb020],
            ['chiangmai', 0, 54, 'ချင်းမိုင် (ထိုင်း) သို့', 0x9ad3ff]],
    stations: [['quests', -8, 14, '🎯 နယ်စပ် စေတီ ဖူးမြော် — quest', 0xf5c542]],
    npcs: [
      ['ဦးဇော်', 0, 4, 5, ['စေတီ သုံးဆူက မြန်မာ–ထိုင်း နယ်နိမိတ် အမှတ်အသားပါ။',
                            'သုံးဆူလုံး လက်ယာရစ် ပတ်ကြပါ။']],
      ['မခင်သန်း', -12, 22, 6, ['ဒီမှာ တောင်ပေါ်လေ အေးတယ် ရှင်။']],
    ],
  },

  // ── 🇹🇭 ချင်းမိုင် — လန်နာ ရှေးဟောင်း မြို့ ──────────────────────
  {
    id: 'chiangmai', ambient: 'city', title: 'ချင်းမိုင် (Chiang Mai)',
    emoji: '🏯', ground: 150, groundColour: 0x7d8a5c, light: 'day',
    background: 0x9dc8dd, terrain: 'green', seed: 103, peak: 104, hill: 15,
    blurb: 'မြို့ရိုးဟောင်း, ကျုံး, လန်နာ ဘုန်းကြီးကျောင်း, ညဈေးတန်း',
    build(r) {
      // ကျုံး — မြို့ရိုးပတ်လည် ရေမြောင်း
      for (const [x, z, w, d] of [[0, -46, 108, 8], [0, 46, 108, 8],
                                  [-50, 0, 8, 92], [50, 0, 8, 92]]) {
        water(r.group, { x, z, w, d, y: -0.35, colour: 0x3d6f7a });
      }
      // မြို့ရိုး — အုတ်တံတိုင်း (ကျုံးအတွင်းဘက်)
      for (const [x, z, w, d] of [[0, -40, 100, 1.6], [0, 40, 100, 1.6],
                                  [-44, 0, 1.6, 82], [44, 0, 1.6, 82]]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 3.4, d),
          new THREE.MeshStandardMaterial({ color: 0x9c8874, roughness: 0.9 }));
        m.position.set(x, 1.7, z);
        r.group.add(m);
        m.updateMatrixWorld(true);
        r.colliders.push(new THREE.Box3().setFromObject(m));
      }
      gateArch(r, { x: 0, z: 40, w: 12, h: 8, colour: 0xa89279 });   // တံခါးပေါက်
      smallStupa(r, { x: 0, z: -18, h: 19 });                        // ဝပ် စေတီ
      for (let i = 0; i < 5; i++) {
        shophouse(r, { x: -22, z: -6 + i * 12, rot: Math.PI / 2, w: 8.5, d: 8.5, h: 6,
                       wall: 0xe6dcc6, roof: 0x8a4a2e, storeys: 2 });
        shophouse(r, { x: 22, z: -2 + i * 12, rot: -Math.PI / 2, w: 8.5, d: 8.5, h: 6,
                       wall: 0xdfd4bd, roof: 0x6f4630, storeys: 2 });
      }
      for (let i = 0; i < 7; i++) marketStall(r, { x: -6 + (i % 2) * 12, z: 8 + i * 4, colour: 0xd2762e });
    },
    gates: [['three-pagodas', 0, 44, 'ဘုရားသုံးဆူ (မြန်မာနယ်စပ်) သို့', 0x9ad3ff],
            ['bangkok', 0, -46, 'ဘန်ကောက် သို့ — အမြန်လမ်း', 0xffb020]],
    stations: [['shop', -6, 30, '🏮 ညဈေးတန်း — ဝယ်/ရောင်း', 0x3ddc97],
               ['quests', 8, -12, '🛕 ဝပ် စေတီ — quest', 0xf5c542]],
    npcs: [
      ['Somchai', -8, 16, 7, ['ยินดีต้อนรับ — ချင်းမိုင်ကို ကြိုဆိုပါတယ်။',
                              'ညဈေးတန်းက ည ၆ နာရီ စတယ်။']],
      ['Nong', 10, 4, 6, ['ဒီကျုံးက နှစ် ၇၀၀ ကျော် သက်တမ်း ရှိပြီ။']],
      ['ဦးမြင့်', -26, 30, 8, ['ကျွန်တော် မြဝတီကနေ လာရောင်းတာ။']],
    ],
  },

  // ── 🇹🇭 ဘန်ကောက် — မြို့တော် ─────────────────────────────────────
  {
    id: 'bangkok', ambient: 'city', title: 'ဘန်ကောက် (Bangkok)',
    emoji: '🌆', ground: 170, groundColour: 0x5b5f66, light: 'day',
    background: 0x9ec2d8, terrain: 'green', seed: 131, peak: 70, hill: 8,
    blurb: 'အထပ်မြင့်တိုက်များ, ချောပရာယာ မြစ်, BTS လမ်း, ဝပ် ဘုရားကျောင်း',
    build(r) {
      water(r.group, { x: -62, z: 0, w: 40, d: 170, y: -0.35, colour: 0x4a6b52 }); // မြစ်
      road(r.group, { x: 0, z: 0, w: 16, d: 170 });
      road(r.group, { x: 0, z: 0, w: 170, d: 14, rot: 0 });
      // 🏢 အထပ်မြင့် တိုက်တန်း — အောက်ထပ် lobby ဝင်လို့ရတယ်
      for (const [x, z, h] of [[-30, -50, 42], [-30, -18, 34], [-32, 20, 38],
                               [30, -44, 46], [32, -8, 30], [30, 26, 40],
                               [-30, 52, 28], [30, 58, 36]]) {
        tower(r, { x, z, w: 12, d: 12, h });
      }
      for (let i = 0; i < 4; i++) {
        shophouse(r, { x: -14, z: -60 + i * 16, rot: Math.PI / 2, w: 8, d: 8, h: 7,
                       wall: 0xd7cfc0, roof: 0x5e5a52, storeys: 3 });
        shophouse(r, { x: 14, z: -54 + i * 16, rot: -Math.PI / 2, w: 8, d: 8, h: 7,
                       wall: 0xcfc7b8, roof: 0x4f4b45, storeys: 3 });
      }
      // 🚈 BTS — မြေပေါ်လမ်း (အောက်က ဖြတ်လျှောက်လို့ရ)
      for (let z = -70; z <= 70; z += 14) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(1.4, 9, 1.4),
          new THREE.MeshStandardMaterial({ color: 0x8d939c }));
        p.position.set(46, 4.5, z); r.group.add(p);
        p.updateMatrixWorld(true);
        r.colliders.push(new THREE.Box3().setFromObject(p));
      }
      const deck = new THREE.Mesh(new THREE.BoxGeometry(6, 0.8, 150),
        new THREE.MeshStandardMaterial({ color: 0x9aa0a8 }));
      deck.position.set(46, 9.4, 0); r.group.add(deck);
      smallStupa(r, { x: -44, z: -30, h: 22 });   // ဝပ်
    },
    gates: [['chiangmai', 0, -78, 'ချင်းမိုင် သို့ — မြောက်ပိုင်း အမြန်လမ်း', 0x9ad3ff],
            ['phuket', 0, 78, 'ဖူးခက် သို့ — တောင်ပိုင်း လမ်း', 0x3ddc97]],
    stations: [['shop', -8, 22, '🏬 ဈေးဝယ်စင်တာ', 0x3ddc97],
               ['projects', 8, 22, '🏢 ရုံးခန်း — project များ', 0x7f5cff],
               ['pos', -8, -22, '💳 POS ကောင်တာ', 0xf5c542]],
    npcs: [
      ['Anan', -6, 12, 7, ['สวัสดีครับ — ဘန်ကောက်ကို ကြိုဆိုပါတယ်။',
                           'BTS နဲ့ သွားရင် မြန်တယ်၊ ကားက ပိတ်တယ်။']],
      ['Ploy', 12, -6, 6, ['ချောပရာယာ မြစ်က မြို့ကို နှစ်ခြမ်း ခွဲထားတယ်။']],
      ['ကိုသန်း', -20, 34, 8, ['ကျွန်တော် ဒီမှာ အလုပ်လုပ်တာ ၅ နှစ် ရှိပြီ။']],
    ],
  },

  // ── 🇹🇭 ဖူးခက် — ကမ်းခြေမြို့ ────────────────────────────────────
  {
    id: 'phuket', ambient: 'sea', title: 'ဖူးခက် (Phuket)',
    emoji: '🏝️', ground: 150, groundColour: 0xd9cba0, light: 'day',
    background: 0x8fd0e8, terrain: 'green', seed: 149, peak: 78, hill: 12,
    blurb: 'ကမ်းခြေ, ပင်လယ်ပြာ, ထန်းပင်, resort, longtail လှေများ',
    spawnZ: -8,
    build(r) {
      // 🌊 ပင်လယ် — မြို့ရဲ့ တစ်ဖက်ခြမ်းလုံး
      water(r.group, { x: 0, z: 58, w: 170, d: 90, y: -0.3, colour: 0x1f9bb8 });
      // ကမ်းစပ် — အဖြူရောင် သဲသောင်ပြင်
      const sand = new THREE.Mesh(new THREE.PlaneGeometry(170, 26),
        new THREE.MeshStandardMaterial({ color: 0xeadfba, roughness: 1 }));
      sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.02, 24);
      r.group.add(sand);
      road(r.group, { x: 0, z: -10, w: 150, d: 11 });
      for (let i = 0; i < 14; i++) {
        palm(r.group, -66 + i * 10, 12 + (i % 2) * 3, 0.9 + (i % 3) * 0.15, r);
      }
      for (let i = 0; i < 5; i++) {
        shophouse(r, { x: -46 + i * 23, z: -26, rot: 0, w: 10, d: 9, h: 6.5,
                       wall: 0xf0e6d2, roof: 0xc86a3a, storeys: 2 });
      }
      // Resort — အထပ်နိမ့် တိုက်တန်း
      for (const [x, z] of [[-30, -46], [0, -48], [30, -46]]) {
        tower(r, { x, z, w: 16, d: 11, h: 14, body: 0xf2ead6, glass: 0x3f7f96 });
      }
      // 🛶 longtail လှေများ — ကမ်းစပ်မှာ
      for (let i = 0; i < 4; i++) {
        const boat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 7),
          new THREE.MeshStandardMaterial({ color: [0xd8324a, 0x2de1ff, 0xf5c542, 0x3ddc97][i] }));
        boat.position.set(-30 + i * 20, 0.2, 40);
        boat.rotation.y = i * 0.3;
        r.group.add(boat);
      }
      for (let i = 0; i < 5; i++) marketStall(r, { x: -20 + i * 10, z: -2, colour: 0x2ea3c9 });
      smallStupa(r, { x: 56, z: -34, h: 15 });
      // 🛶 လှေတွေ ဖြတ်လျှောက်လို့ မရအောင် — ကမ်းစပ်မှာ ချထားတဲ့ ပစ္စည်း
      for (const b2 of r.group.children) {
        if (b2.isMesh && b2.geometry?.type === 'BoxGeometry' && b2.position.z === 40) {
          b2.updateMatrixWorld(true);
          r.colliders.push(new THREE.Box3().setFromObject(b2));
        }
      }
    },
    gates: [['bangkok', 0, -60, 'ဘန်ကောက် သို့ — မြောက်ဘက် လမ်း', 0xffb020]],
    stations: [['shop', -16, -14, '🏖️ ကမ်းခြေ ဆိုင်တန်း', 0x3ddc97],
               ['quests', 16, -14, '🏝️ ခရီးသွား လမ်းညွှန် — quest', 0xf5c542]],
    npcs: [
      ['Malee', -6, 4, 7, ['สวัสดีค่ะ — ဖူးခက် ကမ်းခြေကို ကြိုဆိုပါတယ်။',
                           'ရေက ကြည်တယ်၊ ရေကူးလို့ ရတယ်။']],
      ['Chai', 14, 16, 6, ['ကျွန်တော် longtail လှေ မောင်းတယ်။ ကျွန်းလေးတွေဆီ ခေါ်သွားပေးမယ်။']],
      ['မမြင့်', -24, -20, 7, ['ဒီမှာ မြန်မာ အလုပ်သမား အများကြီး ရှိတယ် ရှင်။']],
    ],
  },

  // ── 🇲🇲 နေပြည်တော် — မြို့တော် (လမ်းမကြီး ၂၀ လမ်း, ဥပ္ပါတသန္တိ) ──────
  //
  // user: "မြဝတီနဲ ချိတ် မဲဆောက် တောင်ကြီး နေပြည်တော် metaverse များနဲ
  //        ချိတ်ပါ"
  //
  // ★ နေပြည်တော်ရဲ့ အထင်ရှားဆုံးက **အလွန်ကျယ်တဲ့ လမ်းမကြီး**နဲ့ လူရှင်း
  //   တဲ့ ရုံးစိုက်ရာ ဇုန်။ ဒါကြောင့် အဆောက်အအုံတွေကို ဝေးဝေး ချထားပြီး
  //   အလယ်မှာ လမ်း ၄ ခု ယှဉ်ထားတယ် — မြို့ရဲ့ ခံစားချက်က အဲဒါပဲ。
  {
    id: 'naypyidaw', ambient: 'city', title: 'နေပြည်တော် (မြို့တော်)',
    emoji: '🏛️', ground: 170, groundColour: 0x7d7a68, light: 'day',
    background: 0x9fc4e0, terrain: 'green', seed: 211, peak: 88, hill: 10,
    blurb: 'လမ်းမကြီး ၂၀ လမ်း, ဥပ္ပါတသန္တိ စေတီ, ရုံးစိုက်ရာ ဇုန်, ကိုလိုနီ ဧည့်ရိပ်သာ',
    spawnZ: 22,
    build(r) {
      // 🛣️ လမ်းမကြီး — ၄ ခု ယှဉ်ထား (နေပြည်တော်ရဲ့ အမှတ်အသား)
      for (const x of [-21, -7, 7, 21]) road(r.group, { x, z: 0, w: 11, d: 170 });
      road(r.group, { x: 0, z: -56, w: 170, d: 12, rot: Math.PI / 2 });
      // 🛕 ဥပ္ပါတသန္တိ — မြို့တော်ရဲ့ စေတီ (ရွှေတိဂုံပုံစံ)
      smallStupa(r, { x: 0, z: -76, h: 34 });
      gateArch(r, { x: 0, z: -34, w: 26, h: 13, colour: 0xe8e2d0 });
      // 🏢 ရုံးစိုက်ရာ ဇုန် — ဝေးဝေး, ညီညာ (မြို့တော် ပုံစံ)
      for (const [x, z] of [[-56, -40], [-56, 0], [-56, 40], [56, -40], [56, 0], [56, 40]]) {
        tower(r, { x, z, w: 22, d: 16, h: 22, colour: 0xd8d2c0 });
      }
      // 🏛️ ကိုလိုနီ ဧည့်ရိပ်သာ — အထဲ ဝင်လို့ရ (တံခါး/ဂိတ် ပါ)
      void addKit(r, { kit: 'colonial', position: new THREE.Vector3(-40, 0, 66) });
      void addKit(r, { kit: 'colonial', position: new THREE.Vector3(40, 0, 66),
                       rotation: Math.PI });
      for (let i = 0; i < 6; i++) marketStall(r, { x: -34 + i * 14, z: 34, colour: 0xc9a24f });
      for (const [x, z] of [[-70, 70], [70, 70], [-70, -70], [70, -70]]) palm(r.group, x, z, 1.3, r);
    },
    gates: [
      { to: 'yangon', x: 0, z: 76, label: 'Cyber-Yangon သို့ — တောင်ပိုင်း အမြန်လမ်း',
        colour: 0x7f5cff, gate: 'x', arrive: [-26, 0, 0] },
      { to: 'taunggyi', x: 76, z: 0, label: 'တောင်ကြီး သို့ — ရှမ်းကုန်း လမ်း',
        colour: 0xffb020, gate: 'z', arrive: [-58, 0, 0] },
      { to: 'mandalay', x: -76, z: 0, label: '🏯 မန္တလေး သို့ — အထက်မြန်မာ လမ်း',
        colour: 0xffd479, gate: 'z', arrive: [524, 0, 540] },
    ],
    stations: [['projects', -14, 22, '🏛️ အစိုးရ ရုံး — စီမံကိန်းများ', 0x7f5cff],
               ['board', 14, 22, '🏆 နိုင်ငံတော် ဂုဏ်ပြုစာရင်း', 0xd8324a],
               ['meet', 0, 44, '🏛️ ညီလာခံ ခန်းမ', 0x3ddc97]],
    npcs: [
      ['ဦးကျော်မင်း', -10, 16, 7, ['နေပြည်တော်ကို ကြိုဆိုပါတယ်။',
                                    'ဒီလမ်းက ၂၀ လမ်း ရှိတယ် — ကားက ရှင်းတယ်။',
                                    'မြောက်ဘက်မှာ ဥပ္ပါတသန္တိ စေတီ ရှိတယ်။']],
      ['ဒေါ်နီလာ', 12, 30, 6, ['ရုံးဇုန်က အရှေ့နဲ့ အနောက် နှစ်ဖက်စလုံးမှာ။',
                                'ကိုလိုနီ ဧည့်ရိပ်သာက တောင်ဘက် — ဝင်ကြည့်လို့ရတယ်။']],
      ['ကားဆရာ ကိုလှ', -24, 40, 8, ['ရန်ကုန်ကို တောင်ဘက် ဂိတ်ကနေ, တောင်ကြီးကို အရှေ့ဘက်။']],
    ],
  },

  // ── 🇲🇲 တောင်ကြီး — ရှမ်းပြည် တောင်ပေါ်မြို့ ────────────────────────
  //
  // ★ တောင်ကြီးက **တောင်ပေါ်မြို့** — `peak` ကို မြင့်မြင့် (၁၄၀) ထားပြီး
  //   ကွင်းပြင်ကို သေးသေး (၁၃၀) ထားတော့ မြို့က ချိုင့်ဝှမ်းထဲမှာ ဝိုင်းရံ
  //   ခံထားရသလို ဖြစ်တယ် — တကယ့် တောင်ကြီးလိုပဲ。
  {
    id: 'taunggyi', ambient: 'wind', title: 'တောင်ကြီး (ရှမ်းပြည်နယ်)',
    emoji: '🎈', ground: 130, groundColour: 0x6f6a52, light: 'day',
    background: 0x8fb8dc, terrain: 'green', seed: 233, peak: 140, hill: 18,
    blurb: 'တောင်ပေါ်မြို့, မီးပုံးပျံပွဲ, ရှမ်းဈေး, ရွှေဖုန်းတော် စေတီ',
    spawnZ: 18,
    build(r) {
      road(r.group, { x: 0, z: 0, w: 13, d: 130 });
      road(r.group, { x: 0, z: 0, w: 130, d: 12, rot: Math.PI / 2 });
      // 🛕 ရွှေဖုန်းတော် ပုံစံ စေတီ — တောင်ကုန်းပေါ်
      smallStupa(r, { x: -46, z: -46, h: 26 });
      // 🏪 ရှမ်းဈေး — လမ်းနှစ်ဖက်
      for (let i = 0; i < 5; i++) {
        shophouse(r, { x: -18, z: -28 + i * 15, rot: Math.PI / 2, w: 9, d: 9, h: 7,
                       wall: 0xe2d8c0, roof: 0x8a4a3c, storeys: 2 });
        shophouse(r, { x: 18, z: -22 + i * 15, rot: -Math.PI / 2, w: 9, d: 9, h: 7,
                       wall: 0xd6ccb4, roof: 0x6f4a2f, storeys: 2 });
      }
      for (let i = 0; i < 6; i++) marketStall(r, { x: -6, z: -30 + i * 12, colour: 0xd06a3a });
      // 🏛️ ကိုလိုနီ အိမ် — တောင်ကြီးမှာ ကိုလိုနီခေတ် အိမ်တွေ အများကြီး ရှိတယ်
      void addKit(r, { kit: 'colonial', position: new THREE.Vector3(-52, 0, 30) });
      // 🎈 မီးပုံးပျံ — တောင်ကြီးရဲ့ အထင်ရှားဆုံး ပွဲတော်
      for (const [x, y, z, col] of [[-30, 46, 26, 0xd8324a], [26, 58, -14, 0xf5c542],
                                    [8, 68, 40, 0x3ddc97], [-44, 52, -20, 0x8ecbff]]) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(6, 12, 10),
          new THREE.MeshStandardMaterial({ color: col, emissive: col,
                                           emissiveIntensity: 0.5, roughness: 0.6 }));
        b.position.set(x, y, z); b.scale.y = 1.25; r.group.add(b);
        const basket = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 2),
          new THREE.MeshStandardMaterial({ color: 0x6b5a44, roughness: 0.95 }));
        basket.position.set(x, y - 9, z); r.group.add(basket);
      }
      for (const [x, z] of [[-60, 60], [60, 60], [-60, -60], [60, -60]]) palm(r.group, x, z, 1.1, r);
    },
    gates: [
      { to: 'naypyidaw', x: -64, z: 0, label: 'နေပြည်တော် သို့ — တောင်ပေါ် လမ်း',
        colour: 0x7f5cff, gate: 'z', arrive: [58, 0, 0] },
      { to: 'maesot', x: 0, z: 64, label: 'မဲဆောက် သို့ — တောင်ပိုင်း လမ်း',
        colour: 0xffb020, gate: 'x', arrive: [-12, 0, 14] },
      { to: 'myawaddy', x: 64, z: 0, label: 'မြဝတီ သို့ — အရှေ့ဘက် လမ်း',
        colour: 0x9ad3ff, gate: 'z', arrive: [8, 0, 8] },
      { to: 'mandalay', x: 0, z: -64, label: '🏯 မန္တလေး သို့ — မြောက်ဘက် လမ်း',
        colour: 0xffd479, gate: 'x', arrive: [0, 0, 580] },
    ],
    stations: [['shop', -10, 26, '🧺 ရှမ်းဈေး — ပစ္စည်း ဝယ်/ရောင်း', 0x3ddc97],
               ['quests', 10, 26, '🎈 မီးပုံးပျံ ပွဲတော် — quest', 0xf5c542]],
    npcs: [
      ['ဆရာမ နန်းခမ်း', -8, 12, 7, ['မိုင်းလုံးခမ်းဗျာ — တောင်ကြီးကို ကြိုဆိုပါတယ်။',
                                     'တောင်ပေါ်မို့ အေးတယ်၊ ညဆို ပိုအေးတယ်။',
                                     'မီးပုံးပျံပွဲက တန်ဆောင်တိုင်မှာ။']],
      ['ဦးစိုင်းလုံ', 14, -8, 6, ['ရှမ်းခေါက်ဆွဲ စားပြီးပြီလား?',
                                  'ဈေးက လမ်းရဲ့ နှစ်ဖက်လုံးမှာ ရှိတယ်။']],
      ['မီးပုံးပျံ ဆရာ ကိုအောင်', -26, 34, 8, ['မီးပုံးပျံ ဆောက်တာ ရက် ၂၀ ကြာတယ်။',
                                                'အပေါ်ကို ကြည့်လိုက် — ပျံနေတာ မြင်ရမယ်။']],
    ],
  },
];


/// အခန်း အားလုံး တစ်ခါတည်း ဆောက်ဖို့
export function createCityRooms() {
  return CITY_SPECS.map((s) => new CityRoom(s));
}

/// 🚪 RoomCatalog မှာ ပြဖို့ — id/နာမည်/ရှင်းလင်းချက်
export const CITY_ENTRIES = CITY_SPECS.map((s) => ({
  kind: 'world', id: s.id, emoji: s.emoji, name: s.title, blurb: s.blurb,
}));
