// ============================================================
// Assets.js — GLB/GLTF မော်ဒယ်များ Load လုပ်ရန် (cache ပါ)
// Avatar, NPC, Building, Map… မည်သည့် GLB မဆို ဤမှတဆင့် ခေါ်ပါ
// ============================================================
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map();

// gltf = { scene, animations, ... } ပြန်ရသည်
export async function loadGLB(url) {
  if (cache.has(url)) return cache.get(url);
  const promise = new Promise((resolve, reject) =>
    loader.load(url, resolve, undefined, reject)
  );
  cache.set(url, promise);
  return promise;
}
