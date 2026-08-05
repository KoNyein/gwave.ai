import * as THREE from "three";

import type { Collider } from "./world";

/// Gwave ချိတ်ဆက်မှုများ (spec 5.8) — metaverse က သီးခြားဂိမ်းတစ်ခု မဖြစ်ဘဲ
/// Gwave ရဲ့ တစ်စိတ်တစ်ပိုင်း ဖြစ်စေတဲ့ အချက်။
///
/// ★ လောကထဲက နေရာတစ်ခုစီက gwave.cc ရဲ့ စာမျက်နှာတစ်ခုဆီ ဦးတည်တယ် —
///   အနားရောက်ရင် HUD မှာ ပေါ်ပြီး နှိပ်လိုက်ရင် အဲဒီစာမျက်နှာ ရောက်တယ်။
///   3D ထဲမှာ marketplace တစ်ခုလုံး ပြန်တည်ဆောက်စရာ မလိုဘူး — ရှိပြီးသား
///   စာမျက်နှာက ပိုကောင်းတယ်။
/// ★ ကြော်ငြာသင်ပုန်းကတော့ တကယ့် newsfeed ကို လောကထဲမှာ ပြတယ်
///   (`/api/metaverse/board`) — ပို့စ် ၅ ခု၊ canvas texture အဖြစ်။

/// Cabinet တစ်လုံးက ဘာလုပ်လဲ — **အားလုံး လောကထဲမှာပဲ**:
///  - game    → လက်ရှိ room ထဲမှာ server mini-game lobby ဖွင့်
///  - room    → ဂိမ်းရဲ့ ကိုယ်ပိုင် room ထဲ ပြောင်း၊ `gameId` ပါရင်
///              ရောက်တာနဲ့ mini-game ကို အလိုအလျောက် join ပေးတယ်
///  - overlay → utility overlay (🧬 scan studio ကင်မရာသာ — ဂိမ်း မဟုတ်ဘူး)
export type ArcadeAct =
  | { kind: "game"; gameId: string }
  | { kind: "room"; roomId: string; gameId?: string }
  | { kind: "overlay" };

export type Landmark = {
  id: string;
  label: string;
  href: string;
  x: number;
  z: number;
  /// ဒီအကွာအဝေးအတွင်း ရောက်မှ HUD မှာ ပေါ်တယ်
  radius: number;
  /// ရှိရင် Game Zone landmark — HUD ခလုတ်က ဒီ action ကို run တယ်၊
  /// မရှိရင် ပုံမှန် link အတိုင်း သွားတယ် (ဈေး/စိုက်ခင်း ဆိုင်းဘုတ်တွေ)
  act?: ArcadeAct;
};

export type Landmarks = {
  nearest(x: number, z: number): Landmark | null;
  /// သင်ပုန်းပေါ်က စာကို အသစ်ရေး — API က ပြန်လာမှ ခေါ်တယ်
  setNotices(posts: { author: string; text: string }[]): void;
  dispose(): void;
};

const SPOTS: Landmark[] = [
  { id: "market", label: "ဈေး · Marketplace", href: "/marketplace", x: 18, z: 8, radius: 4 },
  { id: "farm", label: "စိုက်ခင်း · Farm", href: "/farm", x: -20, z: 8, radius: 4 },
  { id: "learn", label: "စာသင်ခန်း · Learn", href: "/learn", x: 20, z: -6, radius: 4 },
  { id: "live", label: "တိုက်ရိုက် · Live", href: "/live", x: -18, z: -8, radius: 4 },
];

/// ── 🕹 GAME ZONE — Gwave ဂိမ်းအားလုံး **လောကထဲမှာကိုယ်တိုင်** ကစားတယ် ──
/// Spawn (0,12) ရဲ့ ကျောဘက် z=20 တန်း။ Cabinet နှိပ်ရင် iframe မဖွင့်တော့ဘူး:
///  - 🚁 GWAVE DRONE → server "droneRace" mini-game (ကောင်းကင် ring၊ 🛸 စီး)
///  - 🔫 GWAVE STRIKE → arena room ပြောင်း (တာဝါ + သေနတ် + NPC စစ်မြေပြင်)
///  - 🎯 ASSASSIN → server "assassin" mini-game (player ချင်း လျှို့ဝှက်လိုက်)
///  - 🏁 DRONE CHAMPIONS → server "race" checkpoint ပြိုင်ပွဲ (drone စီးလည်းရ)
///  - 🧬 3D SCAN → scan studio (ကင်မရာ utility မို့ overlay — ဂိမ်း မဟုတ်ဘူး)
export type ArcadeGame = Landmark & { emoji: string; accent: string; tagMy: string };

export const ARCADE_GAMES: ArcadeGame[] = [
  {
    id: "arc-drone", label: "GWAVE DRONE", href: "/drone/index.html",
    x: -12, z: 20, radius: 3.4,
    act: { kind: "room", roomId: "drone-race", gameId: "droneRace" },
    emoji: "🚁", accent: "#35e0b8", tagMy: "Drone တောင်ကြား room · ring ၇ ခု",
  },
  {
    id: "arc-strike", label: "GWAVE STRIKE", href: "/strike/",
    x: -6, z: 20, radius: 3.4, act: { kind: "room", roomId: "arena" },
    emoji: "🔫", accent: "#ff4d6d", tagMy: "Arena စစ်မြေပြင် room",
  },
  {
    id: "arc-assassin", label: "ASSASSIN", href: "/games/assassin",
    x: 0, z: 20, radius: 3.4,
    act: { kind: "room", roomId: "assassin-alley", gameId: "assassin" },
    emoji: "🎯", accent: "#f6ae2d", tagMy: "ညလမ်းကြား room · လိုက်တမ်း",
  },
  {
    id: "arc-dronechamp", label: "DRONE CHAMPIONS", href: "/games/drone-sim",
    x: 6, z: 20, radius: 3.4,
    act: { kind: "room", roomId: "champions", gameId: "race" },
    emoji: "🏁", accent: "#3f88c5", tagMy: "ပြိုင်ကွင်း room · checkpoint",
  },
  {
    id: "arc-avatar", label: "3D AVATAR", href: "/profile/avatar",
    x: 12, z: 20, radius: 3.4, act: { kind: "overlay" },
    emoji: "🧬", accent: "#b18cff", tagMy: "မျက်နှာ + ကိုယ်ခန္ဓာ scan",
  },
];

/// ★ လမ်းဘေးမှာ ထားရမယ် — spawn (0, 12) ရဲ့ တည့်တည့်ရှေ့မှာ ထားရင်
/// ဝင်လာသူတိုင်း အရင်ဆုံး မြင်ရတာက အနက်ရောင် ပြားကြီးတစ်ခုပဲ ဖြစ်ပြီး
/// မြို့ရော မြို့လယ် screen ရော လုံးဝ မမြင်ရဘူး။
/// `ry` က မျက်နှာမူရာ — plane က default အနေနဲ့ +z ဘက် မျက်နှာမူတယ်၊
/// ဒါကြောင့် ဒီတန်ဖိုးက သင်ပုန်းကို ရင်ပြင်လယ်ဘက် လှည့်ပေးတယ်။
const BOARD = { x: -12, z: 4, w: 6.4, h: 3.4, ry: 0.6 };

const SIGN_COLORS: Record<string, string> = {
  market: "#f6ae2d",
  farm: "#6cc551",
  learn: "#3f88c5",
  live: "#e94f37",
};

function signTexture(label: string, accent: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const c = canvas.getContext("2d");
  if (c) {
    c.fillStyle = "#111826";
    c.fillRect(0, 0, 512, 160);
    c.fillStyle = accent;
    c.fillRect(0, 0, 512, 10);
    c.fillStyle = "#e2e8f0";
    c.font = "600 44px system-ui, sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(label, 256, 88, 470);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/// Arcade cabinet ရဲ့ မျက်နှာပြင် — emoji ကြီးကြီး + ဂိမ်းနာမည် + မြန်မာ
/// tagline ကို canvas ပေါ်ဆွဲပြီး emissive texture အဖြစ် သုံးတယ် (ညဘက်
/// လင်းနေအောင်)။ စာအားလုံး canvas ပေါ်မှာသာ — DOM/innerHTML မသုံးဘူး။
function cabinetScreenTexture(g: { emoji: string; label: string; tagMy: string; accent: string }): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 640;
  const c = canvas.getContext("2d");
  if (c) {
    const grad = c.createLinearGradient(0, 0, 0, 640);
    grad.addColorStop(0, "#0a0f1e");
    grad.addColorStop(1, "#111a30");
    c.fillStyle = grad;
    c.fillRect(0, 0, 512, 640);
    c.strokeStyle = g.accent;
    c.lineWidth = 14;
    c.strokeRect(10, 10, 492, 620);
    c.textAlign = "center";
    c.font = "220px system-ui, sans-serif";
    c.textBaseline = "middle";
    c.fillText(g.emoji, 256, 240);
    c.fillStyle = g.accent;
    c.font = "700 52px system-ui, sans-serif";
    c.fillText(g.label, 256, 430, 470);
    c.fillStyle = "#cbd5e1";
    c.font = "34px 'Padauk', 'Noto Sans Myanmar', system-ui, sans-serif";
    c.fillText(g.tagMy, 256, 500, 470);
    c.fillStyle = "#4ade80";
    c.font = "600 30px 'Padauk', 'Noto Sans Myanmar', system-ui, sans-serif";
    c.fillText("▶ ကစားရန် အနားကပ်ပါ", 256, 580, 470);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/// ကြော်ငြာသင်ပုန်း — ပို့စ်တွေကို canvas ပေါ်ရေးပြီး texture အဖြစ် သုံးတယ်။
/// ★ စာကို **canvas ပေါ်မှာသာ** ဆွဲတယ်၊ DOM/innerHTML မဖြတ်ဘူး — ပို့စ်
///   စာသားက user input ဖြစ်လို့ HTML အဖြစ် ဘယ်တော့မှ မသုံးရ။
function drawBoard(
  canvas: HTMLCanvasElement,
  posts: { author: string; text: string }[],
) {
  const c = canvas.getContext("2d");
  if (!c) return;
  const W = canvas.width;
  const H = canvas.height;

  c.fillStyle = "#0f172a";
  c.fillRect(0, 0, W, H);
  c.fillStyle = "#1e293b";
  c.fillRect(0, 0, W, 72);
  c.fillStyle = "#4ade80";
  c.font = "700 40px system-ui, sans-serif";
  c.textAlign = "left";
  c.textBaseline = "middle";
  c.fillText("GWAVE — နောက်ဆုံးရ", 28, 38);

  if (posts.length === 0) {
    c.fillStyle = "#64748b";
    c.font = "30px system-ui, sans-serif";
    c.fillText("ပို့စ် မရှိသေးပါ", 28, 130);
    return;
  }

  let y = 118;
  for (const p of posts.slice(0, 5)) {
    c.fillStyle = "#93c5fd";
    c.font = "600 28px system-ui, sans-serif";
    c.fillText(p.author.slice(0, 22), 28, y);
    c.fillStyle = "#cbd5e1";
    c.font = "26px system-ui, sans-serif";
    // စာကြောင်းတစ်ကြောင်းစာသာ — သင်ပုန်းက ရှည်ရှည် မဆံ့ဘူး
    c.fillText(p.text.slice(0, 46), 28, y + 34, W - 56);
    y += 84;
  }
}

export function buildLandmarks(
  scene: THREE.Scene,
  colliders: Collider[],
): Landmarks {
  const disposables: { dispose(): void }[] = [];
  const added: THREE.Object3D[] = [];

  const track = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x);
    return x;
  };
  const place = <T extends THREE.Object3D>(o: T): T => {
    scene.add(o);
    added.push(o);
    return o;
  };

  // ── ဆိုင်းဘုတ်တွေ ───────────────────────────────────────────────────────
  const postGeo = track(new THREE.CylinderGeometry(0.12, 0.14, 2.6, 8));
  const postMat = track(
    new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.7 }),
  );
  const signGeo = track(new THREE.PlaneGeometry(3.2, 1));

  for (const s of SPOTS) {
    const pole = place(new THREE.Mesh(postGeo, postMat));
    pole.position.set(s.x, 1.3, s.z);
    pole.castShadow = true;

    const tex = track(signTexture(s.label, SIGN_COLORS[s.id] ?? "#4ade80"));
    const mat = track(
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
    );
    const sign = place(new THREE.Mesh(signGeo, mat));
    sign.position.set(s.x, 3.0, s.z);
    // ★ မြို့လယ် (0,0) ဘက်ကို လှည့်ထားတယ် — လမ်းလျှောက်လာသူက စာဖတ်လို့ရဖို့
    sign.rotation.y = Math.atan2(-s.x, -s.z);
  }

  // ── 🕹 GAME ZONE — arcade cabinet ငါးလုံး + မုခ်ဦး ─────────────────────
  // Cabinet တစ်လုံး = ကိုယ်ထည် (box) + စောင်းနေတဲ့ control deck + emissive
  // မျက်နှာပြင် + အပေါ်က marquee အလင်းတန်း။ ဂိမ်းရဲ့ accent အရောင်နဲ့
  // emissive မို့ ညဘက်မှာ neon လို လင်းနေတယ်။
  {
    const bodyMat = track(
      new THREE.MeshStandardMaterial({ color: 0x151a24, roughness: 0.55, metalness: 0.25 }),
    );
    const bodyGeo = track(new THREE.BoxGeometry(1.8, 2.5, 1.1));
    const deckGeo = track(new THREE.BoxGeometry(1.8, 0.22, 0.62));
    const marqueeGeo = track(new THREE.BoxGeometry(1.9, 0.34, 1.16));
    const screenGeo = track(new THREE.PlaneGeometry(1.5, 1.85));

    for (const g of ARCADE_GAMES) {
      // 🧬 3D Scanner က cabinet မဟုတ်ဘူး — သီးခြား Scan Studio pod
      // (အောက်မှာ) နဲ့ ဆောက်ထားတယ်
      if (g.id === "arc-avatar") continue;
      // cabinet က မြို့လယ်ဘက် (spawn ဘက် -z) ကို မျက်နှာမူတယ်
      const face = Math.PI;
      const body = place(new THREE.Mesh(bodyGeo, bodyMat));
      body.position.set(g.x, 1.25, g.z);
      body.rotation.y = face;
      body.castShadow = true;

      const accent = new THREE.Color(g.accent);
      const marqueeMat = track(
        new THREE.MeshStandardMaterial({
          color: accent, emissive: accent, emissiveIntensity: 0.9, roughness: 0.4,
        }),
      );
      const marquee = place(new THREE.Mesh(marqueeGeo, marqueeMat));
      marquee.position.set(g.x, 2.67, g.z);
      marquee.rotation.y = face;

      const tex = track(cabinetScreenTexture(g));
      const screenMat = track(
        new THREE.MeshBasicMaterial({ map: tex }),
      );
      const screen = place(new THREE.Mesh(screenGeo, screenMat));
      // မျက်နှာပြင်က ကိုယ်ထည်ရဲ့ -z မျက်နှာစာအပြင်ဘက် အနည်းငယ်ကွာ
      screen.position.set(g.x, 1.5, g.z - 0.56);
      screen.rotation.y = face;

      const deck = place(new THREE.Mesh(deckGeo, bodyMat));
      deck.position.set(g.x, 0.95, g.z - 0.75);
      deck.rotation.y = face;
      deck.rotation.x = -0.35;

      colliders.push({
        minX: g.x - 1.0, maxX: g.x + 1.0,
        minZ: g.z - 0.75, maxZ: g.z + 0.6,
      });
    }

    // ── 🧬 3D SCAN STUDIO — Game Zone အစွန်က scanning pod ────────────────
    // ဝိုင်းစက်ပလက်ဖောင်း + မတ်တပ်ရပ် scan ring (torus) + emissive sign။
    // Metaverse ရဲ့ ကိုယ်ပိုင် identity အချက်အချာ — ဒီမှာ scan လုပ်ပြီး
    // ထွက်တာနဲ့ ကိုယ့် avatar မျက်နှာ ချက်ချင်း ပြောင်းသွားတယ်။
    {
      const studio = ARCADE_GAMES.find((g) => g.id === "arc-avatar");
      if (studio) {
        const violet = new THREE.Color(studio.accent);
        const padMat = track(
          new THREE.MeshStandardMaterial({
            color: 0x141024, emissive: violet, emissiveIntensity: 0.35, roughness: 0.4,
          }),
        );
        const padGeo = track(new THREE.CylinderGeometry(1.7, 1.9, 0.16, 28));
        const pad = place(new THREE.Mesh(padGeo, padMat));
        pad.position.set(studio.x, 0.08, studio.z);

        const ringMat = track(
          new THREE.MeshStandardMaterial({
            color: violet, emissive: violet, emissiveIntensity: 1.1, roughness: 0.3,
          }),
        );
        const ringGeo = track(new THREE.TorusGeometry(1.35, 0.07, 12, 48));
        const ring = place(new THREE.Mesh(ringGeo, ringMat));
        // မတ်တပ်ရပ် ring — လူက ထဲကို လျှောက်ဝင်လို့ရအောင် (scanner ပုံစံ)
        ring.position.set(studio.x, 1.5, studio.z);
        ring.rotation.y = Math.PI / 2;

        const pole = place(new THREE.Mesh(postGeo, postMat));
        pole.position.set(studio.x, 1.3, studio.z + 1.9);
        const tex = track(cabinetScreenTexture(studio));
        const signMat = track(new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
        const signGeoStudio = track(new THREE.PlaneGeometry(1.7, 2.1));
        const sign = place(new THREE.Mesh(signGeoStudio, signMat));
        sign.position.set(studio.x, 3.1, studio.z + 1.9);
        sign.rotation.y = Math.PI;

        // pad ရဲ့ ဘေးနှစ်ဘက်သာ ပိတ် — ရှေ့ (မြို့လယ်ဘက်) က ဝင်ပေါက်
        colliders.push(
          { minX: studio.x - 2.0, maxX: studio.x - 1.6, minZ: studio.z - 1.4, maxZ: studio.z + 1.4 },
          { minX: studio.x + 1.6, maxX: studio.x + 2.0, minZ: studio.z - 1.4, maxZ: studio.z + 1.4 },
        );
      }
    }

    // မုခ်ဦး — "GAME ZONE" arch (တိုင်နှစ်တိုင် + ထိပ်စာတန်း)
    const archMat = track(
      new THREE.MeshStandardMaterial({ color: 0x1b2029, roughness: 0.6, metalness: 0.3 }),
    );
    const archPostGeo = track(new THREE.CylinderGeometry(0.18, 0.22, 4.6, 10));
    for (const dx of [-15, 15]) {
      const post = place(new THREE.Mesh(archPostGeo, archMat));
      post.position.set(dx, 2.3, 16.5);
      post.castShadow = true;
      colliders.push({ minX: dx - 0.3, maxX: dx + 0.3, minZ: 16.2, maxZ: 16.8 });
    }
    const archTex = track(signTexture("🕹 GAME ZONE — ဂိမ်းရင်ပြင်", "#4ade80"));
    const archMatSign = track(
      new THREE.MeshBasicMaterial({ map: archTex, side: THREE.DoubleSide }),
    );
    const archSignGeo = track(new THREE.PlaneGeometry(9.6, 3));
    const archSign = place(new THREE.Mesh(archSignGeo, archMatSign));
    archSign.position.set(0, 4.6, 16.5);
  }

  // ── ကြော်ငြာသင်ပုန်း ────────────────────────────────────────────────────
  const boardCanvas = document.createElement("canvas");
  boardCanvas.width = 768;
  boardCanvas.height = 432;
  drawBoard(boardCanvas, []);
  const boardTex = track(new THREE.CanvasTexture(boardCanvas));
  boardTex.colorSpace = THREE.SRGBColorSpace;
  const boardMat = track(
    new THREE.MeshBasicMaterial({ map: boardTex, side: THREE.DoubleSide }),
  );
  const boardGeo = track(new THREE.PlaneGeometry(BOARD.w, BOARD.h));
  const nx = Math.sin(BOARD.ry); // မျက်နှာမူရာ (normal)
  const nz = Math.cos(BOARD.ry);

  const board = place(new THREE.Mesh(boardGeo, boardMat));
  board.position.set(BOARD.x, 2.6, BOARD.z);
  board.rotation.y = BOARD.ry;

  const backGeo = track(new THREE.BoxGeometry(BOARD.w + 0.4, BOARD.h + 0.4, 0.25));
  const backMat = track(
    new THREE.MeshStandardMaterial({ color: 0x1b2029, roughness: 0.8 }),
  );
  // ★ ကျောဘက် panel ကို **normal ရဲ့ ဆန့်ကျင်ဘက်** မှာ ထားရမယ် — ရှေ့မှာ
  // ထားမိရင် စာသားကို လုံးဝ ဖုံးပစ်တယ် (အနက်ရောင် ပြားတစ်ခုပဲ မြင်ရမယ်)။
  const back = place(new THREE.Mesh(backGeo, backMat));
  back.position.set(BOARD.x - nx * 0.16, 2.6, BOARD.z - nz * 0.16);
  back.rotation.y = BOARD.ry;
  back.castShadow = true;

  const legGeo = track(new THREE.BoxGeometry(0.22, 1.0, 0.22));
  for (const d of [-2.4, 2.4]) {
    const leg = place(new THREE.Mesh(legGeo, backMat));
    // ဆိုင်းဘုတ်နဲ့အတူ လှည့်ထားလို့ ခြေထောက်က အလျားလိုက် ရွှေ့ရမယ်
    leg.position.set(BOARD.x + nz * d - nx * 0.16, 0.5, BOARD.z - nx * d - nz * 0.16);
  }

  // သင်ပုန်းက အစိုင်အခဲ — ဖြတ်လျှောက်လို့ မရရ။ လှည့်ထားလို့ AABB က
  // အနည်းငယ် ကြီးတယ် (ရိုးရှင်းအောင် — collider က box ပဲ ခံနိုင်တယ်)။
  const halfX = Math.abs(nz) * (BOARD.w / 2) + 0.3;
  const halfZ = Math.abs(nx) * (BOARD.w / 2) + 0.3;
  colliders.push({
    minX: BOARD.x - halfX,
    maxX: BOARD.x + halfX,
    minZ: BOARD.z - halfZ,
    maxZ: BOARD.z + halfZ,
  });

  const boardSpot: Landmark = {
    id: "board",
    label: "ကြော်ငြာသင်ပုန်း · Feed",
    href: "/feed",
    // ဖတ်တဲ့နေရာက သင်ပုန်းရဲ့ ရှေ့ဘက် — ကျောဘက်မှာ ရပ်နေရင် စာမမြင်ရဘူး
    x: BOARD.x + nx * 2.6,
    z: BOARD.z + nz * 2.6,
    radius: 3.6,
  };
  const all = [...SPOTS, ...ARCADE_GAMES, boardSpot];

  return {
    nearest(x, z) {
      let best: Landmark | null = null;
      let bestD = Infinity;
      for (const s of all) {
        const d = Math.hypot(x - s.x, z - s.z);
        if (d <= s.radius && d < bestD) {
          best = s;
          bestD = d;
        }
      }
      return best;
    },
    setNotices(posts) {
      drawBoard(boardCanvas, posts);
      boardTex.needsUpdate = true;
    },
    dispose() {
      for (const o of added) scene.remove(o);
      for (const d of disposables) d.dispose();
    },
  };
}
