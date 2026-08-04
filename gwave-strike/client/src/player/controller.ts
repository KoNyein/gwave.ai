import * as THREE from "three";
import type RAPIER_NS from "@dimforge/rapier3d-compat";

import { MOVE } from "@gwave-strike/shared";

import type { Input } from "../core/input";
import { terrainHeight } from "../world/world";

/// FPS controller — Rapier kinematic capsule + built-in character controller
/// (slide on walls/stairs, blueprint §2.2). Client-predicts with the SAME
/// constants the server sim uses (shared/).

export class PlayerController {
  readonly body: RAPIER_NS.RigidBody;
  readonly collider: RAPIER_NS.Collider;
  private ctrl: RAPIER_NS.KinematicCharacterController;
  private physics: RAPIER_NS.World;
  private vy = 0;
  private grounded = false;
  crouching = false;

  constructor(RAPIER: typeof RAPIER_NS, physics: RAPIER_NS.World, spawn: THREE.Vector3) {
    this.physics = physics;
    this.body = physics.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        spawn.x,
        spawn.y,
        spawn.z,
      ),
    );
    const half = MOVE.capsuleHeight / 2 - MOVE.capsuleRadius;
    this.collider = physics.createCollider(
      RAPIER.ColliderDesc.capsule(half, MOVE.capsuleRadius),
      this.body,
    );
    this.ctrl = physics.createCharacterController(0.05);
    this.ctrl.enableAutostep(0.45, 0.25, true);
    this.ctrl.enableSnapToGround(0.4);
    this.ctrl.setMaxSlopeClimbAngle((55 * Math.PI) / 180);
  }

  get position(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  eyeHeight(): number {
    return this.crouching ? MOVE.crouchEyeHeight : MOVE.eyeHeight;
  }

  update(dt: number, input: Input, ads: boolean) {
    const s = input.state;
    this.crouching = s.crouch;

    // Wish direction in world space from yaw
    const sin = Math.sin(s.yaw);
    const cos = Math.cos(s.yaw);
    const wishX = -sin * s.f + cos * s.s;
    const wishZ = -cos * s.f - sin * s.s;
    const len = Math.hypot(wishX, wishZ) || 1;

    let speed = s.run && s.f > 0 ? MOVE.run : MOVE.walk;
    if (this.crouching) speed *= MOVE.crouchScale;
    if (ads) speed *= MOVE.adsScale;

    // Gravity + jump
    if (this.grounded && s.jump) this.vy = MOVE.jumpVel;
    this.vy -= MOVE.gravity * dt;

    const move = {
      x: (wishX / len) * speed * dt,
      y: this.vy * dt,
      z: (wishZ / len) * speed * dt,
    };
    this.ctrl.computeColliderMovement(this.collider, move);
    const out = this.ctrl.computedMovement();
    const t = this.body.translation();
    this.body.setNextKinematicTranslation({
      x: t.x + out.x,
      y: t.y + out.y,
      z: t.z + out.z,
    });
    this.grounded = this.ctrl.computedGrounded();
    if (this.grounded && this.vy < 0) this.vy = 0;

    // Safety net: never fall through the world
    const nt = this.body.translation();
    const floor = terrainHeight(nt.x, nt.z) + MOVE.capsuleHeight / 2;
    if (nt.y < floor - 3) {
      this.body.setNextKinematicTranslation({ x: nt.x, y: floor + 1, z: nt.z });
      this.vy = 0;
    }
    this.physics.step();
  }
}
