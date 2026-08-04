import * as THREE from "three";

/// ⚔️ Combat မြင်ကွင်းအထူးပြုလုပ်ချက်များ — ကျည်လမ်းကြောင်း၊ ပြောင်းဝမီး၊
/// သတ်ချက် ကွင်းလှိုင်း။
///
/// ★ ဒီ file မှာ **game logic လုံးဝ မရှိဘူး** — ထိမထိ၊ hp၊ အမှတ် အားလုံး
///   server မှာ (assassin.js)။ ဒီမှာက ဖြစ်ပြီးသားကို မြင်သာအောင် ပြရုံပဲ။
///   ပစ်ချက်တစ်ချက်မှာ "ဘာမှ မမြင်ရ/မကြားရ" ဆိုရင် ဂိမ်းက ပျက်နေတယ်လို့
///   ခံစားရတယ် — ဒါက fun ရဲ့ အခြေခံ။
/// ★ Pool နဲ့ ပြန်သုံးတယ် — SMG လို လက်နက်နဲ့ တဒဒပစ်ရင် mesh အသစ်
///   ဆောက်/ဖျက်နေရင် GC က frame ခုန်စေတယ် (gamefx.ts နဲ့ တူညီတဲ့ သဘော)။

const MAX_TRACERS = 24;
const MAX_RINGS = 8;
const TRACER_LIFE = 0.14;
const RING_LIFE = 0.6;

export type CombatFx = {
  /// ကျည်လမ်းကြောင်း — `from` ကနေ `dir` အတိုင်း `len` unit
  tracer(from: THREE.Vector3, dir: THREE.Vector3, len?: number): void;
  /// ပြောင်းဝ မီးပွင့် — ကိုယ့်မျက်နှာရှေ့ / ပစ်သူနေရာမှာ ခဏလင်းတယ်
  muzzle(at: THREE.Vector3): void;
  /// မြေပြင် ကွင်းလှိုင်း — respawn / kill နေရာပြ (အနီ=သေ၊ အစိမ်း=ရှင်)
  ring(x: number, z: number, color: number): void;
  update(dt: number): void;
  dispose(): void;
};

export function createCombatFx(scene: THREE.Scene): CombatFx {
  const group = new THREE.Group();
  group.name = "combatfx";
  scene.add(group);

  // ── ကျည်လမ်းကြောင်း pool ────────────────────────────────────────────────
  // ★ ပါးလွှာတဲ့ cylinder — Line က ဖုန်း GPU မှာ အမြဲ 1px ပဲ ထွက်လို့
  //   မမြင်ရသလောက် ဖြစ်တယ်။ Additive မို့ နောက်ခံပေါ် အလင်းတန်းလို ပေါ်တယ်။
  const tracerGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 5, 1, true);
  type Tracer = {
    mesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
    life: number;
  };
  const tracers: Tracer[] = [];
  for (let i = 0; i < MAX_TRACERS; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd27a,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(tracerGeo, mat);
    mesh.visible = false;
    group.add(mesh);
    tracers.push({ mesh, life: 0 });
  }
  let nextTracer = 0;

  // ── မြေပြင် ကွင်းလှိုင်း pool ────────────────────────────────────────────
  const ringGeo = new THREE.RingGeometry(0.85, 1, 40);
  type Ring = {
    mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
    life: number;
  };
  const rings: Ring[] = [];
  for (let i = 0; i < MAX_RINGS; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(ringGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    group.add(mesh);
    rings.push({ mesh, life: 0 });
  }
  let nextRing = 0;

  // ── ပြောင်းဝ မီးပွင့် — light တစ်လုံးတည်း ပြန်သုံးတယ် ──────────────────
  // ★ PointLight အသစ် ထည့်/ဖြုတ်တိုင်း shader ပြန် compile ဖြစ်နိုင်လို့
  //   အမြဲရှိနေပြီး intensity ပဲ ကစားတယ်။
  const flash = new THREE.PointLight(0xffb35a, 0, 9, 2);
  flash.visible = true;
  group.add(flash);
  let flashLife = 0;

  const up = new THREE.Vector3(0, 1, 0);

  return {
    tracer(from, dir, len = 36) {
      const t = tracers[nextTracer % MAX_TRACERS];
      nextTracer++;
      if (!t) return;
      const d = dir.clone().normalize();
      t.mesh.position.copy(from).addScaledVector(d, len / 2);
      t.mesh.quaternion.setFromUnitVectors(up, d);
      t.mesh.scale.set(1, len, 1);
      t.mesh.visible = true;
      t.mesh.material.opacity = 0.85;
      t.life = TRACER_LIFE;
    },

    muzzle(at) {
      flash.position.copy(at);
      flash.intensity = 14;
      flashLife = 0.08;
    },

    ring(x, z, color) {
      const r = rings[nextRing % MAX_RINGS];
      nextRing++;
      if (!r) return;
      r.mesh.position.set(x, 0.07, z);
      r.mesh.scale.setScalar(0.4);
      r.mesh.material.color.setHex(color);
      r.mesh.material.opacity = 0.9;
      r.mesh.visible = true;
      r.life = RING_LIFE;
    },

    update(dt) {
      for (const t of tracers) {
        if (t.life <= 0) continue;
        t.life -= dt;
        if (t.life <= 0) {
          t.mesh.visible = false;
          continue;
        }
        t.mesh.material.opacity = (t.life / TRACER_LIFE) * 0.85;
      }
      for (const r of rings) {
        if (r.life <= 0) continue;
        r.life -= dt;
        if (r.life <= 0) {
          r.mesh.visible = false;
          continue;
        }
        const k = 1 - r.life / RING_LIFE;
        r.mesh.scale.setScalar(0.4 + k * 3.2);
        r.mesh.material.opacity = (1 - k) * 0.9;
      }
      if (flashLife > 0) {
        flashLife -= dt;
        flash.intensity = Math.max(0, (flashLife / 0.08) * 14);
      }
    },

    dispose() {
      // ★ WebGL resource က GC မလုပ်ဘူး — dispose မလုပ်ရင် room ပြောင်းတိုင်း
      // GPU memory တက်နေမယ်။
      for (const t of tracers) t.mesh.material.dispose();
      for (const r of rings) r.mesh.material.dispose();
      tracerGeo.dispose();
      ringGeo.dispose();
      scene.remove(group);
    },
  };
}
