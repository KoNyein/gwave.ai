// ============================================================
// YangonRoom.js — "Cyber-Yangon" ညဈေးတန်း Room
// မြန်မာ့မြို့ပြ + Sci-fi neon ပေါင်းစပ်ထားသော ပင်မ Room
// ============================================================
import * as THREE from 'three';
import {Room, addRoomLighting } from '../Room.js';
import { addTerrain } from '../Terrain.js';
import { addBuilding, buildPagoda } from '../Buildings.js';
import { NPC } from '../../entities/NPC.js';

export class YangonRoom extends Room {
  constructor() { super('yangon', 'Cyber-Yangon City (ပင်မမြို့တော်)'); }

  // 📰 Open Wall — Feed post များကို ကမ္ဘာထဲ 3D နံရံပေါ်တင်ပြသည်
  buildFeedWall(position) {
    this.feedCanvas = document.createElement('canvas');
    this.feedCanvas.width = 1024; this.feedCanvas.height = 512;
    this.feedTexture = new THREE.CanvasTexture(this.feedCanvas);
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 8),
      new THREE.MeshBasicMaterial({ map: this.feedTexture, transparent: true })
    );
    wall.position.copy(position);
    wall.rotation.y = Math.PI / 6;
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(16.6, 8.6, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x141b30, metalness: 0.7, roughness: 0.3 })
    );
    frame.position.copy(position); frame.position.z -= 0.2;
    frame.rotation.y = Math.PI / 6;
    this.group.add(frame, wall);
    this.setFeedWallPosts([{ who: 'GWAVE', text: 'Open Wall — feed ကို ဒီနံရံပေါ်မှာ တိုက်ရိုက်မြင်ရမည်…' }]);
  }

  setFeedWallPosts(posts) {
    if (!this.feedCanvas) return;
    const ctx = this.feedCanvas.getContext('2d');
    ctx.clearRect(0, 0, 1024, 512);
    ctx.fillStyle = 'rgba(6,9,19,.85)'; ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = '#f5c542';
    ctx.font = 'bold 44px Padauk, sans-serif';
    ctx.fillText('📰 GWAVE OPEN WALL', 34, 66);
    ctx.strokeStyle = '#f5c542'; ctx.globalAlpha = .5;
    ctx.beginPath(); ctx.moveTo(34, 86); ctx.lineTo(990, 86); ctx.stroke();
    ctx.globalAlpha = 1;
    let y = 150;
    for (const post of (posts || []).slice(0, 3)) {
      ctx.fillStyle = '#3ddc97'; ctx.font = 'bold 32px Padauk, sans-serif';
      ctx.fillText(post.who, 34, y);
      ctx.fillStyle = '#eaf0ff'; ctx.font = '30px Padauk, sans-serif';
      const text = post.text.length > 52 ? post.text.slice(0, 52) + '…' : post.text;
      ctx.fillText(text, 34, y + 44);
      y += 120;
    }
    this.feedTexture.needsUpdate = true;
  }

  build() {
    // မြေပြင် — မိုးရွာပြီးစ လမ်းမ အနက်ရောင်
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 140),
      new THREE.MeshStandardMaterial({ color: 0x1a2238, roughness: 0.45, metalness: 0.25 })
    );
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    this.group.add(ground);
    this.group.add(new THREE.GridHelper(140, 70, 0x39508c, 0x22304f));

    // အလင်းရောင် — ညအလင်း + neon
    //
    // ★ အရင်က ambient 0.35 + moon 0.6 ပဲ ရှိလို့ မြို့တစ်ခုလုံး မဲနေတယ်
    //   (user: "Cyber-Yangon room က အရမ်း မှောင်လွန်းတယ်")。 Hemisphere က
    //   ကောင်းကင်/မြေ နှစ်ဘက်ကနေ အလင်းပြန်ပေးလို့ ညအလင်းကို မဖျက်ဘဲ
    //   ပုံသဏ္ဌာန်တွေ မြင်ရစေတယ် — flat ambient ကို တင်လိုက်တာထက် ပိုကောင်း။
    addRoomLighting(this, 'night');

    // 🏔️ ပတ်ဝန်းကျင် — ညမြို့တော်ကို ဝိုင်းထားတဲ့ တောင်တန်း
    //    (user: "environment ကို ပြေပြင်အစစ် တောင်ကုန်း တောင်တန်း ထည့်ပါ")
    addTerrain(this, {
      ground: 140, palette: 'night', seed: 11, peak: 100, hill: 12,
      // 🛕 စေတီတော် တည်ရာ — တောင်တန်းက အထဲကနေ ထိုးမထွက်အောင် ပြားထားတယ်
      flatSpots: [{ x: 0, z: -250, r: 140, blend: 70 }],
    });
    // ★ လမ်းမီး — ကစားသမား လမ်းလျှောက်ရာ လမ်းကြောင်းကို ချထားတယ်၊
    //   ဒါမှ ခြေထောက်နဲ့ မြေပြင် တကယ် မြင်ရတယ်။
    for (let i = -1; i <= 3; i++) {
      const lamp = new THREE.PointLight(0xffd9a0, 26, 34, 2);
      lamp.position.set(0, 7, i * -18 + 10);
      this.group.add(lamp);
    }

    // 🛕 စေတီ (landmark) — မြို့တစ်မြို့လုံးက မြင်ရတဲ့ ရွှေရောင် ထစ်ခွင်စေတီ
    //    (အရင်က ဆလင်ဒါ + ကွန်း နှစ်ခုပဲ — အခု ထစ်ခွင် ၄ ဆင့်, ခေါင်းလောင်း,
    //     ငှက်မြတ်နာ, ထီးတော်, ထိပ်ဖျား စိန်။ ဖိုင် တစ်ခုမှ မဆွဲဘူး။)
    const pagoda = buildPagoda({ position: new THREE.Vector3(0, 0, -45) });
    this.group.add(pagoda);
    // စေတီ ရင်ပြင် — ဖြတ်မထွက်နိုင် (အောက်ခြေ အကျယ် ၁၄m)
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(-11.5, 0, -56.5), new THREE.Vector3(11.5, 26, -33.5),
    ));

    // 🛕 ရွှေတိဂုံ စေတီတော် — မြို့ရဲ့ မြောက်ဘက် တောင်ကုန်းပေါ်
    //
    // ★ ၂၆၄m ကျယ်လို့ ကစားကွင်း (၁၄၀m) ထဲ မဆံ့ဘူး — ဒါကြောင့် ကွင်းပြင်
    //   ပြင်ပ ၂၅၀m အကွာမှာ ချထားတယ်။ ရန်ကုန်မြို့လယ်ကနေ ရွှေတိဂုံကို
    //   မော့ကြည့်ရသလိုပဲ။ collider မထည့်ဘူး — နယ်နိမိတ်နံရံက ကာထားပြီးသား
    //   ဖြစ်လို့ ဘယ်တော့မှ မရောက်နိုင်ဘူး၊ box ပိုစစ်စရာ မလိုဘူး။
    void addBuilding(this, {
      kind: 'stupa', position: new THREE.Vector3(0, 0, -250),
      rotation: Math.PI * 0.12, collide: false,
    });

    // 🏛️🛖 အဆောက်အအုံ အစစ် — မြို့လယ်ရဲ့ နှစ်ဖက်စွန်း
    //
    // ★ Async — GLB ရောက်မှ ထည့်တယ်၊ အခန်း ဆောက်တာကို မစောင့်ဘူး။
    //   ကစားသမားက အလယ် (0,0,6) မှာ စတာမို့ အဆောက်အအုံတွေက အနားမှာ
    //   မဟုတ်ဘဲ လမ်းအစွန်းမှာ — ဝင်ဝင်ချင်း တိုးမိမှာ မဟုတ်ဘူး။
    void addBuilding(this, {                    // ကိုလိုနီ သုံးထပ်တိုက်
      kind: 'colonial', position: new THREE.Vector3(-42, 0, -18),
      rotation: Math.PI / 2,
    });
    void addBuilding(this, {                    // 🏠 ကိုယ့်အိမ် — ထင်းအိမ်
      kind: 'stilt', position: new THREE.Vector3(42, 0, -16),
      rotation: -Math.PI / 2,
    });
    void addBuilding(this, {                    // ရပ်ကွက်ထဲက နောက်တစ်လုံး
      kind: 'stilt', position: new THREE.Vector3(46, 0, 16),
      rotation: -Math.PI / 2.4,
    });

    // 🧍‍♀️ စေတီ ရင်ပြင်က ကြိုဆိုသူ — မြန်မာဝတ်စုံ (အင်္ကျီ + ထဘီ, သနပ်ခါး)
    //
    // ★ ဒီရုပ်မှာ **အရိုး မပါဘူး** (bone ၀, animation ၀) — ဒါကြောင့်
    //   `staticBody` အဖြစ် ရပ်နေတဲ့ ဇာတ်ကောင် လုပ်ထားတယ်၊ လျှောက်ခိုင်းရင်
    //   မြေပြင်ပေါ် လျှောသွားနေမယ်။ ကစားသမား avatar အဖြစ်လည်း မသုံးနိုင်ဘူး
    //   (အဲဒါက "avatar တွေ ခြေမလှမ်းဘူး" ဆိုတဲ့ ပြဿနာကို ပြန်ဖန်တီးမယ်)。
    this.addNPC(new NPC({
      name: 'မသီတာ',
      staticBody: '/world/assets/myanmar_woman.glb',
      home: new THREE.Vector3(-7, 0, -30),
      faceYaw: Math.PI * 0.15,
      dialogue: [
        'မင်္ဂလာပါ ရှင် 🙏 ရွှေတိဂုံ ရင်ပြင်ကို ကြိုဆိုပါတယ်။',
        'စေတီကို လက်ယာရစ် လှည့်ပြီး ဆုတောင်းကြပါတယ်။',
        'အရှေ့ဘက်မှာ ကျွန်မတို့ရဲ့ ထင်းအိမ် ရှိပါတယ် — ဝင်ကြည့်လို့ရပါတယ်။',
      ],
    }));

    const pagodaGlow = new THREE.PointLight(0xffcc44, 60, 60);
    pagodaGlow.position.set(0, 14, -45);
    this.group.add(pagodaGlow);

    // ဆိုင်ခန်း/တိုက်တာများ — neon ပြတင်းပေါက်များနှင့်
    const neonColors = [0xff2d78, 0x2de1ff, 0x7f5cff, 0x3ddc97, 0xffb020];
    for (let i = 0; i < 26; i++) {
      const w = 3 + Math.random() * 4, h = 5 + Math.random() * 14, d = 3 + Math.random() * 4;
      const bld = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: 0x232d4a, roughness: 0.75 })
      );
      const side = i % 2 === 0 ? -1 : 1;
      bld.position.set(side * (9 + Math.random() * 22), h / 2, -40 + (i * 3.2));
      // 🛕 စေတီ ရင်ပြင်ထဲ တိုက်တာ မဝင်ရ — ရင်ပြင်က ၁၄m အချင်းဝက် ရှိပြီး
      //    တိုက်တွေက z ≈ -၄၀ ကနေ စလို့ ပထမ တစ်ချို့က ရင်ပြင်ထဲ ဝင်နေတယ်
      //    (collider ထပ်ပြီး စေတီထဲ တိုက်ခံရသလို ဖြစ်တယ်)。
      // ★ ရွှေ့မယ့်အစား **ချန်ထားတယ်** — ရွှေ့လိုက်ရင် တခြားတိုက်တွေနဲ့
      //   သွားထပ်တယ် (တိုင်းတာပြီး တွေ့ခဲ့တာ)。 ရင်ပြင်က ဟင်းလင်း ဖြစ်ရမယ်။
      if (Math.hypot(bld.position.x, bld.position.z + 45) < 20) continue;
      bld.castShadow = true;
      this.group.add(bld);
      this.addCollider(bld); // အဆောက်အအုံတိုင်း collision ပါ

      // neon ဆိုင်းဘုတ်
      const neon = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.7, 0.5, 0.2),
        new THREE.MeshBasicMaterial({ color: neonColors[i % neonColors.length] })
      );
      neon.position.set(bld.position.x, h * 0.7, bld.position.z + d / 2 + 0.15);
      this.group.add(neon);
    }

    // NPC များ — မြန်မာအသိုင်းအဝိုင်း
    this.addNPC(new NPC({
      name: 'ဦးလှ', color: 0xffb020,
      home: new THREE.Vector3(5, 0, -6), range: 7,
      dialogue: [
        'မင်္ဂလာပါ! Gwave Metaverse မှ ကြိုဆိုပါတယ်။',
        'ဒီနေရာက Cyber-Yangon ညဈေးတန်းပါ။',
        'ခရမ်းရောင်တိုင်ကို E နှိပ်ရင် Hydro-Lab ကိုရောက်မယ်။',
        'Wallet ချိတ်ထားရင် နောက်ပိုင်း ဆုတွေရနိုင်မယ်နော်!',
        'လိမ္မော်ရောင်တိုင်က မဲဆောက်၊ အနီရောင်တိုင်က STRIKE Arena!',
        'မြို့ထဲက ရောင်စုံ kiosk လေးတွေမှာ E နှိပ်ကြည့် — function တွေ အကုန်ရှိတယ်။',
      ],
    }));
    this.addNPC(new NPC({
      name: 'မစန်း', color: 0xff2d78,
      home: new THREE.Vector3(-7, 0, -12), range: 6,
      dialogue: [
        'မုန့်ဟင်းခါး စားသွားဦးလေ!',
        'ဒီဈေးတန်းက ညဘက်ဆို လူစည်တယ်။',
        'Three.js နဲ့ဆောက်ထားတာ သိလား? 😄',
      ],
    }));

    // Portal → Hydro-Lab
    this.addPortal({
      position: new THREE.Vector3(12, 0, -20),
      targetRoomId: 'farm',
      label: 'Hydro-Lab (စိုက်ပျိုးရေး Lab) သို့',
      color: 0x7f5cff,
    });

    // Portal → မဲဆောက် (GLB map pipeline)
    this.addPortal({
      position: new THREE.Vector3(-12, 0, -20),
      targetRoomId: 'maesot',
      label: 'မဲဆောက် နယ်စပ်လမ်းသို့',
      color: 0xffb020,
    });

    // ============ 🏙️ City Districts — Function Stations ============
    // Creator District (အနောက်ဘက်) — 🧬 Avatar Studio (3D scanner + presets)
    this.addStation({
      position: new THREE.Vector3(-8, 0, 2),
      label: '🧬 Avatar Studio — ကိုယ်ပိုင် avatar ဖန်တီး/3D scan ချိတ်',
      action: 'avatar', color: 0x3ddc97,
    });
    // Market District (အရှေ့ဘက်) — 🛍️ Marketplace + ☕ POS
    this.addStation({
      position: new THREE.Vector3(8, 0, 2),
      label: '🛍️ Marketplace — skin/item ဝယ်ရန် (GP)',
      action: 'shop', color: 0xf5c542,
    });
    this.addStation({
      position: new THREE.Vector3(11, 0, -4),
      label: '☕ Gwave Rooftop POS — GP ဖြင့် ကော်ဖီ/ဆုလဲရန်',
      action: 'pos', color: 0xffb020,
    });
    // Civic Plaza — 🏆 Leaderboard + 🎯 Quest Board + 📁 Projects
    this.addStation({
      position: new THREE.Vector3(-4, 0, -8),
      label: '🏆 Hall of Fame — season leaderboard',
      action: 'board', color: 0xd8324a,
    });
    this.addStation({
      position: new THREE.Vector3(4, 0, -8),
      label: '🎯 Quest Board — နေ့စဉ်တာဝန်များ',
      action: 'quests', color: 0x7f5cff,
    });
    this.addStation({
      position: new THREE.Vector3(-11, 0, -4),
      label: '📁 Gwave Projects — platform စီမံကိန်းများ',
      action: 'projects', color: 0x2de1ff,
    });

    // Civic Plaza — 🏛️ Meeting Hall kiosk
    this.addStation({
      position: new THREE.Vector3(0, 0, -12),
      label: '🏛️ Meeting Hall — အစည်းအဝေးခန်းမ ဖန်တီး/ဝင်ရန်',
      action: 'meet', color: 0x3ddc97,
    });

    // 📰 Open Wall — ဈေးတန်းဘေး feed နံရံကြီး
    this.buildFeedWall(new THREE.Vector3(-16, 4.5, -14));
    this.addStation({
      position: new THREE.Vector3(-14, 0, -10),
      label: '📰 Open Wall — feed ဖတ်/တင်ရန်',
      action: 'feed', color: 0x8ecbff,
    });

    // Portal → ကိုယ်ပိုင် Metaverse ကမ္ဘာ (create/edit)
    // 🏠 အိမ် — ထင်းအိမ် ရှေ့မှာ တံခါး။ ကိုယ့်ကမ္ဘာ (Build Mode) ကို ဖွင့်တယ်
    this.addPortal({
      position: new THREE.Vector3(30, 0, -16),
      targetRoomId: 'myworld',
      label: '🏠 ကိုယ့်အိမ် — ကိုယ်ပိုင်ကမ္ဘာသို့ ဝင်ရန်',
      color: 0xf5c542,
    });

    this.addPortal({
      position: new THREE.Vector3(12, 0, 8),
      targetRoomId: 'myworld',
      label: '🌍 ကိုယ်ပိုင်ကမ္ဘာသို့ (Build Mode ပါ)',
      color: 0x3ddc97,
    });

    // Portal → GWAVE STRIKE Arena (FPS)
    this.addPortal({
      position: new THREE.Vector3(0, 0, 16),
      targetRoomId: 'strike',
      label: 'GWAVE STRIKE Arena သို့ (⚔️ FPS)',
      color: 0xd8324a,
    });

    this.spawn.set(0, 0, 8);
  }
}
