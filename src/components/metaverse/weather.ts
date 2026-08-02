import * as THREE from "three";

import type { WeatherKind } from "./maps/types";

/// ရာသီဥတု — မိုး၊ နှင်း၊ မုန်တိုင်း၊ မြူ၊ aurora။
///
/// ★ **အဓိကလှည့်ကွက်**: particle တွေကို လောကတစ်ခုလုံးမှာ မဖြန့်ဘူး —
///   player ပတ်လည် box (၃၀×၂၀×၃၀) အတွင်းမှာသာ ထားပြီး player ရွှေ့ရင်
///   box လိုက်ရွှေ့တယ်။ အောက်ကျပြီးရင် အပေါ်ပြန်တင်တယ် (recycle)။
///   ဒါကြောင့် particle ၄၀၀၀ နဲ့ radius ၁၀၀ လောကတစ်ခုလုံး မိုးရွာနေသလို
///   ဖြစ်တယ်။ တကယ် ဖြန့်ရင် particle သိန်းချီ လိုမယ်။
/// ★ **Client မှာ ကျပန်း မလုပ်ရ** — ရာသီဥတုက server ကနေသာ လာတယ်။
///   မဟုတ်ရင် တစ်ယောက်က မိုးထဲ၊ ဘေးကလူက နေသာနေတာ ဖြစ်မယ်။

export type Weather = {
  set(kind: WeatherKind, intensity: number, windX: number, windZ: number): void;
  readonly kind: WeatherKind;
  update(dt: number, px: number, py: number, pz: number): void;
  /// မိုးရွာနေရင် မီးအား လျော့စေဖို့ (Phase 10)
  readonly wetness: number;
  dispose(): void;
};

const BOX_W = 30;
const BOX_H = 20;

/// Fog ရဲ့ မူလတန်ဖိုးကို မှတ်ထားပြီး ရာသီဥတုနဲ့ ချိန်တယ် — မဟုတ်ရင်
/// မိုးရွာပြီးတဲ့အခါ မြူက ဘယ်တော့မှ ပြန်မကြည်တော့ဘူး။
type FogBase = { near: number; far: number };

function makeField(count: number, size: number, color: number, opacity: number) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * BOX_W;
    pos[i * 3 + 1] = Math.random() * BOX_H;
    pos[i * 3 + 2] = (Math.random() - 0.5) * BOX_W;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false; // box က ကင်မရာနဲ့အတူ ရွှေ့နေလို့
  return { points, geo, mat, pos };
}

export function createWeather(scene: THREE.Scene, ambient: THREE.AmbientLight): Weather {
  const fogBase: FogBase = {
    near: (scene.fog as THREE.Fog | null)?.near ?? 40,
    far: (scene.fog as THREE.Fog | null)?.far ?? 130,
  };
  const ambientBase = ambient.intensity;

  const rain = makeField(4000, 0.14, 0xaecbe0, 0.55);
  const snowField = makeField(2500, 0.32, 0xffffff, 0.85);
  rain.points.visible = false;
  snowField.points.visible = false;
  scene.add(rain.points, snowField.points);

  // ── Aurora — ကောင်းကင်မှာ ကွေးနေတဲ့ အလွှာ ၃ ခု ───────────────────────
  const auroraGroup = new THREE.Group();
  const auroraMats: THREE.MeshBasicMaterial[] = [];
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.CylinderGeometry(120, 120, 40, 24, 1, true, i * 1.4, 1.6);
    const mat = new THREE.MeshBasicMaterial({
      color: [0x5effc0, 0x7bd0ff, 0xc07bff][i] ?? 0x5effc0,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    auroraMats.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 70 + i * 8;
    auroraGroup.add(mesh);
  }
  auroraGroup.visible = false;
  scene.add(auroraGroup);

  let kind: WeatherKind = "clear";
  let intensity = 1;
  let wind = { x: 0.6, z: 0.2 };
  let t = 0;
  /// လျှပ်စီး — နောက်တစ်ချက် ဘယ်တော့ ပြက်မလဲ
  let nextBolt = 6;
  let boltGlow = 0;

  const api: Weather = {
    get kind() {
      return kind;
    },
    get wetness() {
      return kind === "rain" || kind === "storm" ? intensity : 0;
    },

    set(k, i, wx, wz) {
      kind = k;
      intensity = THREE.MathUtils.clamp(i, 0, 1);
      wind = { x: wx, z: wz };

      rain.points.visible = k === "rain" || k === "storm";
      snowField.points.visible = k === "snow" || k === "blizzard";
      auroraGroup.visible = k === "aurora";

      // ★ Blizzard မှာ နှင်းက ၂ ဆ ထူပြီး မြင်ကွင်း ကျဉ်းရမယ် — particle
      // ကို အသစ်မဆောက်ဘဲ အရွယ်နဲ့ opacity ကို ချိန်တယ် (frame မကျအောင်)။
      snowField.mat.size = k === "blizzard" ? 0.46 : 0.32;
      snowField.mat.opacity = k === "blizzard" ? 0.95 : 0.85;
      rain.mat.opacity = k === "storm" ? 0.7 : 0.55;

      const fog = scene.fog as THREE.Fog | null;
      if (fog) {
        // မိုး/မြူ/မုန်တိုင်းမှာ မြင်ကွင်း ကျဉ်းတယ် — မူလတန်ဖိုးကနေ တွက်တာမို့
        // ရာသီဥတု ပြန်ကြည်ရင် မူလအတိုင်း ပြန်ရောက်တယ်။
        const shrink =
          k === "fog" ? 0.28 : k === "blizzard" ? 0.35 : k === "storm" ? 0.55 : k === "rain" ? 0.7 : 1;
        fog.near = fogBase.near * (k === "fog" ? 0.2 : 1);
        fog.far = fogBase.far * shrink;
      }
    },

    update(dt, px, py, pz) {
      t += dt;

      // ── မိုး ─────────────────────────────────────────────────────────
      if (rain.points.visible) {
        rain.points.position.set(px, py, pz);
        const p = rain.pos;
        const fall = 26 * (0.7 + intensity * 0.6) * dt;
        for (let i = 0; i < p.length; i += 3) {
          p[i + 1] = (p[i + 1] ?? 0) - fall;
          p[i] = (p[i] ?? 0) + wind.x * dt * 6;
          p[i + 2] = (p[i + 2] ?? 0) + wind.z * dt * 6;
          if ((p[i + 1] ?? 0) < -2) {
            // ★ recycle — box ရဲ့ အပေါ်ကို ကျပန်း ပြန်တင်တယ်
            p[i] = (Math.random() - 0.5) * BOX_W;
            p[i + 1] = BOX_H;
            p[i + 2] = (Math.random() - 0.5) * BOX_W;
          }
        }
        rain.geo.attributes.position!.needsUpdate = true;
      }

      // ── နှင်း ────────────────────────────────────────────────────────
      if (snowField.points.visible) {
        snowField.points.position.set(px, py, pz);
        const p = snowField.pos;
        const gust = kind === "blizzard" ? 4 : 1;
        const fall = (kind === "blizzard" ? 2.4 : 1) * dt;
        for (let i = 0; i < p.length; i += 3) {
          p[i + 1] = (p[i + 1] ?? 0) - fall;
          // ★ လေထဲမှာ ယိမ်း — ဒါမရှိရင် နှင်းက မိုးလို ဖြောင့်ကျပြီး
          // "နှင်း" လို့ လုံးဝ မခံစားရဘူး
          p[i] = (p[i] ?? 0) + (Math.sin(t * 1.4 + i) * 0.3 + wind.x * gust) * dt;
          p[i + 2] = (p[i + 2] ?? 0) + (Math.cos(t * 1.1 + i) * 0.3 + wind.z * gust) * dt;
          if ((p[i + 1] ?? 0) < -2) {
            p[i] = (Math.random() - 0.5) * BOX_W;
            p[i + 1] = BOX_H;
            p[i + 2] = (Math.random() - 0.5) * BOX_W;
          }
        }
        snowField.geo.attributes.position!.needsUpdate = true;
      }

      // ── လျှပ်စီး ─────────────────────────────────────────────────────
      if (kind === "storm") {
        nextBolt -= dt;
        if (nextBolt <= 0) {
          boltGlow = 1;
          nextBolt = 5 + Math.random() * 10; // ၅–၁၅ စက္ကန့်
        }
        if (boltGlow > 0) {
          boltGlow = Math.max(0, boltGlow - dt * 8);
          ambient.intensity = ambientBase + boltGlow * 2.2;
        }
      } else if (boltGlow > 0) {
        boltGlow = 0;
        ambient.intensity = ambientBase;
      }

      // ── Aurora ───────────────────────────────────────────────────────
      if (auroraGroup.visible) {
        auroraGroup.rotation.y += dt * 0.02;
        for (let i = 0; i < auroraMats.length; i++) {
          const m = auroraMats[i];
          if (m) m.opacity = (0.12 + Math.sin(t * 0.4 + i * 2) * 0.08) * intensity;
        }
      }
    },

    dispose() {
      scene.remove(rain.points, snowField.points, auroraGroup);
      rain.geo.dispose();
      rain.mat.dispose();
      snowField.geo.dispose();
      snowField.mat.dispose();
      for (const m of auroraMats) m.dispose();
      for (const c of auroraGroup.children) {
        (c as THREE.Mesh).geometry.dispose();
      }
      ambient.intensity = ambientBase;
      const fog = scene.fog as THREE.Fog | null;
      if (fog) {
        fog.near = fogBase.near;
        fog.far = fogBase.far;
      }
    },
  };

  return api;
}
