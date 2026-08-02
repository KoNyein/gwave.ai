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

export type Landmark = {
  id: string;
  label: string;
  href: string;
  x: number;
  z: number;
  /// ဒီအကွာအဝေးအတွင်း ရောက်မှ HUD မှာ ပေါ်တယ်
  radius: number;
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
  const all = [...SPOTS, boardSpot];

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
