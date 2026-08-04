import * as THREE from "three";

import {
  HEADSHOT_MULT,
  SPRAY_PATTERN,
  WEAPONS,
  type WeaponId,
} from "@gwave-strike/shared";

import type { Input } from "../core/input";

/// Hitscan weapon system (blueprint §2.3): data-driven stats, ADS FOV lerp,
/// CS-style spray pattern, reload. Ray hits are resolved by the caller
/// (against bots now, the server in Phase 3).

export type FireHit = {
  point: THREE.Vector3;
  targetId: string | null;
  head: boolean;
  dmg: number;
};

export type HitTarget = {
  id: string;
  /// world-space body + head spheres for cheap hit tests
  body: THREE.Sphere;
  head: THREE.Sphere;
};

export class WeaponSystem {
  weapon: WeaponId = "rifle";
  mag = WEAPONS.rifle.mag;
  reserve = WEAPONS.rifle.reserve;
  reloading = 0; // seconds remaining
  private cooldown = 0;
  private burst = 0; // consecutive shots for spray pattern
  private burstReset = 0;
  adsAmount = 0; // 0..1 smoothed

  private baseFov: number;
  private camera: THREE.PerspectiveCamera;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.baseFov = camera.fov;
  }

  switchTo(w: WeaponId) {
    if (this.weapon === w || this.reloading > 0) return;
    this.weapon = w;
    this.mag = Math.min(this.mag, WEAPONS[w].mag);
  }

  startReload() {
    const stats = WEAPONS[this.weapon];
    if (this.reloading > 0 || this.mag >= stats.mag || this.reserve <= 0) return;
    this.reloading = stats.reload;
  }

  /// Call every frame. Returns hits fired this frame (0 or 1 — hitscan).
  update(
    dt: number,
    input: Input,
    origin: THREE.Vector3,
    targets: HitTarget[],
    solidHit: (o: THREE.Vector3, d: THREE.Vector3) => number,
  ): FireHit | null {
    const stats = WEAPONS[this.weapon];

    // ADS — camera FOV lerp (gun model lerp rides on adsAmount)
    const wantAds = input.state.ads && this.reloading <= 0 ? 1 : 0;
    this.adsAmount += (wantAds - this.adsAmount) * Math.min(1, dt * 12);
    this.camera.fov =
      this.baseFov + (stats.adsFov - this.baseFov) * this.adsAmount;
    this.camera.updateProjectionMatrix();

    // Reload
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        const take = Math.min(stats.mag - this.mag, this.reserve);
        this.mag += take;
        this.reserve -= take;
        this.reloading = 0;
      }
    }
    if (input.state.reload) this.startReload();

    // Spray pattern decay
    this.burstReset -= dt;
    if (this.burstReset <= 0) this.burst = 0;

    this.cooldown -= dt;
    if (!input.state.fire || this.cooldown > 0 || this.reloading > 0) {
      return null;
    }
    if (this.mag <= 0) {
      this.startReload();
      return null;
    }

    // ── Fire one round ──
    this.mag -= 1;
    this.cooldown = 60 / stats.rpm;
    this.burstReset = 0.35;
    const shot = SPRAY_PATTERN[Math.min(this.burst, SPRAY_PATTERN.length - 1)] ?? [1, 0];
    this.burst += 1;

    // View kick (recoil) — pattern scaled by weapon recoil
    input.kick(stats.recoil * shot[0], stats.recoil * shot[1] * 0.4);

    // Direction with spread
    const spread =
      stats.spreadHip + (stats.spreadADS - stats.spreadHip) * this.adsAmount;
    const dir = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(this.camera.quaternion)
      .add(
        new THREE.Vector3(
          (Math.random() - 0.5) * spread * 2,
          (Math.random() - 0.5) * spread * 2,
          0,
        ).applyQuaternion(this.camera.quaternion),
      )
      .normalize();

    // Nearest target hit (head > body), clipped by world geometry
    const wallDist = solidHit(origin, dir);
    const ray = new THREE.Ray(origin, dir);
    let best: { d: number; id: string; head: boolean } | null = null;
    const tmp = new THREE.Vector3();
    for (const t of targets) {
      const headHit = ray.intersectSphere(t.head, tmp);
      if (headHit) {
        const d = headHit.distanceTo(origin);
        if (d < wallDist && (!best || d < best.d)) {
          best = { d, id: t.id, head: true };
        }
        continue;
      }
      const bodyHit = ray.intersectSphere(t.body, tmp);
      if (bodyHit) {
        const d = bodyHit.distanceTo(origin);
        if (d < wallDist && (!best || d < best.d)) {
          best = { d, id: t.id, head: false };
        }
      }
    }

    const dist = best ? best.d : Math.min(wallDist, 300);
    return {
      point: origin.clone().add(dir.multiplyScalar(dist)),
      targetId: best?.id ?? null,
      head: best?.head ?? false,
      dmg: best
        ? Math.round(stats.dmg * (best.head ? HEADSHOT_MULT : 1))
        : 0,
    };
  }
}
