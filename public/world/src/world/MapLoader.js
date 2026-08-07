// ============================================================
// MapLoader.js — Blender ကထုတ်သော GLB မြို့/အဆောက်အအုံ Pipeline
// Room ထဲသို့ GLB map ထည့်ပြီး collision box များ အလိုအလျောက် ထုတ်ပေးသည်
//
// Blender နာမည်ပေးနည်း စည်းမျဉ်း (BLENDER_GUIDE.md တွင် အသေးစိတ်):
//   ပုံမှန် mesh        → မြင်ရ + collision အလိုအလျောက်ရ
//   NOCOL_ ဖြင့်စ        → မြင်ရ + collision မရ (ဆိုင်းဘုတ်၊ အလှပစ္စည်း)
//   COL_ ဖြင့်စ          → မမြင်ရ + collision သာရ (ရှုပ်ထွေး mesh အတွက် ရိုးရှင်း box)
// ============================================================
import * as THREE from 'three';
import { loadGLB } from '../core/Assets.js';

export async function loadCityMap(room, url, options = {}) {
  const {
    position = new THREE.Vector3(),
    scale = 1,
    rotationY = 0,
  } = options;

  const gltf = await loadGLB(url);
  const model = gltf.scene;
  model.position.copy(position);
  model.scale.setScalar(scale);
  model.rotation.y = rotationY;

  room.group.add(model);
  model.updateMatrixWorld(true); // world position မှန်မှ Box3 မှန်မည်

  let colliderCount = 0;
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const name = o.name || '';
    if (name.startsWith('COL_')) o.visible = false;      // collision box သီးသန့်
    if (!name.startsWith('NOCOL')) {                      // NOCOL_ မဟုတ်လျှင် collide
      room.addCollider(o);
      colliderCount++;
    }
  });

  console.log(`🗺️ Map loaded: ${url} (colliders: ${colliderCount})`);
  return model;
}
