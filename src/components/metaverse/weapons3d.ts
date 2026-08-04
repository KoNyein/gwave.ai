import * as THREE from "three";

/// ⚔️ လက်နက် 3D မော်ဒယ်များ — primitive (box/cylinder/sphere) နဲ့ ဆောက်တယ်။
///
/// ★ GLB မသုံးတာက avatar (human.ts) နဲ့ တူညီတဲ့ အကြောင်းပြချက် — 0 byte
///   download, blocky style က avatar နဲ့ လိုက်ဖက်တယ်။
/// ★ ဦးတည်ရာ convention: **ပြောင်းက local +Z** (avatar ရဲ့ မျက်နှာဘက်)၊
///   ကိုင်ရိုးက -Y။ FP viewmodel မှာ camera က -Z ကြည့်လို့ group ကို
///   rotation.y = π နဲ့ လှည့်ပြီး သုံးတယ်။
/// ★ Material တွေက mesh တစ်ခုချင်း သီးခြား — swap လုပ်တိုင်း disposeWeapon
///   နဲ့ ရှင်းရမယ် (GPU memory)။

const METAL = 0x3a3f4a;
const METAL_DARK = 0x23262e;
const WOOD = 0x7a5230;
const ACCENT = 0xb8bec9;

function part(
  g: THREE.Group,
  geo: THREE.BufferGeometry,
  color: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.35 }),
  );
  mesh.position.set(x, y, z);
  mesh.rotation.x = rx;
  mesh.castShadow = true;
  g.add(mesh);
  return mesh;
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (r: number, len: number) =>
  new THREE.CylinderGeometry(r, r, len, 8);

/// လက်နက်တစ်လက် ဆောက် — မသိတဲ့ kind ဆို ပစ္စတိုပုံစံ။
export function buildWeaponMesh(kind: string): THREE.Group {
  const g = new THREE.Group();
  switch (kind) {
    case "knife": {
      part(g, box(0.012, 0.05, 0.2), ACCENT, 0, 0.02, 0.13); // ဓားသွား
      part(g, box(0.02, 0.07, 0.03), METAL_DARK, 0, 0.01, 0.02); // လက်ကာ
      part(g, box(0.024, 0.028, 0.09), WOOD, 0, 0, -0.03); // ရိုး
      break;
    }
    case "bomb": {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x2e4630, roughness: 0.6 }),
      );
      body.castShadow = true;
      g.add(body);
      part(g, box(0.03, 0.03, 0.03), METAL, 0, 0.065, 0); // ထိပ်ခလုတ်
      break;
    }
    case "sniper": {
      part(g, cyl(0.016, 0.5), METAL, 0, 0.02, 0.3, Math.PI / 2); // ပြောင်းရှည်
      part(g, box(0.04, 0.06, 0.3), WOOD, 0, -0.01, 0.02); // ကိုယ်ထည်
      part(g, cyl(0.022, 0.1), METAL_DARK, 0, 0.065, 0.1, Math.PI / 2); // scope
      part(g, box(0.035, 0.08, 0.05), WOOD, 0, -0.05, -0.1); // ဒင်
      break;
    }
    case "smg": {
      part(g, cyl(0.015, 0.16), METAL, 0, 0.02, 0.16, Math.PI / 2);
      part(g, box(0.045, 0.07, 0.2), METAL_DARK, 0, 0, 0.02);
      part(g, box(0.03, 0.1, 0.04), METAL, 0, -0.07, 0.03); // ကျည်အိမ်ရှည်
      part(g, box(0.03, 0.05, 0.04), WOOD, 0, -0.04, -0.07); // ကိုင်ရိုး
      break;
    }
    case "shotgun": {
      part(g, cyl(0.02, 0.36), METAL, 0, 0.02, 0.22, Math.PI / 2);
      part(g, cyl(0.018, 0.14), WOOD, 0, -0.015, 0.18, Math.PI / 2); // ဆွဲတံ
      part(g, box(0.04, 0.06, 0.16), METAL_DARK, 0, 0, 0);
      part(g, box(0.04, 0.09, 0.07), WOOD, 0, -0.045, -0.09); // ဒင်
      break;
    }
    case "revolver": {
      part(g, cyl(0.014, 0.16), METAL, 0, 0.03, 0.12, Math.PI / 2);
      part(g, cyl(0.028, 0.05), METAL_DARK, 0, 0.015, 0.02, Math.PI / 2); // ကျည်လုံးအိမ်
      part(g, box(0.028, 0.07, 0.035), WOOD, 0, -0.035, -0.01, -0.25); // ကိုင်ရိုး
      break;
    }
    default: {
      // pistol
      part(g, box(0.03, 0.045, 0.17), METAL, 0, 0.025, 0.06); // ပြောင်း+slide
      part(g, box(0.026, 0.08, 0.045), METAL_DARK, 0, -0.03, -0.01, -0.18); // ကိုင်ရိုး
      break;
    }
  }
  return g;
}

/// Swap လုပ်တိုင်း အဟောင်းကို ရှင်း — geometry/material က GC မလုပ်ဘူး။
export function disposeWeapon(g: THREE.Group): void {
  g.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | undefined;
    if (mat) mat.dispose();
  });
}
