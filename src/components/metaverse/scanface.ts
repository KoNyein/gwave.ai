import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import type { Avatar } from "./human";

/// 🧬 Scan-face plates in rooms (avatar spec §9 — Phase 4 v1)။
///
/// Social room ထဲက avatar (ကိုယ်ရော remote ရော) ခေါင်းမှာ သူ့ရဲ့
/// scan မျက်နှာ GLB ကို rigid attach လုပ်တယ်။
///
/// ★ Remote ရဲ့ config ကို **public API** (/api/avatar?userId=) ကနေ ဆွဲတယ် —
///   authed player ရဲ့ metaverse id က profile id မို့ တိုက်ရိုက် သုံးလို့ရတယ်၊
///   guest (g_…) / bot (bot:…) တွေကို မမေးဘူး။ Server protocol အသစ် မလိုဘူး။
/// ★ GLB cache — user တစ်ယောက်ရဲ့ မျက်နှာကို တစ်ခါပဲ ဆွဲပြီး clone တွေက
///   geometry/material မျှသုံးတယ် (GPU memory ကာကွယ်, spec §9 LOD သဘော)။
///   Cache က ၁၆ ယောက် — ကျော်ရင် အဟောင်းဆုံးကို ဖယ်ပြီး GPU resource ရှင်း။
/// ★ Room ပြောင်း/remote ထွက်ရင် plate က avatar group နဲ့အတူ ပျောက်တယ် —
///   shared resource တွေ cache မှာပဲ ရှိလို့ per-remote dispose မလိုဘူး။

const CACHE_MAX = 16;
const FETCH_TTL_MS = 5 * 60 * 1000;

type CacheEntry = { scene: THREE.Group | null; at: number };

export type ScanFaces = {
  /// Avatar တစ်ခုအတွက် user ရဲ့ scan face ရှိရင် တပ်ပေး (async, silent fail)
  attachFor(userId: string, avatar: Avatar): void;
  /// URL သိပြီးသား (ကိုယ့် avatar — metaverse avatar API က ပေး) — တိုက်ရိုက်တပ်
  attachUrl(avatar: Avatar, url: string): void;
  dispose(): void;
};

export function createScanFaces(): ScanFaces {
  const loader = new GLTFLoader();
  /// userId → face URL (null = scan မရှိ) — fetch ထပ်မမေးအောင်
  const urls = new Map<string, { url: string | null; at: number }>();
  const models = new Map<string, CacheEntry>();
  const pending = new Set<string>();
  let disposed = false;

  const evict = () => {
    while (models.size > CACHE_MAX) {
      let oldest: string | null = null;
      let oldestAt = Infinity;
      for (const [k, v] of models) {
        if (v.at < oldestAt) {
          oldestAt = v.at;
          oldest = k;
        }
      }
      if (!oldest) return;
      const e = models.get(oldest);
      models.delete(oldest);
      e?.scene?.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (m instanceof THREE.MeshStandardMaterial) m.map?.dispose();
            m.dispose();
          }
        }
      });
    }
  };

  const attach = (avatar: Avatar, scene: THREE.Group) => {
    // ထပ်တပ်ပြီးသားလား — head ထဲ scanned-face ရှိရင် မတပ်တော့ဘူး
    const head = avatar.attach.head;
    if (head.getObjectByName("scanface-plate")) return;
    const plate = scene.clone();
    plate.name = "scanface-plate";
    const ws = new THREE.Vector3();
    head.getWorldScale(ws);
    const inv = ws.x !== 0 ? 1 / ws.x : 1;
    plate.scale.setScalar(inv);
    // Procedural head (radius ~0.12) ရဲ့ ရှေ့ဘက် — မျက်နှာစာ နေရာ
    plate.position.set(0, 0.11 * inv, 0.1 * inv);
    head.add(plate);
  };

  const loadAndAttach = (url: string, avatar: Avatar) => {
    const cached = models.get(url);
    if (cached) {
      cached.at = Date.now();
      if (cached.scene) attach(avatar, cached.scene);
      return;
    }
    loader.load(
      url,
      (g) => {
        if (disposed) return;
        models.set(url, { scene: g.scene, at: Date.now() });
        evict();
        attach(avatar, g.scene);
      },
      undefined,
      () => {
        // GLB ပျက်/404 — နောက်တစ်ခါ ထပ်မကြိုးစားအောင် null မှတ်
        models.set(url, { scene: null, at: Date.now() });
      },
    );
  };

  return {
    attachUrl(avatar, url) {
      if (!disposed) loadAndAttach(url, avatar);
    },
    attachFor(userId, avatar) {
      if (disposed) return;
      // Guest/bot/မမှန်တဲ့ id — profile မဟုတ်လို့ မမေးဘူး
      if (!/^[0-9a-f-]{36}$/i.test(userId)) return;
      const run = async () => {
        if (pending.has(userId)) return;
        const known = urls.get(userId);
        const now = Date.now();
        if (known && now - known.at < FETCH_TTL_MS) {
          if (!known.url) return;
        } else {
          pending.add(userId);
          try {
            const res = await fetch(
              `/api/avatar?userId=${encodeURIComponent(userId)}`,
            );
            const d = (await res.json().catch(() => null)) as {
              config?: { faceGlbUrl?: string | null };
            } | null;
            urls.set(userId, {
              url: d?.config?.faceGlbUrl ?? null,
              at: Date.now(),
            });
          } catch {
            urls.set(userId, { url: null, at: Date.now() });
          } finally {
            pending.delete(userId);
          }
        }
        const url = urls.get(userId)?.url;
        if (!url || disposed) return;
        loadAndAttach(url, avatar);
      };
      void run();
    },
    dispose() {
      disposed = true;
      for (const [, e] of models) {
        e.scene?.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of mats) {
              if (m instanceof THREE.MeshStandardMaterial) m.map?.dispose();
              m.dispose();
            }
          }
        });
      }
      models.clear();
      urls.clear();
    },
  };
}
