import * as THREE from "three";

/// ထိမှန်မှု အမှတ်အသား — သွေးစက် ပန်းထွက်ခြင်း။
///
/// ★ ဒါက **ခံစားချက်အတွက်** မဟုတ်ဘဲ **သတင်းပေးဖို့** ပါ — ပစ်လိုက်တာ
///   ထိလား မထိလား ချက်ချင်း သိရဖို့။ ဒါမရှိရင် ကစားသမားက ကျည်ကုန်တဲ့အထိ
///   ပစ်ပြီးမှ မထိမှန်း သိရတယ်။ ဒါကြောင့် ခေါင်းထိရင် ပိုကြီးတယ် —
///   ဘယ်နေရာ ထိလဲ ကွာခြားချက် မြင်ရအောင်။
/// ★ ရုပ်ပုံစံက ကွင်းရဲ့ ကာတွန်းလမ်းစဉ်အတိုင်း — အနီရင့် အစက်လုံးလေးတွေ
///   ပျံပြီး ပျောက်သွားတယ်။ Texture/decal မရှိဘူး၊ မြေပေါ် ကျန်မနေဘူး။
/// ★ `intensity` က ၀–၁။ **၀ ဆိုရင် လုံးဝ မဖန်တီးဘူး** — particle တွေ
///   မမြင်ရအောင် ဖျောက်ထားရုံ မဟုတ်ဘဲ တစ်ခုမှ မဆောက်ဘူး။

const MAX_BURSTS = 12;

export type BloodField = {
  /// (x, y, z) မှာ ပန်းထွက်စေတယ်။ `head` ဆိုရင် ပိုများတယ်။
  burst(at: THREE.Vector3, head: boolean): void;
  update(dt: number): void;
  setIntensity(v: number): void;
  dispose(): void;
};

export function createBloodField(scene: THREE.Scene, intensity = 0.6): BloodField {
  type Burst = {
    points: THREE.Points;
    vel: THREE.Vector3[];
    life: number;
    ttl: number;
  };
  const live: Burst[] = [];
  let strength = clamp01(intensity);

  const material = new THREE.PointsMaterial({
    color: 0xb3201f,
    size: 0.16,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });

  function burst(at: THREE.Vector3, head: boolean) {
    if (strength <= 0) return;
    // ★ တစ်ပြိုင်နက် များလွန်းရင် ဖုန်းမှာ frame ကျတယ် — အဟောင်းဆုံးကို
    //   ဖယ်ပြီးမှ အသစ် ထည့်တယ်။
    if (live.length >= MAX_BURSTS) {
      const old = live.shift();
      if (old) scene.remove(old.points);
    }
    const n = Math.round((head ? 26 : 16) * strength);
    if (n <= 0) return;

    const pos = new Float32Array(n * 3);
    const vel: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      pos[i * 3] = at.x;
      pos[i * 3 + 1] = at.y;
      pos[i * 3 + 2] = at.z;
      const spread = head ? 4.2 : 3;
      vel.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * spread,
          Math.random() * (head ? 3.4 : 2.4),
          (Math.random() - 0.5) * spread,
        ),
      );
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(geo, material.clone());
    scene.add(points);
    live.push({ points, vel, life: 0, ttl: head ? 0.75 : 0.55 });
  }

  function update(dt: number) {
    for (let i = live.length - 1; i >= 0; i--) {
      const b = live[i];
      if (!b) continue;
      b.life += dt;
      if (b.life >= b.ttl) {
        scene.remove(b.points);
        b.points.geometry.dispose();
        (b.points.material as THREE.Material).dispose();
        live.splice(i, 1);
        continue;
      }
      const attr = b.points.geometry.getAttribute("position") as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let j = 0; j < b.vel.length; j++) {
        const v = b.vel[j];
        if (!v) continue;
        v.y -= 9.8 * dt; // မြေဆွဲအား — အပေါ်ပျံပြီး ပြန်ကျတယ်
        const k = j * 3;
        arr[k] = (arr[k] ?? 0) + v.x * dt;
        arr[k + 1] = (arr[k + 1] ?? 0) + v.y * dt;
        arr[k + 2] = (arr[k + 2] ?? 0) + v.z * dt;
      }
      attr.needsUpdate = true;
      const mat = b.points.material as THREE.PointsMaterial;
      mat.opacity = 0.95 * (1 - b.life / b.ttl);
    }
  }

  return {
    burst,
    update,
    setIntensity(v: number) {
      strength = clamp01(v);
    },
    dispose() {
      for (const b of live) {
        scene.remove(b.points);
        b.points.geometry.dispose();
        (b.points.material as THREE.Material).dispose();
      }
      live.length = 0;
      material.dispose();
    },
  };
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

const KEY = "gw-assassin-blood";

/// ရွေးချယ်မှုကို စက်ထဲ မှတ်ထားတယ် — ဝင်တိုင်း ပြန်ချိန်ရရင် အသုံးမဝင်ဘူး။
export function loadBloodPref(): number {
  if (typeof window === "undefined") return 0.6;
  const raw = window.localStorage.getItem(KEY);
  if (raw === null) return 0.6;
  const n = Number(raw);
  return Number.isFinite(n) ? clamp01(n) : 0.6;
}

export function saveBloodPref(v: number) {
  try {
    window.localStorage.setItem(KEY, String(clamp01(v)));
  } catch {
    /* private mode — မမှတ်နိုင်လည်း ဂိမ်းက ဆက်အလုပ်လုပ်တယ် */
  }
}
