import * as THREE from "three";

/// မီး — မီးပုံ၊ မီးရှူး၊ မီးလုံလောင်ဗူး။
///
/// ★ **အလင်း တုန်ခါတာက အဓိက**။ မီးတောက် particle တွေက အလှသာ ဖြစ်ပြီး
///   "မီး" လို့ ခံစားရစေတာက ပတ်ဝန်းကျင်ကို လင်း/မှိန် လုပ်နေတဲ့ PointLight။
///   ငြိမ်နေတဲ့ အလင်းက ဓာတ်မီးလို ဖြစ်တယ်၊ မီးလို မဟုတ်ဘူး။
/// ★ မိုးရွာရင် အား ၅၀% လျော့တယ် — `setWet()`။

export type Fire = {
  group: THREE.Group;
  /// ★ ဝေးရင် ရပ်ထားတယ် — `false` ဆိုရင် particle မတွက်ဘူး၊ အလင်းလည်း
  /// ပိတ်တယ်။ PointLight တစ်ခုချင်းက lit pixel တိုင်းရဲ့ တွက်ချက်မှုကို
  /// တိုးစေတာမို့ မီး ၆ ခုက ဖုန်းအဟောင်းကို ရပ်သွားစေနိုင်တယ်။
  setActive(on: boolean): void;
  update(dt: number): void;
  /// 0 = ခြောက်သွေ့, 1 = မိုးရွာနေ
  setWet(w: number): void;
  dispose(): void;
};

const FLAME_COUNT = 80;
const SMOKE_COUNT = 40;

export function createFire(x: number, z: number, scale: number): Fire {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.scale.setScalar(scale);

  // ── ထင်း ────────────────────────────────────────────────────────────────
  const logGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.4, 6);
  const logMat = new THREE.MeshStandardMaterial({
    color: 0x4a3020,
    emissive: 0xff4400,
    emissiveIntensity: 0.35,
    roughness: 0.9,
  });
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(logGeo, logMat);
    log.rotation.z = Math.PI / 2.4;
    log.rotation.y = (i / 3) * Math.PI * 2;
    log.position.y = 0.18;
    group.add(log);
  }

  // ── မီးတောက် ───────────────────────────────────────────────────────────
  const flamePos = new Float32Array(FLAME_COUNT * 3);
  const flameLife = new Float32Array(FLAME_COUNT);
  for (let i = 0; i < FLAME_COUNT; i++) {
    flamePos[i * 3] = (Math.random() - 0.5) * 0.5;
    flamePos[i * 3 + 1] = Math.random() * 1.2;
    flamePos[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    flameLife[i] = Math.random();
  }
  const flameGeo = new THREE.BufferGeometry();
  flameGeo.setAttribute("position", new THREE.BufferAttribute(flamePos, 3));
  const flameMat = new THREE.PointsMaterial({
    color: 0xffa030,
    size: 0.34,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const flames = new THREE.Points(flameGeo, flameMat);
  group.add(flames);

  // ── မီးခိုး ────────────────────────────────────────────────────────────
  const smokePos = new Float32Array(SMOKE_COUNT * 3);
  for (let i = 0; i < SMOKE_COUNT; i++) {
    smokePos[i * 3] = (Math.random() - 0.5) * 0.7;
    smokePos[i * 3 + 1] = 1.2 + Math.random() * 3;
    smokePos[i * 3 + 2] = (Math.random() - 0.5) * 0.7;
  }
  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute("position", new THREE.BufferAttribute(smokePos, 3));
  const smokeMat = new THREE.PointsMaterial({
    color: 0x555555,
    size: 0.6,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  const smoke = new THREE.Points(smokeGeo, smokeMat);
  group.add(smoke);

  // ── အလင်း ──────────────────────────────────────────────────────────────
  const light = new THREE.PointLight(0xff8a30, 1.4, 14 * scale, 2);
  light.position.y = 1;
  group.add(light);

  let t = Math.random() * 10;
  let wet = 0;
  let active = true;

  return {
    group,
    setActive(on) {
      if (active === on) return;
      active = on;
      flames.visible = on;
      smoke.visible = on;
      light.visible = on;
    },
    setWet(w) {
      wet = THREE.MathUtils.clamp(w, 0, 1);
    },
    update(dt) {
      if (!active) return;
      t += dt;
      const power = 1 - wet * 0.5;

      // ★ တုန်ခါမှု — sine ၂ ခု + ကျပန်း အနည်းငယ်။ sine တစ်ခုတည်းဆိုရင်
      // စက်ရုပ်ဆန်ပြီး ကျပန်းသက်သက်ဆိုရင် မှိတ်တုတ်မှိတ်တုတ် ဖြစ်တယ်။
      light.intensity = (1.2 + Math.sin(t * 12) * 0.15 + Math.random() * 0.1) * power;
      flameMat.opacity = 0.9 * power;
      logMat.emissiveIntensity = 0.35 * power;

      const fp = flameGeo.attributes.position!;
      for (let i = 0; i < FLAME_COUNT; i++) {
        flameLife[i] = (flameLife[i] ?? 0) + dt * (1.4 + Math.random() * 0.6);
        if ((flameLife[i] ?? 0) > 1) {
          flameLife[i] = 0;
          fp.setXYZ(i, (Math.random() - 0.5) * 0.5, 0.1, (Math.random() - 0.5) * 0.5);
        } else {
          fp.setY(i, fp.getY(i) + dt * 1.8 * power);
          fp.setX(i, fp.getX(i) * 0.985);
          fp.setZ(i, fp.getZ(i) * 0.985);
        }
      }
      fp.needsUpdate = true;

      const sp = smokeGeo.attributes.position!;
      for (let i = 0; i < SMOKE_COUNT; i++) {
        sp.setY(i, sp.getY(i) + dt * 0.7);
        sp.setX(i, sp.getX(i) + dt * 0.15);
        if (sp.getY(i) > 5) {
          sp.setXYZ(i, (Math.random() - 0.5) * 0.7, 1.2, (Math.random() - 0.5) * 0.7);
        }
      }
      sp.needsUpdate = true;
    },
    dispose() {
      logGeo.dispose();
      logMat.dispose();
      flameGeo.dispose();
      flameMat.dispose();
      smokeGeo.dispose();
      smokeMat.dispose();
    },
  };
}
