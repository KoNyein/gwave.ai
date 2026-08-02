import * as THREE from "three";

import type { Avatar } from "../human";
import type { AvatarConfig } from "./config";

/// Avatar အစိတ်အပိုင်းများ — ဆံပင်၊ မျက်နှာ၊ အဝတ်၊ ပစ္စည်း (spec 15.2)။
///
/// ★ **အဆစ်မှာပဲ ကပ်ရမယ်** (`head`, `torso`, `hips`, `footL/R`) —
///   `avatar.group` ပေါ်တင် ကပ်လိုက်ရင် လမ်းလျှောက်တဲ့အခါ ဦးထုပ်က
///   လေထဲမှာ ကျန်နေပြီး ခေါင်းက ရွေ့သွားမယ်။
/// ★ **အဟောင်းကို dispose လုပ်ရမယ်** — config ကို ၅၀ ခါ ပြောင်းရင်
///   geometry ၅၀ စု memory ထဲ ကျန်နေမယ် (acceptance criteria ထဲမှာပါ)။

type Builder = (color: number) => THREE.Object3D;

function box(w: number, h: number, d: number, color: number, y = 0, z = 0, x = 0) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// ── ဆံပင် ────────────────────────────────────────────────────────────────
export const HAIR: Record<string, Builder> = {
  none: () => new THREE.Group(),
  short: (c) => {
    const g = new THREE.Group();
    g.add(box(0.3, 0.1, 0.29, c, 0.13));
    g.add(box(0.31, 0.12, 0.06, c, 0.05, -0.13));
    return g;
  },
  long: (c) => {
    const g = new THREE.Group();
    g.add(box(0.3, 0.1, 0.29, c, 0.13));
    g.add(box(0.3, 0.42, 0.1, c, -0.12, -0.14));
    return g;
  },
  bun: (c) => {
    const g = new THREE.Group();
    g.add(box(0.3, 0.1, 0.29, c, 0.13));
    const bun = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 10, 8),
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }),
    );
    bun.position.set(0, 0.17, -0.16);
    g.add(bun);
    return g;
  },
  braid: (c) => {
    const g = new THREE.Group();
    g.add(box(0.3, 0.1, 0.29, c, 0.13));
    g.add(box(0.08, 0.5, 0.08, c, -0.16, -0.15));
    return g;
  },
};

// ── မျက်နှာ ──────────────────────────────────────────────────────────────
/// ★ မျက်နှာက **ခေါင်းရဲ့ ရှေ့မျက်နှာပြင်ပေါ်** — z က +0.15 (ခေါင်းအကျယ်
/// တစ်ဝက်ကျော်)။ ထဲထည့်လိုက်ရင် ခေါင်းထဲ နစ်ပြီး မမြင်ရဘူး။
const FACE_Z = 0.152;

export const EYES: Record<string, Builder> = {
  normal: () => faceGroup([{ w: 0.055, h: 0.055, x: 0.07 }, { w: 0.055, h: 0.055, x: -0.07 }], 0.03, 0x1a1a1a),
  happy: () => faceGroup([{ w: 0.07, h: 0.02, x: 0.07 }, { w: 0.07, h: 0.02, x: -0.07 }], 0.04, 0x1a1a1a),
  sharp: () => faceGroup([{ w: 0.075, h: 0.03, x: 0.07 }, { w: 0.075, h: 0.03, x: -0.07 }], 0.03, 0x1a1a1a),
  sleepy: () => faceGroup([{ w: 0.06, h: 0.015, x: 0.07 }, { w: 0.06, h: 0.015, x: -0.07 }], 0.02, 0x1a1a1a),
};

export const BROWS: Record<string, Builder> = {
  normal: () => faceGroup([{ w: 0.07, h: 0.018, x: 0.07 }, { w: 0.07, h: 0.018, x: -0.07 }], 0.085, 0x2b1b10),
  thick: () => faceGroup([{ w: 0.08, h: 0.032, x: 0.07 }, { w: 0.08, h: 0.032, x: -0.07 }], 0.085, 0x2b1b10),
  thin: () => faceGroup([{ w: 0.065, h: 0.01, x: 0.07 }, { w: 0.065, h: 0.01, x: -0.07 }], 0.085, 0x2b1b10),
};

export const MOUTH: Record<string, Builder> = {
  normal: () => faceGroup([{ w: 0.07, h: 0.018, x: 0 }], -0.06, 0x8a3a3a),
  smile: () => {
    const g = new THREE.Group();
    g.add(box(0.05, 0.016, 0.01, 0x8a3a3a, -0.06, FACE_Z, 0));
    g.add(box(0.018, 0.018, 0.01, 0x8a3a3a, -0.048, FACE_Z, 0.032));
    g.add(box(0.018, 0.018, 0.01, 0x8a3a3a, -0.048, FACE_Z, -0.032));
    return g;
  },
  flat: () => faceGroup([{ w: 0.05, h: 0.012, x: 0 }], -0.06, 0x7a4040),
};

function faceGroup(
  parts: { w: number; h: number; x: number }[],
  y: number,
  color: number,
) {
  const g = new THREE.Group();
  for (const p of parts) g.add(box(p.w, p.h, 0.01, color, y, FACE_Z, p.x));
  return g;
}

// ── အဝတ် ─────────────────────────────────────────────────────────────────
export const TOPS: Record<string, Builder> = {
  tee: (c) => box(0.42, 0.3, 0.26, c, 0.36),
  shirt: (c) => {
    const g = new THREE.Group();
    g.add(box(0.43, 0.36, 0.27, c, 0.34));
    g.add(box(0.06, 0.34, 0.28, 0xf2f2f2, 0.34));
    return g;
  },
  hoodie: (c) => {
    const g = new THREE.Group();
    g.add(box(0.46, 0.38, 0.3, c, 0.34));
    g.add(box(0.34, 0.16, 0.2, c, 0.56, -0.12));
    return g;
  },
  tank: (c) => box(0.34, 0.28, 0.24, c, 0.34),
  longyi_top: (c) => {
    // အင်္ကျီ — လည်ပတ်ဖွင့်၊ လက်တို
    const g = new THREE.Group();
    g.add(box(0.44, 0.34, 0.28, c, 0.34));
    g.add(box(0.12, 0.1, 0.29, 0xf6f2e8, 0.48));
    return g;
  },
};

export const BOTTOMS: Record<string, Builder> = {
  jeans: (c) => box(0.34, 0.44, 0.26, c, -0.22),
  shorts: (c) => box(0.36, 0.24, 0.27, c, -0.12),
  skirt: (c) => {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.3, 0.32, 10),
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }),
    );
    m.position.y = -0.16;
    m.castShadow = true;
    return m;
  },
  // ★ လုံချည် — မြန်မာ့ဝတ်စုံ။ ခြေထောက် ၂ ဖက်ကို ဖုံးတဲ့ ဆလင်ဒါတစ်ခု
  longyi: (c) => {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.26, 0.62, 10),
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.88 }),
    );
    m.position.y = -0.31;
    m.castShadow = true;
    return m;
  },
};

export const SHOES: Record<string, Builder> = {
  sneaker: (c) => box(0.19, 0.1, 0.28, c, -0.03, 0.03),
  boot: (c) => {
    const g = new THREE.Group();
    g.add(box(0.2, 0.12, 0.29, c, -0.02, 0.03));
    g.add(box(0.18, 0.18, 0.2, c, 0.12, -0.02));
    return g;
  },
  sandal: (c) => box(0.18, 0.05, 0.27, c, -0.05, 0.03),
  barefoot: () => new THREE.Group(),
};

// ── ပစ္စည်း ───────────────────────────────────────────────────────────────
export const ACCESSORY_BUILDERS: Record<string, () => THREE.Object3D> = {
  hat_straw: () => {
    const g = new THREE.Group();
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.32, 0.03, 12),
      new THREE.MeshStandardMaterial({ color: 0xd9b56a, roughness: 0.9 }),
    );
    brim.position.y = 0.17;
    g.add(brim);
    g.add(box(0.22, 0.14, 0.22, 0xc9a45a, 0.24));
    return g;
  },
  glasses_round: () => {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.5 });
    for (const x of [0.07, -0.07]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 12), mat);
      ring.position.set(x, 0.03, FACE_Z);
      g.add(ring);
    }
    g.add(box(0.06, 0.008, 0.008, 0x2b3038, 0.03, FACE_Z));
    return g;
  },
  scarf: () => box(0.3, 0.08, 0.26, 0xc0392b, -0.04),
  hat_crown: () => {
    const g = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({
      color: 0xffd24a,
      emissive: 0xffd24a,
      emissiveIntensity: 0.25,
      roughness: 0.35,
    });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.07, 10), gold);
    band.position.y = 0.2;
    g.add(band);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 5), gold);
      spike.position.set(Math.cos(a) * 0.14, 0.28, Math.sin(a) * 0.14);
      g.add(spike);
    }
    return g;
  },
  wings: () => {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf2f6ff,
      emissive: 0x9fd0ff,
      emissiveIntensity: 0.3,
      roughness: 0.5,
      transparent: true,
      opacity: 0.9,
    });
    for (const s of [1, -1]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.04), mat);
      w.position.set(s * 0.3, 0.32, -0.16);
      w.rotation.z = s * -0.35;
      w.rotation.y = s * 0.4;
      g.add(w);
    }
    return g;
  },
  halo: () => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.022, 7, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffe680,
        emissive: 0xffe680,
        emissiveIntensity: 0.9,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.34;
    return ring;
  },
};

/// ★ ပစ္စည်းက ဘယ်အဆစ်မှာ ကပ်လဲ — ဦးထုပ်က ခေါင်း၊ အတောင်ပံက ကိုယ်လုံး။
const ACCESSORY_JOINT: Record<string, "head" | "torso"> = {
  hat_straw: "head",
  glasses_round: "head",
  hat_crown: "head",
  halo: "head",
  scarf: "head",
  wings: "torso",
};

const BUILD_SCALE: Record<string, number> = { slim: 0.9, normal: 1, broad: 1.16 };

function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material;
    if (Array.isArray(mat)) for (const x of mat) x.dispose();
    else if (mat) (mat as THREE.Material).dispose();
  });
}

/// Config တစ်ခုကို avatar ပေါ် တင်တယ်။ ခဏခဏ ခေါ်လို့ရတယ် (live preview)。
export function applyAvatarConfig(avatar: Avatar, cfg: AvatarConfig) {
  // ★ အဟောင်းတွေ ဖယ်ပြီး dispose — မလုပ်ရင် memory leak
  for (const old of avatar.attachments) {
    old.parent?.remove(old);
    disposeTree(old);
  }
  avatar.attachments.length = 0;

  avatar.materials.skin.color.setHex(cfg.body.skin);
  avatar.materials.cloth.color.setHex(cfg.outfit.topColor);
  avatar.materials.dark.color.setHex(cfg.outfit.bottomColor);

  // အရပ်နဲ့ ကိုယ်ထည် — group ကို scale တာက အဆစ်တွေ အကုန်လိုက်တယ်
  avatar.group.scale.set(
    BUILD_SCALE[cfg.body.build] ?? 1,
    cfg.body.height,
    BUILD_SCALE[cfg.body.build] ?? 1,
  );

  const add = (obj: THREE.Object3D | undefined, joint: THREE.Object3D) => {
    if (!obj) return;
    joint.add(obj);
    avatar.attachments.push(obj);
  };

  add(HAIR[cfg.hair.style]?.(cfg.hair.color), avatar.attach.head);
  add(EYES[cfg.face.eyes]?.(0), avatar.attach.head);
  add(BROWS[cfg.face.brows]?.(0), avatar.attach.head);
  add(MOUTH[cfg.face.mouth]?.(0), avatar.attach.head);
  add(TOPS[cfg.outfit.top]?.(cfg.outfit.topColor), avatar.attach.torso);
  add(BOTTOMS[cfg.outfit.bottom]?.(cfg.outfit.bottomColor), avatar.attach.hips);
  add(SHOES[cfg.outfit.shoes]?.(cfg.outfit.shoesColor), avatar.attach.footL);
  add(SHOES[cfg.outfit.shoes]?.(cfg.outfit.shoesColor), avatar.attach.footR);

  for (const id of cfg.accessories) {
    const build = ACCESSORY_BUILDERS[id];
    if (!build) continue;
    const joint = ACCESSORY_JOINT[id] === "torso" ? avatar.attach.torso : avatar.attach.head;
    add(build(), joint);
  }
}
