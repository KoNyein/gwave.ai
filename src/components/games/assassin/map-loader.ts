import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/// GLB/GLTF ကွင်း တင်ခြင်း + မြေပြင်အမြင့် တွက်ခြင်း။
///
/// ★ ဘာလို့ ဒီ file သီးခြားလဲ — ကွင်းက procedural box တွေ ဖြစ်ချင်ဖြစ်မယ်၊
///   ပန်းချီဆရာ ဆွဲထားတဲ့ .glb ဖြစ်ချင်ဖြစ်မယ်။ ဂိမ်း code က ဘယ်ဟာလဲ
///   မသိစရာမလိုဘဲ "ဒီနေရာမှာ မြေက ဘယ်လောက်မြင့်လဲ" ဆိုတာပဲ မေးတယ်။

export type LoadedMap = {
  root: THREE.Group;
  /// Raycast လုပ်မယ့် မြေပြင် mesh များ
  ground: THREE.Object3D[];
  /// Model ရဲ့ အမြင့်ဆုံးအထက် — ray ကို ဒီကနေ အောက်ပစ်တယ်
  rayTop: number;
};

/// .glb တစ်ခု တင်တယ်။ `onProgress` က ၀–၁၀၀။
///
/// ★ URL က **ကိုယ့် origin/S3** ကနေသာ ဖြစ်ရမယ် — CSP က ပြင်ပ host ကို
///   ပိတ်ထားတယ်၊ ပြီးတော့ ပြင်ပ CDN တစ်ခု ကျရင် ဂိမ်းက ပါကျမယ်။
export function loadMap(
  url: string,
  onProgress?: (percent: number) => void,
): Promise<LoadedMap> {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(
      url,
      (gltf) => {
        const root = gltf.scene;
        const ground: THREE.Object3D[] = [];
        root.traverse((node) => {
          if (!(node instanceof THREE.Mesh)) return;
          node.castShadow = true;
          node.receiveShadow = true;
          ground.push(node);
        });
        // ★ Ray ကို စပစ်မယ့် အမြင့်ကို **model ကနေ တွက်တယ်** — ကိန်းသေ
        //   (ဥပမာ ၂၀၀) ထားလိုက်ရင် အဲဒီထက်မြင့်တဲ့ ကွင်းမှာ ray က တောင်ထိပ်
        //   အောက်ကနေ စပြီး ကစားသမားက မြေထဲ နစ်သွားမယ်။
        const box = new THREE.Box3().setFromObject(root);
        const rayTop = (Number.isFinite(box.max.y) ? box.max.y : 100) + 50;
        resolve({ root, ground, rayTop });
      },
      (xhr) => {
        if (!onProgress) return;
        // ★ `xhr.total` က server မှာ Content-Length မပါရင် ၀ ဖြစ်တယ် —
        //   အဲဒီအခါ ရာခိုင်နှုန်း မတွက်နိုင်ဘူး (0/0 = NaN)。
        if (xhr.total > 0) onProgress(Math.round((xhr.loaded / xhr.total) * 100));
      },
      (err) => reject(err instanceof Error ? err : new Error(String(err))),
    );
  });
}

/// မြေပြင်အမြင့် စစ်ဆေးစက် — ကစားသမားက ကုန်း/ချောက် ပေါ်မှာ လိုက်နေအောင်။
///
/// ★ Frame တိုင်း raycast လုပ်တာ ဈေးကြီးတယ် (mesh ထောင်ချီရှိတဲ့ ကွင်းမှာ) —
///   ဒါကြောင့် နေရာ သိသိသာသာ မရွှေ့ရင် အဟောင်းကို ပြန်သုံးတယ်။
/// ★ Ray က ဘာမှ မထိရင် **အဟောင်းကို ကိုင်ထားတယ်** — 0 ပြန်ပေးလိုက်ရင်
///   ကွင်းအနားရောက်တိုင်း ကစားသမား ပြုတ်ကျသွားမယ်။
export function createGroundSampler(map: LoadedMap | null) {
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const origin = new THREE.Vector3();
  let lastX = Number.NaN;
  let lastZ = Number.NaN;
  let lastY = 0;

  return {
    /// (x, z) မှာ မြေပြင်ရဲ့ အမြင့်။ ကွင်းမရှိရင် အမြဲ ၀ (ပြားချပ်ချပ်)。
    heightAt(x: number, z: number): number {
      if (!map) return 0;
      if (Math.abs(x - lastX) < 0.15 && Math.abs(z - lastZ) < 0.15) return lastY;
      lastX = x;
      lastZ = z;
      origin.set(x, map.rayTop, z);
      ray.set(origin, down);
      const hits = ray.intersectObjects(map.ground, false);
      const first = hits[0];
      if (first) lastY = first.point.y;
      return lastY;
    },
  };
}
