// ============================================================
// YangonRoom.js — "Cyber-Yangon" ညဈေးတန်း Room
// မြန်မာ့မြို့ပြ + Sci-fi neon ပေါင်းစပ်ထားသော ပင်မ Room
// ============================================================
import * as THREE from 'three';
import {Room, addRoomLighting } from '../Room.js';
import { addTerrain } from '../Terrain.js';
import { addManor, addKit, manorSpot } from '../Kit.js';
import { addBuilding, buildPagoda, pagodaColliders, stupaColliders } from '../Buildings.js';
import { NPC } from '../../entities/NPC.js';
import { roadGrid, roadPath, trafficLight, streetLamps, grassField, treeRow, lake,
         fillerBlocks, busLine } from '../Traffic.js';
import { shophouse, tower, smallStupa, marketStall, palm } from '../CityKit.js';
import { trackQuality } from '../../core/Quality.js';

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
    // ★ ဒီ ၁၆.၆ × ၈.၆ နံရံကြီးက collider လုံးဝ မရှိခဲ့ဘူး — အလယ်မှာ
    //   ရပ်ကြည့်တော့ တွန်းအား ၀.၀၀ m。 ဖြတ်လျှောက်လို့ ရနေတယ်။
    //   (မျဉ်းဖြောင့် ပြေးစမ်းသပ်မှုကမှ တွေ့တာ — အနီးက ခုံတစ်ခုရဲ့ collider
    //    က AABB နဲ့ ထပ်နေလို့ "ဖုံးထားပြီး" လို့ ထင်ခဲ့တယ်)。
    frame.updateMatrixWorld(true);
    const fbox = new THREE.Box3().setFromObject(frame);
    fbox.min.y = 0;
    this.colliders.push(fbox);
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
    // ★ ၁၄၀ → ၆၂၀ (မျဉ်းကြောင်း ၄.၄ ဆ, ဧရိယာ ~၂၀ ဆ) — user: "မြို့ကို
    //   ၅ဆ ခန့် ချဲ့ပါ"。 GridHelper ကို ဖယ်လိုက်တယ်: ၆၂၀ အကျယ်မှာ
    //   ကွက်မျဉ်း ဆွဲရင် မျဉ်း ထောင်ချီ ဖြစ်ပြီး z-fight ပါ ဖြစ်တယ် —
    //   အစားထိုးက **တကယ့် ကားလမ်းကွက်** (roadGrid) ဖြစ်တယ်။
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(620, 620),
      new THREE.MeshStandardMaterial({ color: 0x1a2238, roughness: 0.45, metalness: 0.25 })
    );
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    this.group.add(ground);

    // အလင်းရောင် — ညအလင်း + neon
    //
    // ★ အရင်က ambient 0.35 + moon 0.6 ပဲ ရှိလို့ မြို့တစ်ခုလုံး မဲနေတယ်
    //   (user: "Cyber-Yangon room က အရမ်း မှောင်လွန်းတယ်")。 Hemisphere က
    //   ကောင်းကင်/မြေ နှစ်ဘက်ကနေ အလင်းပြန်ပေးလို့ ညအလင်းကို မဖျက်ဘဲ
    //   ပုံသဏ္ဌာန်တွေ မြင်ရစေတယ် — flat ambient ကို တင်လိုက်တာထက် ပိုကောင်း။
    addRoomLighting(this, 'night');
    this.ambient = 'city';   // 🎧 မြို့ ဟိန်းသံ

    // 🏔️ ပတ်ဝန်းကျင် — ညမြို့တော်ကို ဝိုင်းထားတဲ့ တောင်တန်း
    //    (user: "environment ကို ပြေပြင်အစစ် တောင်ကုန်း တောင်တန်း ထည့်ပါ")
    // 🏛️ အိမ်တော် ခြံဝန်း — မြို့ အပြင်ဘက်၊ မြေပြားပေါ်
    // ★ မြို့က ၆၂၀ ကျယ်သွားလို့ တောင်တန်းကို ပြင်ပ ဆီ တွန်းထုတ်ရတယ် —
    //   `extent` ၇၆၀ အတိုင်း ထားရင် မြို့က တောင်ကို ကျော်ထွက်သွားပြီး
    //   နယ်နိမိတ် နံရံက မြို့ထဲမှာ ဖြစ်နေမယ် (မြို့စွန်း မရောက်ခင် တားခံရမယ်)。
    //   ၁၂၀၀ ဆိုရင် ပြားတဲ့ အလယ်က ၃၆၁ m အထိ, တောင်တန်းက ၃၆၁–၆၀၀ ကြားမှာ。
    const manor = manorSpot(500);
    addTerrain(this, {
      ground: 500, extent: 1200, palette: 'night', seed: 11, peak: 120, hill: 14,
      // 🛕 စေတီတော် တည်ရာ — တောင်တန်းက အထဲကနေ ထိုးမထွက်အောင် ပြားထားတယ်
      flatSpots: [{ x: 0, z: -250, r: 140, blend: 70 }, manor.flatSpot],
    });
    void addManor(this, { position: manor.position, rotation: manor.rotation });
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
    // 🛕 စေတီ ရင်ပြင် — **ပေါ်တက်လို့ရတယ်** (လှေကား ၃ ထစ် + ကြမ်းပြင်)
    pagodaColliders(this, new THREE.Vector3(0, 0, -45));

    // 🛕 ရွှေတိဂုံ စေတီတော် အစုအဝေး — **ပြန်ရောက်လာပြီ, ခုတော့ သွားလို့ရတယ်**
    //
    // user: "ရန်ကုန်မှာ ရအောင် ထည့်ပါ"
    //
    // PR #574 မှာ ဒါကို ဖယ်ခဲ့တယ် — ကွင်းပြင် အပြင် ၂၅၀ m မှာ ရှိပြီး
    // နယ်နိမိတ်နံရံက မြို့အနားမှာ ကာထားလို့ **ဘယ်တော့မှ မရောက်နိုင်**
    // ခဲ့လို့။ PR #576 မှာ terrain ကို လျှောက်လို့ရအောင် လုပ်ပြီး နံရံကို
    // terrain အစွန်း (၃၇၄ m) ဆီ ရွှေ့လိုက်တော့ အဲဒီ အကြောင်းပြချက်
    // မရှိတော့ဘူး — အခု မြို့ကနေ လျှောက်/မောင်း သွားလို့ ရပြီ။
    //
    // ★ `heavy` tier — ၁၅၅,၈၄၄ တြိဂံ ဆိုတာ ကြီးတယ်။ ဂရပ်ဖစ် အလယ်/အနိမ့်
    //   မှာ ဖျောက်တယ် (အဝေးက landmark ဖြစ်လို့ အဲဒါ မှန်တယ်)。
    void addBuilding(this, {
      kind: 'stupa', position: new THREE.Vector3(0, 0, -250), tier: 'heavy',
      collide: false,          // collider ကို stupaColliders က သီးသန့် ဆောက်
    }).then((obj) => {
      if (obj) stupaColliders(this, obj, { position: new THREE.Vector3(0, 0, -250), stairX: 30 });
    });

    // 🏛️🛖 အဆောက်အအုံ အစစ် — မြို့လယ်ရဲ့ နှစ်ဖက်စွန်း
    //
    // ★ Async — GLB ရောက်မှ ထည့်တယ်၊ အခန်း ဆောက်တာကို မစောင့်ဘူး။
    //   ကစားသမားက အလယ် (0,0,6) မှာ စတာမို့ အဆောက်အအုံတွေက အနားမှာ
    //   မဟုတ်ဘဲ လမ်းအစွန်းမှာ — ဝင်ဝင်ချင်း တိုးမိမှာ မဟုတ်ဘူး။
    // ★ x ≥ ၄၈ — neon တိုက်တွေက |x| ၃၄ အထိ ရောက်တယ် (ဗဟို ၃၁ + အကျယ်
    //   တစ်ဝက်)。 ၄၂ မှာ ထားတော့ တိုက်တစ်လုံးနဲ့ ၂.၃×၁.၄ ထပ်နေတယ်
    //   (တိုင်းတာပြီး တွေ့ခဲ့)。 အိမ်က ၂၀m ကျယ်လို့ ဗဟို ၄၈ ဆို min.x = ၃၈။
    void addBuilding(this, {                    // 🏠 ကိုယ့်အိမ် — ထင်းအိမ်
      kind: 'stilt', position: new THREE.Vector3(48, 0, -16),
      rotation: -Math.PI / 2,
      hollow: { side: '-x', width: 4, step: 2.2 },   // ခြေတံရှည် — လှေကား ပါ
    });
    void addBuilding(this, {                    // ရပ်ကွက်ထဲက နောက်တစ်လုံး
      kind: 'stilt', position: new THREE.Vector3(50, 0, 18),
      rotation: -Math.PI / 2,
      hollow: { side: '-x', width: 4, step: 2.2 },
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

    // 🧍 စေတီ ရင်ပြင်က ဂေါပက — မြန်မာအမျိုးသား ရုပ် (ဂေါင်းပေါင်း,
    //    တိုက်ပုံ, ပုဆိုး)。 မသီတာနဲ့ အတူ ရင်ပြင်မှာ တွဲရပ်တယ်။
    //
    // ★ ဒီရုပ်မှာလည်း **အရိုး မပါဘူး** — registry က `"rigged": true` နဲ့
    //   motion ၇ မျိုး ဆိုပေမယ့် export ထဲမှာ skin ၀, animation ၀ ပဲ
    //   ပါလာတယ် (ဖတ်စစ်ပြီး)。 ဒါကြောင့် ရပ်နေတဲ့ ဇာတ်ကောင်ပဲ ဖြစ်တယ်။
    this.addNPC(new NPC({
      name: 'ဦးဘသိန်း',
      staticBody: '/world/assets/myanmar_man.glb',
      home: new THREE.Vector3(-13, 0, -28),
      faceYaw: -Math.PI * 0.1,
      dialogue: [
        'မင်္ဂလာပါ ကွယ် — ဒီစေတီက ဒီမြို့ရဲ့ အသည်းနှလုံးပါပဲ။',
        'ကျွန်တော်က ဂေါပက အဖွဲ့ဝင် — လှေကားထစ်တွေက တောင်ဘက်မှာ ရှိတယ်။',
        'အနောက်ဘက် ဂိတ်ကနေ မဲဆောက်ကို သွားလို့ရတယ်နော်။',
      ],
    }));

    // 🛻 ကားများ — လမ်းဘေး ရပ်ထားတဲ့ ပစ်ကပ်များ (အရောင်စုံ)
    //
    // ★ ဖိုင် တစ်ခုတည်းကနေ အရောင် ၆ မျိုး — `paint` က body material ကိုပဲ
    //   clone လုပ်ပြီး အရောင် ပြောင်းတယ် (တစ်လုံးတည်း ဆွဲရုံ, ၂,၇၂၄ တြိဂံ)。
    // ★ လမ်းအလယ် မဟုတ်ဘဲ ဘေးမှာ — ကစားသမား လမ်းလျှောက်ရာကို မပိတ်စေရ။
    // ★ z ≥ ၄၆ မှာသာ — neon တိုက်တွေက z ၄၀ အထိ ရှိပြီး x ၉–၃၁ ကြားမှာ
    //   ကျပန်း ချထားလို့ အဲဒီအထဲ ကား ထားရင် တိုက်ထဲ ဝင်နေတယ်
    //   (တိုင်းတာပြီး တွေ့ခဲ့တာ — ကား တစ်စီး တိုက်နဲ့ ၄.၁×၁.၀ ထပ်နေတယ်)。
    for (const [x, z, rot, col] of [
      [-20, 48, 0, 0xd8324a], [-20, 58, 0, 0x2de1ff], [-10, 48, 0, 0xf5c542],
      [12, 50, Math.PI, 0x3ddc97], [21, 48, Math.PI, 0xe8eef5], [21, 58, Math.PI, 0x7f5cff],
    ]) {
      void addBuilding(this, {
        kind: 'pickup', position: new THREE.Vector3(x, 0, z), rotation: rot,
        paint: { name: 'MAT_Body_Paint', color: col },
      });
    }

    const pagodaGlow = new THREE.PointLight(0xffcc44, 60, 60);
    pagodaGlow.position.set(0, 14, -45);
    this.group.add(pagodaGlow);

    // 🏙️ လမ်းဘေး အဆောက်အအုံများ — **အစစ်ချည်းပဲ**
    //
    // user: "Cyber-Yangon ထဲက သုံးမရတဲ့ အတွင်းသွားလို့မရတဲ့ တိုက်တွေ
    //        အကုန် ဖယ်ပါ"
    //
    // အရင်က ဒီနေရာမှာ `BoxGeometry` သေတ္တာ ၂၆ လုံး ရှိတယ် — neon
    // ဆိုင်းဘုတ် ကပ်ထားပေမယ့် တံခါး မရှိ, ပြတင်းပေါက် မရှိ, အထဲ ဝင်လို့
    // မရဘူး၊ အနီးရောက်လေ တုံးလို ဖြစ်လေပဲ။ **အားလုံး ဖယ်လိုက်ပြီ**
    // (သေတ္တာ ၂၆ + ဆိုင်းဘုတ် ၂၆ = mesh ၅၂, collider ၂၆)。
    //
    // အစားထိုး — မော်ဒယ် အစစ် ၅ လုံး ထပ်ချတယ်။ တံခါး, ပြတင်းပေါက်,
    // ဝရံတာ, အမိုးအားလုံး ပါတယ်။
    //
    // ★ နေရာတွေက **အသေ** — random မဟုတ်တော့ဘူး။ အရင် သေတ္တာတွေက
    //   ကျပန်း ဖြစ်လို့ ဝင်တိုင်း တစ်နေရာစီ ရောက်ပြီး တခြားအရာတွေနဲ့
    //   ထပ်နေတယ် (တိုင်းတာတိုင်း တစ်မျိုးစီ တွေ့ခဲ့တယ်)。 အသေ ချထားရင်
    //   တစ်ခါ စစ်ရုံနဲ့ ထာဝရ မှန်တယ်။
    // ★ ကိုလိုနီအိမ်က တြိဂံ ၅၆k မို့ `heavy` — ဂရပ်ဖစ် အလယ်/အနိမ့်မှာ
    //   ဖျောက်တယ်။ ထင်းအိမ်က ၉.၇k ပဲမို့ `detail`。
    // ★ ကိုလိုနီအိမ်ကို **တစ်လုံးပဲ** ထပ်ထည့်တယ် — တစ်လုံးက တြိဂံ ၅၆k မို့
    //   သုံးလုံး ဆိုရင် ရန်ကုန်က ၅၃၄k ရောက်သွားတယ် (တိုင်းတာပြီး တွေ့ခဲ့)。
    //   အသေးစိတ် လျှော့တဲ့ LOD လုပ်ကြည့်ပေမယ့် ၅၆k → ၄၅k ပဲ ကျလို့
    //   မထူးဘူး — အဲဒီ မော်ဒယ်က အသေးလေးတွေ မဟုတ်ဘဲ နံရံကိုယ်တိုင်က
    //   အသေးစိတ်တာ။ ဒါကြောင့် အရေအတွက်နဲ့ပဲ ချိန်တယ်။
    // ★ ကိုလိုနီအိမ် အသစ်က ၃၀ × ၃၈ m — အရင်ဟာထက် အများကြီး ကြီးပြီး
    //   တြိဂံက ၅၆,၄၈၈ → **၁၅,၁၆၀** ပဲ (mesh ၂,၁၀၃ → ၁၃)。 ဒါကြောင့်
    //   'heavy' မဟုတ်တော့ဘူး၊ အကွာအဝေးလည်း ပိုလိုတယ် (၄၀ m ခြား)。
    // 🏛️ ကိုလိုနီအိမ် — **မော်ဒယ်က ကိုယ်တိုင် သတ်မှတ်ချက် ပါလာပြီ**
    //   (TRIGGER_Door_Main/Gate_Main, SPAWN_Floor_1..3, COL_Stair_1/2)。
    //   ဒါကြောင့် `addKit` က ဖတ်ပြီး တံခါး/ဂိတ်/လှေကား အလိုအလျောက်
    //   တပ်ပေးတယ် — အရင်လို occupancy grid နဲ့ ခန့်မှန်းစရာ မလိုတော့ဘူး。
    for (const z of [-30, 12, 54]) {
      void addKit(this, { kit: 'colonial', position: new THREE.Vector3(-48, 0, z) });
    }
    for (const z of [-44, 44]) {
      void addBuilding(this, {
        kind: 'stilt', position: new THREE.Vector3(48, 0, z), rotation: -Math.PI / 2,
        hollow: { side: '-x', width: 5, step: 2.2 },
      });
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

    // 🚧 ဂိတ် → မဲဆောက် — **နှစ်ဖက် ချိတ်ထားတဲ့ နယ်စပ် ဂိတ်**
    //
    // user: "မဲဆောက်ရန်ကုန် ချိတ်ပေးပါဦး"
    //
    // ★ portal ကတော့ အရင်ကတည်းက ရှိတယ်၊ E နှိပ်ရင်လည်း ကူးလို့ရတယ်
    //   (headless နဲ့ တိုင်းစစ်ပြီး)。 ဒါပေမယ့် (၁) ရောင်စဉ်တိုင် သက်သက်က
    //   မြို့ထဲမှာ ပျောက်နေတယ်၊ (၂) မဲဆောက်ကနေ ပြန်လာရင် ဂိတ်ရှေ့မှာ
    //   မဟုတ်ဘဲ မြို့လယ် spawn မှာ ချတယ် — ဒါကြောင့် မြို့နှစ်ခုက
    //   ဆက်စပ်နေတယ်လို့ မခံစားရဘူး။ အခု ဂိတ်ပုံစံနဲ့ ပြပြီး ဖြတ်ရင်
    //   ဟိုဘက် ဂိတ်ရှေ့မှာပဲ ချတယ်။
    this.addPortal({
      position: new THREE.Vector3(-12, 0, -20),
      targetRoomId: 'maesot',
      label: 'မဲဆောက် နယ်စပ်လမ်းသို့',
      color: 0xffb020,
      gate: 'x',
      arrive: new THREE.Vector3(0, 0, 12),   // မဲဆောက် ဂိတ်ရှေ့
    });

    // 🚕 ဂိတ် → တက္ကစီမြို့ — မြို့အသစ်က menu ကနေပဲ ရောက်လို့ရရင်
    //    လောကထဲမှာ **တံခါး မရှိသလိုပဲ**။ (၂၂, ၀) က ဘယ် collider နဲ့မှ
    //    မထိဘူး၊ တခြား portal နဲ့လည်း ၁၀ m ကျော် ဝေးတယ် (grid scan နဲ့
    //    ရွေးထားတယ်)。
    this.addPortal({
      position: new THREE.Vector3(22, 0, 0),
      targetRoomId: 'taxi-district',
      label: '🚕 တက္ကစီမြို့သို့',
      color: 0xffd479,
      gate: 'z',
      arrive: new THREE.Vector3(-40, 0, -21),  // ရန်ကုန် ဂိတ်ရှေ့
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
      position: new THREE.Vector3(36, 0, -16),
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


    // ══════════════════════════════════════════════════════════════
    // 🏙️ **ချဲ့ထားတဲ့ ရန်ကုန်** — လမ်းကွက်, မီးပွိုင့်, အင်းလျားကန်,
    //    ရပ်ကွက် ၄ ခု, မြက်ခင်း, သစ်ပင်
    //
    // user: "Cyber-Yangon City ကို ၅ဆ ခန့် မြို့ကိုချဲ့ပါ … မီးပွိုင့်များ
    //        ရဲများ ယဥ်ထိန်းများ Taxi သမားများ … အင်းလျားကန်ထည့်ပါ"
    //
    // ★ **အလယ် (±၈၀) ကို မထိဘူး** — ညဈေးတန်း, kiosk, portal, Open Wall
    //   အားလုံး အဲဒီမှာ ရှိပြီးသား၊ လမ်းကွက်က အဲဒါတွေကို ဖြတ်သွားရင်
    //   kiosk တွေ လမ်းလယ်မှာ ဖြစ်နေမယ်။ ဒါကြောင့် လမ်းမကြီးတွေက
    //   ±၈၀ ကနေ စတယ် — အလယ်က မြို့ဟောင်း အတိုင်း ကျန်တယ်။
    // ══════════════════════════════════════════════════════════════
    const LINES = [-320, -240, -160, -80, 80, 160, 240, 320];
    const REACH = 340;
    roadGrid(this, { lines: LINES, reach: REACH, width: 14 });

    // 🚦 မီးပွိုင့် — အတွင်းပိုင်း လမ်းဆုံ ၁၆ ခုမှာ。 `phase` ကွဲထားလို့
    //    မြို့တစ်ခုလုံး တစ်ပြိုင်တည်း မပြောင်းဘူး (တကယ့်မြို့လို)。
    let ph = 0;
    for (const x of [-160, -80, 80, 160]) {
      for (const z of [-160, -80, 80, 160]) {
        trafficLight(this, { x: x + 8.5, z: z + 8.5, rot: Math.atan2(-x, -z), phase: (ph++ * 3.5) % 22 });
      }
    }

    // 💡 လမ်းမီး — လမ်းတိုင်း ၄၀ m တစ်ခု, နှစ်ဖက်စလုံး (InstancedMesh ၂ ခု)
    //
    // ★ **အင်းလျားကန်ထဲက တိုင်တွေ ဖယ်ရမယ်** — လမ်းမကြီး ၂ ချောင်းက
    //   ကန်အောက်ကနေ ဖြတ်သွားလို့ မီးတိုင် ၂၀ လောက် ရေထဲ ရပ်နေတယ်
    //   (render နဲ့ တွေ့ခဲ့တာ)。 ကန်က လမ်းကို ဖုံးလိုက်ပေမယ့် ၇ m အမြင့်
    //   တိုင်တွေက ရေပေါ် ထိုးထွက်နေတယ်။
    const LAKE = { x: -200, z: -200, rx: 95, rz: 66 };
    const inLake = (x, z) =>
      ((x - LAKE.x) / LAKE.rx) ** 2 + ((z - LAKE.z) / LAKE.rz) ** 2 < 1;
    const lamps = [];
    for (const c of LINES) {
      for (let t = -REACH + 20; t <= REACH - 20; t += 40) {
        for (const side of [-1, 1]) {
          const a = [c + side * 8.4, t, side > 0 ? Math.PI : 0];
          const b = [t, c + side * 8.4, side > 0 ? -Math.PI / 2 : Math.PI / 2];
          if (!inLake(a[0], a[1])) lamps.push(a);
          if (!inLake(b[0], b[1])) lamps.push(b);
        }
      }
    }
    streetLamps(this, lamps);

    // 🏞️ **အင်းလျားကန်** — မြို့ရဲ့ မြောက်အနောက်ဘက်။ ကန်ဘောင် လမ်းနဲ့
    //    သံလက်ရန်း ပါတယ် — ရေထဲ ဝင်လို့ မရဘူး (လက်ရန်းက တားတယ်)。
    lake(this, { x: -200, z: -200, rx: 88, rz: 58 });
    // ကန်ဘောင်ကို လမ်းမကြီး ၂ ခုနဲ့ ချိတ်
    roadPath(this, [[-160, -200], [-118, -200]], { width: 9 });
    roadPath(this, [[-200, -160], [-200, -145]], { width: 9 });
    // ကန်ဘောင်ပတ် သစ်ပင်
    {
      const t = [];
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * Math.PI * 2;
        t.push([-200 + Math.cos(a) * 100, -200 + Math.sin(a) * 70, 0.9 + (i % 3) * 0.15]);
      }
      treeRow(this, t);
    }
    this.addStation({
      position: new THREE.Vector3(-112, 0, -200),
      label: '🏞️ အင်းလျားကန်ဘောင် — မြင်ကွင်း/feed တင်ရန်',
      action: 'feed', color: 0x8ecbff,
    });

    // 🌱 မြက်ခင်းပြင် — လမ်းကွက်ကြားက ပန်းခြံများ
    for (const [gx, gz] of [[-120, 120], [120, -120], [200, 200], [-280, 40], [40, 280]]) {
      grassField(this, { x: gx, z: gz, w: 62, d: 62 });
      const t = [];
      for (let i = 0; i < 14; i++) {
        t.push([gx - 26 + (i % 5) * 13, gz - 26 + Math.floor(i / 5) * 17, 0.85 + (i % 3) * 0.2]);
      }
      treeRow(this, t);
    }

    // 🏢 **ရပ်ကွက် ဖြည့်** — လမ်းကွက်ကြားက ဗလာတွေ ဖြည့်တယ်。
    //    ★ render နဲ့ ကြည့်တော့ လမ်းချည်းပဲ ရှိပြီး ကွက်ထဲက မှောင်နေတယ် —
    //      မြို့ကို ၂၀ ဆ ချဲ့လိုက်ရင် အဲဒါ အထင်ရှားဆုံး ချို့ယွင်းချက်။
    //    ★ InstancedMesh ၂ ခုပဲ ဖြစ်လို့ ၂၀၀ လုံး ထည့်လည်း draw call ၂။
    //    ★ အလယ် (±၉၀) ရော အင်းလျားကန် ရော ရှောင်တယ်。
    {
      const fill = [];
      const CENTRES = [-280, -200, -120, 120, 200, 280];
      let n = 0;
      for (const bx of CENTRES) {
        for (const bz of CENTRES) {
          if (Math.hypot(bx + 200, bz + 200) < 130) continue;   // ကန်
          for (let k = 0; k < 4; k++) {
            const ox = (k % 2 ? 1 : -1) * 16, oz = (k < 2 ? -1 : 1) * 16;
            const x = bx + ox, z = bz + oz;
            if (Math.hypot(x, z) < 110) continue;               // မြို့လယ်
            if (Math.hypot(x + 200, z + 200) < 128) continue;
            const h = 9 + ((n * 7) % 5) * 4;                    // ၉–၂၅ m
            fill.push([x, z, 22, 22, h]);
            n++;
          }
        }
      }
      fillerBlocks(this, fill);
    }

    // 🚌 **YBS ဘတ်စ်ကား လိုင်း ၃ ခု** — လမ်းမကြီးပေါ် တကယ် ပတ်တယ်၊
    //    မှတ်တိုင်မှာ ၃ စက္ကန့် ရပ်တယ်။ ကစားသမား မောင်းလို့ မရဘူး —
    //    တက္ကစီက မောင်းဖို့ ဖြစ်ပြီး ဘတ်စ်က မြို့ကို အသက်ဝင်စေဖို့。
    busLine(this, {
      label: 'YBS-1 လှည်းတန်း ↔ စေတီလမ်း', colour: 0xd8324a, count: 3, speed: 10,
      points: [[-80, -160], [80, -160], [80, 160], [-80, 160]],
      stops: [0, 2],
    });
    busLine(this, {
      label: 'YBS-2 အင်းလျား ↔ အရှေ့ပိုင်း', colour: 0x2d9bf0, count: 3, speed: 11,
      points: [[-160, -160], [160, -160], [160, 80], [-160, 80]],
      stops: [1, 3],
    });
    busLine(this, {
      label: 'YBS-3 မြို့ပတ်', colour: 0x3ddc97, count: 4, speed: 12,
      points: [[-240, -240], [240, -240], [240, 240], [-240, 240]],
      stops: [0, 2],
    });

    // 🏙️ ရပ်ကွက်များ — လမ်းဘေး ဆိုင်ခန်းတန်း + အထပ်မြင့်
    //    ★ တစ်လုံးချင်း တံခါးပါတယ် (shophouse က `addDoorAtFront` ခေါ်တယ်)。
    for (const [bx, bz, rot] of [
      [-100, -40, Math.PI / 2], [-100, -12, Math.PI / 2], [-100, 16, Math.PI / 2],
      [100, -40, -Math.PI / 2], [100, -12, -Math.PI / 2], [100, 16, -Math.PI / 2],
      [-40, -100, 0], [-12, -100, 0], [16, -100, 0],
      [-40, 100, Math.PI], [-12, 100, Math.PI], [16, 100, Math.PI],
      [-180, -100, 0], [-152, -100, 0], [180, 100, Math.PI], [152, 100, Math.PI],
    ]) {
      // 🎚️ ★ **အပြင်ရပ်ကွက်က `detail`** — ဂရပ်ဖစ် အနိမ့်မှာ ဖျောက်တယ်။
      //    မြို့လယ် (±၈၀) က အဆောက်အအုံတွေ မဖျောက်ဘူး — အဲဒါတွေမှာ
      //    kiosk, portal, တံခါး ရှိလို့ ပျောက်သွားရင် အလုပ် မလုပ်တော့ဘူး။
      const sh = shophouse(this, { x: bx, z: bz, rot, w: 11, d: 11, h: 8, storeys: 2,
                        wall: 0x2a3350, roof: 0x7d3f52 });
      if (sh) trackQuality(sh, 'detail');
    }
    for (const [tx, tz, h] of [[-140, -140, 34], [140, -140, 42], [-140, 140, 28],
                               [140, 140, 38], [-230, 60, 30], [230, -60, 26]]) {
      const tw = tower(this, { x: tx, z: tz, w: 18, d: 18, h, colour: 0x1d2740 });
      if (tw) trackQuality(tw, 'heavy');   // အထပ်မြင့်က အလယ်ကတည်းက ဖျောက်
    }

    // 🛕 စေတီများ — ရပ်ကွက်တိုင်းမှာ တစ်ဆူစီ, လမ်းနဲ့ ချိတ်ထားတယ်
    for (const [sx, sz, h] of [[-240, 240, 20], [240, 240, 24], [-240, -80, 18],
                               [240, -240, 22]]) {
      smallStupa(this, { x: sx, z: sz, h });
      roadPath(this, [[sx, sz > 0 ? sz - 40 : sz + 40], [sx, sz]], { width: 8 });
    }

    // 🍜 ဈေးတန်း — အရှေ့ရပ်ကွက်
    for (let i = 0; i < 8; i++) {
      marketStall(this, { x: 150 + (i % 2) * 12, z: -20 + Math.floor(i / 2) * 11,
                          colour: [0xc94f4f, 0xf5c542, 0x3ddc97, 0x8ecbff][i % 4] });
    }
    this.addStation({
      position: new THREE.Vector3(144, 0, 6),
      label: '🍜 အရှေ့ပိုင်း ဈေးတန်း — ပစ္စည်း ဝယ်/ရောင်း (GP)',
      action: 'shop', color: 0xf5c542,
    });

    // 🌴 ထန်းပင် — လမ်းမကြီး အဆုံးများမှာ
    for (const [px, pz] of [[-80, 300], [80, 300], [-80, -300], [80, -300],
                            [300, 80], [300, -80], [-300, 80], [-300, -80]]) {
      palm(this.group, px, pz, 1.2, this);
    }

    // 🛣️ **အထင်ကရ နေရာများကို လမ်းနဲ့ ချိတ်** —
    //    user: "အိမ်များတောင်များ ဘုရားများကို လမ်းများအသေးစိတ်ချိတ်ဆက်ပါ"
    //    ★ လမ်းက ပြားတဲ့ plane မို့ **ပြားတဲ့ဇုန် (r ≤ ၃၆၁) အတွင်းမှာပဲ**
    //      ဆွဲရမယ် — တောင်စောင်းပေါ် ဆွဲရင် မြေထဲ မြုပ်သွားမယ်။
    roadPath(this, [[-80, -240], [-40, -268], [0, -280]], { width: 11 });  // ရွှေတိဂုံ ဘက်
    roadPath(this, [[80, -240], [40, -268], [0, -280]], { width: 11 });
    roadPath(this, [[manor.position.x, manor.position.z],
                    [manor.position.x * 0.72, manor.position.z * 0.72],
                    [Math.sign(manor.position.x) * 240 || 240,
                     Math.sign(manor.position.z) * 240 || 240]], { width: 10 });
    roadPath(this, [[320, 0], [340, 0]], { width: 10 });    // တောင်တက် လမ်းဆုံး
    roadPath(this, [[48, -16], [80, -16]], { width: 8 });   // ထင်းအိမ် → လမ်းမ
    roadPath(this, [[-48, 12], [-80, 12]], { width: 8 });   // ကိုလိုနီအိမ် → လမ်းမ

    // 🚕 **တက္ကစီ ဂိတ်** — စီးလို့ရတဲ့ ကား ၆ စီး, ဂိတ်နှစ်နေရာ
    for (const [cx, cz, rot] of [
      [-70, 26, Math.PI / 2], [-70, 34, Math.PI / 2], [-70, 42, Math.PI / 2],
      [70, -26, -Math.PI / 2], [70, -34, -Math.PI / 2], [70, -42, -Math.PI / 2],
    ]) {
      void addBuilding(this, { kind: 'taxi', position: new THREE.Vector3(cx, 0, cz), rotation: rot });
    }
    this.addStation({
      position: new THREE.Vector3(-64, 0, 34),
      label: '🚕 တက္ကစီ ဂိတ် — ခရီးစဉ် ရွေးရန် (အခန်းစာရင်း)',
      action: 'rooms', color: 0xffd479,
    });

    // 🚔 **ရဲစခန်း** — ယာဉ်ထိန်း ကွပ်ကဲရေး
    this.addStation({
      position: new THREE.Vector3(88, 0, 88),
      label: '🚔 ယာဉ်ထိန်း ရဲစခန်း — တာဝန်/သတင်းပို့ရန်',
      action: 'quests', color: 0x2d9bf0,
    });

    // ══ 🧍 မြို့ခံများ ═══════════════════════════════════════════════
    //
    // ★ NPC တိုင်းက **တကယ့် အလုပ်တစ်ခု** ရှိတယ် — ရဲက လမ်းညွှန်,
    //   ယာဉ်ထိန်းက မီးပွိုင့် ရှင်းပြ, တက္ကစီသမားက ခရီးစဉ်, ဈေးသည်က
    //   ဈေးဆိုင်။ စကားပြောထဲမှာ **ဘယ်ကို သွားရမလဲ** အတိအကျ ပါတယ်။
    const CITIZENS = [
      ['ရဲအုပ် ကိုဇော်', 0x2d9bf0, [92, 84], 6, [
        'ဒီမြို့မှာ ယာဉ်စည်းကမ်း လိုက်နာပါ — မီးနီမှာ ရပ်ပါ။',
        'ရဲစခန်းက ဒီနားမှာပဲ — တာဝန်တွေ လိုချင်ရင် kiosk ကို E နှိပ်ပါ။',
        'ခိုးမှု၊ ပျောက်ဆုံးမှု ရှိရင် ကျွန်တော့်ကို ပြောပါ။',
      ]],
      ['ရဲဘော် မြင့်သူ', 0x2d9bf0, [-88, -88], 7, [
        'အနောက်ဘက် ရပ်ကွက်က ကျွန်တော် တာဝန်ကျတယ်။',
        'အင်းလျားကန်ဘောင်မှာ ရေထဲ မဆင်းပါနဲ့ — လက်ရန်း ရှိတယ်။',
      ]],
      ['ယာဉ်ထိန်း ဦးချစ်', 0xf5c542, [88, -72], 5, [
        'မီးပွိုင့်က အစိမ်း ၉ စက္ကန့်, အဝါ ၂ စက္ကန့်, အနီ ၁၁ စက္ကန့်။',
        'လမ်းဆုံတိုင်း တစ်ပြိုင်တည်း မပြောင်းဘူး — ရှေ့က ဟာနေရင် ဆက်သွား။',
        'တက္ကစီတွေက အနောက်ဘက် ဂိတ်မှာ ရှိတယ်။',
      ]],
      ['ယာဉ်ထိန်း မခင်မာ', 0xf5c542, [-72, 88], 5, [
        'ဒီလမ်းက မြောက်ဘက် ရွှေတိဂုံဆီ သွားတယ်။',
        'ကားမောင်းရင် E နှိပ်ပြီး ဝင်စီးလို့ ရတယ်နော်။',
      ]],
      ['တက္ကစီ ဦးမောင်', 0xffd479, [-62, 30], 4, [
        'ဘယ်ကို ပို့ရမလဲ ခင်ဗျာ? ကားခက အခြေခံ ၅၀၀ ကျပ်။',
        'ဒီကားတွေ ကိုယ်တိုင် မောင်းလို့လည်း ရတယ် — E နှိပ်လိုက်ပါ။',
        'တက္ကစီမြို့ဆီ သွားချင်ရင် အရှေ့ဘက် ဂိတ်ကနေ။',
      ]],
      ['တက္ကစီ ကိုညီ', 0xffd479, [62, -30], 4, [
        'မြို့ထဲ လမ်းကြောင်း ကျွန်တော် အကုန်သိတယ်။',
        'အင်းလျားကန် သွားမလား? မြောက်အနောက်ဘက် ၂၀၀ မီတာ။',
      ]],
      ['ဈေးသည် ဒေါ်ခင်', 0xff2d78, [148, 2], 5, [
        'မုန့်ဟင်းခါး, အုန်းနို့ခေါက်ဆွဲ ရှိတယ်ရှင်!',
        'ဈေးတန်း kiosk ကနေ GP နဲ့ ဝယ်လို့ရတယ်။',
      ]],
      ['ကားပြင်ဆရာ ကိုစိန်', 0x9aa0ab, [-96, 20], 5, [
        'ကားတွေ ဒီနားမှာ ရပ်ထားလို့ရတယ်။',
        'ဘီးလေထိုးချင်ရင် ပြောပါ — အလကားပဲ။',
      ]],
      ['ဘတ်စ်ကား စပယ်ယာ ကိုတင်', 0xd8324a, [-74, -156], 4, [
        'YBS တစ်လိုင်း! လှည်းတန်း — စေတီလမ်း, မှတ်တိုင်မှာ ရပ်ပေးမယ်။',
        'ဘတ်စ်ကား ၃ လိုင်း ရှိတယ် — အနီ, အပြာ, အစိမ်း။',
        'အစိမ်းက မြို့ပတ် — အဝေးဆုံး လိုင်း။',
      ]],
      ['ခရီးသည် ဒေါ်ရီ', 0x8ecbff, [86, -154], 3, [
        'ဘတ်စ်ကား စောင့်နေတာ ကြာပြီ ရှင်။',
        'မှတ်တိုင်မှာ ခုံ ရှိတယ် — ထိုင်စောင့်လို့ရတယ်။',
      ]],
      ['ကျောင်းသား မောင်ရဲ', 0x3ddc97, [-118, 118], 6, [
        'ကျောင်းဆင်းချိန် ဆိုတော့ ဘတ်စ်ကား လူပြည့်တယ်။',
        'ပန်းခြံထဲမှာ ဘောလုံးကန်လို့ရတယ်။',
      ]],
      ['ကွမ်းယာဆိုင် ဦးဖေ', 0xffb020, [118, -118], 4, [
        'ကွမ်းယာ, ဆေးလိပ်, ရေသန့် ရှိတယ်ကွာ။',
        'ဒီလမ်းက အရှေ့ဘက် ဈေးတန်းဆီ သွားတယ်။',
      ]],
      ['မြေပုံရောင်းသူ မသန်း', 0x2de1ff, [-64, -64], 5, [
        'မြို့မြေပုံ ဝယ်မလား? — ဒါမှမဟုတ် ကျွန်မ ပြောပြမယ်။',
        'မြောက်ဘက် ရွှေတိဂုံ, အနောက်မြောက် အင်းလျားကန်, အရှေ့ ဈေးတန်း။',
        'တက္ကစီ ဂိတ်က အနောက်ဘက် ၇၀ မီတာ။',
      ]],
      ['ဘုန်းကြီး ဦးဝိမလ', 0xffb020, [-236, 236], 4, [
        'ဘုရားရှိခိုးဖို့ လာတာလား ဒကာ။',
        'စေတီကို လက်ယာရစ် လှည့်ပါ — အနောက်ဘက် လှေကားက တက်လို့ရတယ်။',
      ]],
    ];
    for (const [name, colour, [nx, nz], range, lines] of CITIZENS) {
      this.addNPC(new NPC({
        name, color: colour, range,
        home: new THREE.Vector3(nx, 0, nz),
        dialogue: lines,
      }));
    }

    this.spawn.set(0, 0, 8);
  }
}
