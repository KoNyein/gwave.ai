import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import type { Soldier } from "./soldier.js";

/// 🧬 Scan avatars on STRIKE soldiers — the same face GLBs the metaverse
/// rooms wear (avatar spec §9), riding the soldier rig instead:
///  - face plate rigid-attached to the head bone (inherits every animation)
///  - body proportions from the scan morphs (height/shoulder), VISUAL ONLY —
///    the server capsule and hit spheres are untouched, so a tall avatar is
///    not a bigger hitbox and competitive fairness holds.
///
/// Config comes from gwave.cc's public read /api/avatar?userId= — the game
/// is served same-origin (gwave.cc/strike), so plain fetch works; in local
/// dev the endpoint 404s and everything silently stays plain soldiers.

const CACHE_MAX = 16;
const FETCH_TTL_MS = 5 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AvatarInfo = {
  faceGlbUrl: string | null;
  height: number; // morph -1..1
  shoulder: number; // morph -1..1
};

export type OwnAvatar = { userId: string | null; info: AvatarInfo | null };

/// Own avatar id (to announce to the room) + config. Never throws.
export async function fetchOwnAvatar(): Promise<OwnAvatar> {
  try {
    const res = await fetch("/api/avatar", { cache: "no-store" });
    if (!res.ok) return { userId: null, info: null };
    const d = (await res.json()) as {
      userId?: string;
      config?: { faceGlbUrl?: string | null; morphs?: Record<string, number> };
    };
    const userId =
      typeof d.userId === "string" && UUID.test(d.userId) ? d.userId : null;
    return { userId, info: d.config ? toInfo(d.config) : null };
  } catch {
    return { userId: null, info: null };
  }
}

function toInfo(config: {
  faceGlbUrl?: string | null;
  morphs?: Record<string, number>;
}): AvatarInfo {
  const m = config.morphs ?? {};
  const clamp = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.max(-1, Math.min(1, v))
      : 0;
  return {
    faceGlbUrl:
      typeof config.faceGlbUrl === "string" && config.faceGlbUrl
        ? config.faceGlbUrl
        : null,
    height: clamp(m["height"]),
    shoulder: clamp(m["shoulderWidth"]),
  };
}

export class ScanAvatars {
  private infos = new Map<string, { info: AvatarInfo | null; at: number }>();
  private models = new Map<string, { scene: THREE.Group | null; at: number }>();
  private pending = new Set<string>();

  constructor(private loader: GLTFLoader) {}

  /// Attach the scan face + proportions for a player to their soldier.
  /// Silent no-op for bots, guests and scan-less players.
  apply(avatarId: string, soldier: Soldier) {
    if (!UUID.test(avatarId)) return;
    void this.run(avatarId, soldier);
  }

  private async run(avatarId: string, soldier: Soldier) {
    const known = this.infos.get(avatarId);
    if (!known || Date.now() - known.at >= FETCH_TTL_MS) {
      if (this.pending.has(avatarId)) return;
      this.pending.add(avatarId);
      try {
        const res = await fetch(
          `/api/avatar?userId=${encodeURIComponent(avatarId)}`,
        );
        const d = (await res.json().catch(() => null)) as {
          config?: { faceGlbUrl?: string | null; morphs?: Record<string, number> };
        } | null;
        this.infos.set(avatarId, {
          info: d?.config ? toInfo(d.config) : null,
          at: Date.now(),
        });
      } catch {
        this.infos.set(avatarId, { info: null, at: Date.now() });
      } finally {
        this.pending.delete(avatarId);
      }
    }
    const info = this.infos.get(avatarId)?.info;
    if (!info) return;
    soldier.onReady((model) => {
      this.proportion(model, info);
      if (info.faceGlbUrl) this.attachFace(info.faceGlbUrl, soldier);
    });
  }

  /// Visual-only body proportions (±12% height, ±10% width) on top of the
  /// rig's normalization scale.
  private proportion(model: THREE.Object3D, info: AvatarInfo) {
    if (model.userData["scanProportioned"]) return;
    model.userData["scanProportioned"] = true;
    model.scale.y *= 1 + 0.12 * info.height;
    const w = 1 + 0.1 * info.shoulder;
    model.scale.x *= w;
    model.scale.z *= w;
  }

  private attachFace(url: string, soldier: Soldier) {
    const place = (scene: THREE.Group) => {
      const head = soldier.headBone();
      if (!head || head.getObjectByName("scanface-plate")) return;
      const plate = scene.clone();
      plate.name = "scanface-plate";
      // Bones inherit the model's normalization scale — compensate so the
      // face renders at real-world size, sitting on the head's front.
      const ws = new THREE.Vector3();
      head.getWorldScale(ws);
      const inv = ws.x !== 0 ? 1 / ws.x : 1;
      plate.scale.setScalar(inv);
      plate.position.set(0, 0.06 * inv, 0.11 * inv);
      head.add(plate);
    };

    const cached = this.models.get(url);
    if (cached) {
      cached.at = Date.now();
      if (cached.scene) place(cached.scene);
      return;
    }
    this.loader.load(
      url,
      (g) => {
        this.models.set(url, { scene: g.scene, at: Date.now() });
        this.evict();
        place(g.scene);
      },
      undefined,
      () => {
        // Broken/404 GLB — remember the failure so we never re-fetch it.
        this.models.set(url, { scene: null, at: Date.now() });
      },
    );
  }

  private evict() {
    while (this.models.size > CACHE_MAX) {
      let oldest: string | null = null;
      let oldestAt = Infinity;
      for (const [k, v] of this.models) {
        if (v.at < oldestAt) {
          oldestAt = v.at;
          oldest = k;
        }
      }
      if (!oldest) return;
      const e = this.models.get(oldest);
      this.models.delete(oldest);
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
  }
}
