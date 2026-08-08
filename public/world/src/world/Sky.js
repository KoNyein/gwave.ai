// ============================================================
// Sky.js — 🌅 **ကောင်းကင်** — အရောင်စဉ် ခုံး, နေ/လ, ကြယ်, တိမ်
//
// user: "ကောင်းကင်လှလှလေး တည်ဆောက်ပေးပါ"
//
// ═══ ဘာကြောင့် ခုံး လိုလဲ ═══
//
// အရင်က ကောင်းကင်က `scene.background` အရောင် **တစ်ခုတည်း** ပဲ —
// အပေါ်ကြည့်ရင် ဘာမှ မရှိတဲ့ အပြားကြီး။ မိုးကုတ်စက်ဝိုင်းနဲ့ ကောင်းကင်
// ခွဲမရဘူး၊ နေ/လ မရှိ, တိမ် မရှိ, ကြယ် မရှိ။ မြို့ကို ဘယ်လောက်
// အသေးစိတ် လုပ်လုပ် အပေါ်ကြည့်လိုက်ရင် ဗလာပဲ။
//
// ═══ ဒီဇိုင်း ဆုံးဖြတ်ချက်များ ═══
//
// ★ **ShaderMaterial တစ်ခုတည်း** နဲ့ အရောင်စဉ် — texture မဆွဲရဘူး၊
//   ဖိုင်ဆိုက် သုည။ အောက်ခြေ (မိုးကုတ်) → အလယ် → ထိပ် သုံးဆင့်。
// ★ **`fog: false`** — မြူထဲ ဝင်ရင် ကောင်းကင်က မြူအရောင် တစ်ခုတည်း
//   ဖြစ်သွားပြီး ဘာမှ မကျန်ဘူး။ ခုံးက မြူရဲ့ အပြင်မှာ ရှိတယ်လို့
//   သဘောထားတယ်။
// ★ **`depthWrite: false` + `renderOrder: -1`** — ခုံးက အမြဲ နောက်ဆုံး
//   အလွှာ။ radius ကို camera far (၁၂၅၀) အတွင်း ၁၁၀၀ ထားတယ် —
//   ဒီထက် ကြီးရင် ဖြတ်တောက်ခံရမယ်။
// ★ ကြယ်တွေက `Points` တစ်ခုတည်း (draw call ၁)၊ တိမ်တွေက အပြားလေးတွေ —
//   နှစ်ခုစလုံး ညမှာပဲ / နေ့မှာပဲ ပြတယ်။
// ============================================================
import * as THREE from 'three';

/// ကောင်းကင် အရောင် အစုံ — အခန်းရဲ့ အလင်း preset နဲ့ တွဲတယ်
const SKIES = {
  day: {
    top: 0x2f6ec4, mid: 0x7fb2e8, horizon: 0xd8e6f2,
    sun: 0xfff2c4, sunAt: [-0.42, 0.46, -0.78], sunSize: 46,
    stars: 0, clouds: 16, cloud: 0xffffff, cloudOpacity: 0.5,
  },
  night: {
    top: 0x050a1c, mid: 0x101a3a, horizon: 0x2a3560,
    sun: 0xdfe6ff, sunAt: [0.55, 0.4, -0.72], sunSize: 26,
    stars: 900, clouds: 10, cloud: 0x2a3560, cloudOpacity: 0.4,
  },
  neon: {
    top: 0x1a0f38, mid: 0x3d1f6b, horizon: 0x7a4a8c,
    sun: 0xffd9f0, sunAt: [0.3, 0.3, -0.9], sunSize: 30,
    stars: 500, clouds: 12, cloud: 0x5a3a7a, cloudOpacity: 0.45,
  },
};

// ★ **အလုံးလေး texture** — canvas ကနေ ထုတ်တယ် (ဖိုင် မဆွဲရဘူး)。
//   `PointsMaterial` ကို texture မပေးရင် ကြယ်တွေက **စတုရန်းကွက်**
//   ဖြစ်နေတယ် (render နဲ့ တွေ့ခဲ့တာ)。 နေ/လ ရဲ့ အလင်းဝိုင်းမှာလည်း
//   ဒီ texture နဲ့မှ အနားက ပျော့ပျောင်းသွားတယ် — မဟုတ်ရင် မီးခိုးရောင်
//   အဝိုင်းပြား တစ်ခုလို ဖြစ်နေတယ်。
let _glowTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.62)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  _glowTex = new THREE.CanvasTexture(c);
  return _glowTex;
}

const VERT = `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

// ★ အောက်ခြေ→ထိပ် သုံးဆင့် ရောစပ်。 `h` က ၀ (မိုးကုတ်) ကနေ ၁ (ထိပ်)。
//   `pow` နဲ့ မိုးကုတ်နားမှာ ကျဉ်းကျဉ်း, အပေါ်မှာ ကျယ်ကျယ် ဖြစ်စေတယ် —
//   တကယ့် ကောင်းကင်က အဲဒီလိုပဲ。
const FRAG = `
  uniform vec3 uTop, uMid, uHorizon;
  varying vec3 vDir;
  void main() {
    float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 c = mix(uHorizon, uMid, pow(smoothstep(0.48, 0.62, h), 0.85));
    c = mix(c, uTop, pow(smoothstep(0.58, 1.0, h), 1.25));
    gl_FragColor = vec4(c, 1.0);
  }`;

/**
 * 🌅 အခန်းတစ်ခုမှာ ကောင်းကင် ထည့်တယ်။
 * @param room   — Room (group ထဲ ထည့်ပြီး `room.sky` မှာ မှတ်တယ်)
 * @param preset — 'day' | 'night' | 'neon'
 */
export function addSky(room, preset = 'day', opts = {}) {
  const S = { ...(SKIES[preset] || SKIES.day), ...opts };
  const g = new THREE.Group();
  g.name = 'SKY';

  // ── အရောင်စဉ် ခုံး ───────────────────────────────────────────────
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1100, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        uTop: { value: new THREE.Color(S.top) },
        uMid: { value: new THREE.Color(S.mid) },
        uHorizon: { value: new THREE.Color(S.horizon) },
      },
    })
  );
  dome.renderOrder = -1;
  g.add(dome);

  // ── နေ / လ — အလင်းဝိုင်း ၂ ထပ် (အလုံး + ဝိုင်းပြန့်) ──────────────
  const dir = new THREE.Vector3(...S.sunAt).normalize();
  const at = dir.clone().multiplyScalar(980);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(S.sunSize, 28),
    new THREE.MeshBasicMaterial({ color: S.sun, fog: false, depthWrite: false })
  );
  disc.position.copy(at); disc.lookAt(0, 0, 0);
  disc.renderOrder = -1; g.add(disc);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(S.sunSize * 4.2, 28),
    new THREE.MeshBasicMaterial({
      color: S.sun, fog: false, transparent: true, opacity: 0.55,
      map: glowTexture(), depthWrite: false,
    })
  );
  halo.position.copy(at); halo.lookAt(0, 0, 0);
  halo.renderOrder = -1; g.add(halo);

  // ── ကြယ် — Points တစ်ခုတည်း (draw call ၁) ────────────────────────
  if (S.stars > 0) {
    const pos = new Float32Array(S.stars * 3);
    for (let i = 0; i < S.stars; i++) {
      // ★ အပေါ်ပိုင်း ခုံးမှာပဲ — မြေအောက် ကြယ်တွေက ဘယ်တော့မှ မမြင်ရဘဲ
      //   vertex အလကား ကုန်တယ်။
      const u = Math.random(), v = Math.random() * 0.62 + 0.06;
      const th = u * Math.PI * 2, ph = Math.acos(1 - 2 * v * 0.5);
      const r = 1040;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffffff, size: 4, sizeAttenuation: false,
      map: glowTexture(), alphaTest: 0.02,
      transparent: true, opacity: 0.85, fog: false, depthWrite: false,
    }));
    stars.renderOrder = -1;
    g.add(stars);
  }

  // ── တိမ် — အလွှာလိုက် အပြားလေးများ, ဖြေးဖြေး မျောတယ် ──────────────
  const clouds = [];
  if (S.clouds > 0) {
    const mat = new THREE.MeshBasicMaterial({
      color: S.cloud, transparent: true, opacity: S.cloudOpacity,
      depthWrite: false, fog: false,
    });
    for (let i = 0; i < S.clouds; i++) {
      const w = 160 + Math.random() * 260, d = 70 + Math.random() * 110;
      const c = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
      c.rotation.x = -Math.PI / 2;
      const a = (i / S.clouds) * Math.PI * 2 + Math.random();
      const r = 260 + Math.random() * 520;
      c.position.set(Math.cos(a) * r, 190 + Math.random() * 130, Math.sin(a) * r);
      c.renderOrder = -1;
      g.add(c);
      clouds.push({ mesh: c, speed: 1.6 + Math.random() * 2.4 });
    }
  }

  room.group.add(g);
  room.sky = { group: g, clouds };
  return g;
}

/// ☁️ frame တိုင်း — တိမ်တွေ ဖြေးဖြေး မျော, အစွန်းရောက်ရင် ပြန်ဝင်。
/// ★ ခုံးက ကစားသမားနဲ့ **အတူလိုက်ရမယ်** — မလိုက်ရင် မြို့စွန်း ရောက်တဲ့အခါ
///   ကောင်းကင် အနားသတ်ကို ကျော်ထွက်ပြီး ဘာမှ မရှိတာ မြင်ရမယ်。
export function updateSky(room, dt, playerPos) {
  const sky = room.sky;
  if (!sky) return;
  if (playerPos) sky.group.position.set(playerPos.x, 0, playerPos.z);
  for (const c of sky.clouds) {
    c.mesh.position.x += c.speed * dt;
    if (c.mesh.position.x > 820) c.mesh.position.x = -820;
  }
}
