import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { MAX_HP, MAP_HALF, RESPAWN_S, WEAPONS } from "@gwave-strike/shared";

import { terrainHeight } from "../world/world";
import { Soldier } from "./soldier";
import type { HitTarget } from "../player/weapons";

/// Client-side bot AI (Phase 1 baseline — moves server-side in Phase 3).
/// Wander → spot player (range + rough LOS via wall ray callback) → strafe +
/// fire with generous spread. Fills both teams so TDM is playable solo.

export type BotHitResult = { died: boolean };

export type Bot = {
  id: string;
  team: number;
  soldier: Soldier;
  pos: THREE.Vector3;
  yaw: number;
  hp: number;
  respawnAt: number;
  wander: THREE.Vector3;
  fireCooldown: number;
  strafeDir: number;
};

const SPOT_RANGE = 42;
const FIRE_RANGE = 34;
const BOT_SPEED = 3.6;

export class BotManager {
  bots: Bot[] = [];
  private scene: THREE.Scene;

  constructor(
    scene: THREE.Scene,
    loader: GLTFLoader,
    soldierUrl: string,
    perTeam: number,
  ) {
    this.scene = scene;
    for (let team = 0; team <= 1; team++) {
      for (let i = 0; i < perTeam; i++) {
        const soldier = new Soldier(
          loader,
          soldierUrl,
          team === 0 ? 0x7799ff : 0xff8877,
        );
        const pos = this.spawnPoint(team);
        soldier.group.position.copy(pos);
        scene.add(soldier.group);
        this.bots.push({
          id: `bot-${team}-${i}`,
          team,
          soldier,
          pos,
          yaw: 0,
          hp: MAX_HP,
          respawnAt: 0,
          wander: pos.clone(),
          fireCooldown: 1,
          strafeDir: i % 2 === 0 ? 1 : -1,
        });
      }
    }
  }

  private spawnPoint(team: number): THREE.Vector3 {
    const x = (Math.random() * 2 - 1) * (MAP_HALF - 20);
    const z = (team === 0 ? -1 : 1) * (MAP_HALF - 25 + Math.random() * 10);
    return new THREE.Vector3(x, terrainHeight(x, z), z);
  }

  targets(forTeam: number): HitTarget[] {
    return this.bots
      .filter((b) => b.hp > 0 && b.team !== forTeam)
      .map((b) => ({
        id: b.id,
        body: new THREE.Sphere(
          b.pos.clone().add(new THREE.Vector3(0, 0.95, 0)),
          0.45,
        ),
        head: new THREE.Sphere(
          b.pos.clone().add(new THREE.Vector3(0, 1.62, 0)),
          0.18,
        ),
      }));
  }

  /// Damage a bot by id; returns whether it died (for the killfeed)
  hit(id: string, dmg: number, now: number): BotHitResult {
    const b = this.bots.find((x) => x.id === id);
    if (!b || b.hp <= 0) return { died: false };
    b.hp -= dmg;
    if (b.hp <= 0) {
      b.soldier.die();
      b.respawnAt = now + RESPAWN_S * 1000;
      return { died: true };
    }
    return { died: false };
  }

  /// Returns damage dealt to the player this frame (bots shooting back)
  update(
    dt: number,
    now: number,
    playerPos: THREE.Vector3,
    playerAlive: boolean,
    wallDist: (o: THREE.Vector3, d: THREE.Vector3) => number,
    onTracer: (from: THREE.Vector3, to: THREE.Vector3) => void,
  ): number {
    let dmgToPlayer = 0;
    const rifle = WEAPONS.rifle;

    for (const b of this.bots) {
      b.soldier.update(dt);
      if (b.hp <= 0) {
        if (now >= b.respawnAt) {
          b.hp = MAX_HP;
          b.pos.copy(this.spawnPoint(b.team));
          b.soldier.revive();
        }
        continue;
      }

      // BLUE bots fight alongside the player (player is BLUE) — everyone
      // targets the nearest living enemy; only RED bots also consider the
      // player as a target.
      const enemies: { pos: THREE.Vector3; isPlayer: boolean }[] = this.bots
        .filter((e) => e.hp > 0 && e.team !== b.team)
        .map((e) => ({ pos: e.pos, isPlayer: false }));
      if (b.team === 1 && playerAlive) {
        enemies.push({ pos: playerPos, isPlayer: true });
      }
      let target: { pos: THREE.Vector3; isPlayer: boolean } | null = null;
      let bestD = SPOT_RANGE;
      for (const e of enemies) {
        const d = b.pos.distanceTo(e.pos);
        if (d < bestD) {
          bestD = d;
          target = e;
        }
      }

      let speed = 0;
      if (target) {
        b.yaw = Math.atan2(target.pos.x - b.pos.x, target.pos.z - b.pos.z);
        // Strafe at combat range, close otherwise
        if (bestD > FIRE_RANGE * 0.7) {
          const dir = target.pos.clone().sub(b.pos).setY(0).normalize();
          b.pos.addScaledVector(dir, BOT_SPEED * dt);
          speed = BOT_SPEED;
        } else {
          const side = new THREE.Vector3(
            Math.cos(b.yaw),
            0,
            -Math.sin(b.yaw),
          ).multiplyScalar(b.strafeDir * BOT_SPEED * 0.6 * dt);
          b.pos.add(side);
          speed = BOT_SPEED * 0.6;
          if (Math.random() < dt * 0.4) b.strafeDir *= -1;
        }

        // Fire
        b.fireCooldown -= dt;
        if (bestD < FIRE_RANGE && b.fireCooldown <= 0) {
          b.fireCooldown = 60 / rifle.rpm + 0.25 + Math.random() * 0.3;
          b.soldier.play("fire");
          const muzzle = b.pos.clone().add(new THREE.Vector3(0, 1.4, 0));
          const aim = target.pos
            .clone()
            .add(new THREE.Vector3(0, target.isPlayer ? 1.4 : 1.0, 0));
          // Generous miss cone — bots must be beatable
          aim.x += (Math.random() - 0.5) * bestD * 0.14;
          aim.y += (Math.random() - 0.5) * bestD * 0.1;
          aim.z += (Math.random() - 0.5) * bestD * 0.14;
          const dir = aim.sub(muzzle).normalize();
          const wall = wallDist(muzzle, dir);
          if (wall > bestD - 1) {
            onTracer(
              muzzle,
              muzzle.clone().add(dir.clone().multiplyScalar(bestD)),
            );
            if (target.isPlayer && Math.random() < 0.55) {
              dmgToPlayer += Math.round(rifle.dmg * 0.5);
            }
          }
        }
      } else {
        // Wander
        if (b.pos.distanceTo(b.wander) < 2 || Math.random() < dt * 0.1) {
          b.wander.set(
            (Math.random() * 2 - 1) * (MAP_HALF - 15),
            0,
            (Math.random() * 2 - 1) * (MAP_HALF - 15),
          );
        }
        const dir = b.wander.clone().sub(b.pos).setY(0);
        if (dir.lengthSq() > 1) {
          dir.normalize();
          b.pos.addScaledVector(dir, BOT_SPEED * 0.55 * dt);
          b.yaw = Math.atan2(dir.x, dir.z);
          speed = BOT_SPEED * 0.55;
        }
      }

      b.pos.y = terrainHeight(b.pos.x, b.pos.z);
      b.soldier.group.position.copy(b.pos);
      b.soldier.group.rotation.y = b.yaw;
      b.soldier.locomotion(speed, Boolean(target));
    }
    return dmgToPlayer;
  }
}
