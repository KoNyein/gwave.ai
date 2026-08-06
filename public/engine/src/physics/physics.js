// physics/physics.js — Rapier world + character controller (spec §4)
// Rapier (Rust→WASM) loads from the CDN; if that fails the engine falls back
// to a kinematic AABB physics-lite so the game still runs (spec requirement).
// Both backends expose the SAME api — nothing else in the engine may branch
// on which one is active.

export async function createPhysics() {
  try {
    const mod = await import(
      "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.12.0/rapier.mjs"
    );
    const RAPIER = mod.default ?? mod;
    await RAPIER.init();
    return new RapierPhysics(RAPIER);
  } catch (err) {
    console.warn("[physics] Rapier unavailable — AABB lite fallback", err);
    return new LitePhysics();
  }
}

class RapierPhysics {
  constructor(RAPIER) {
    this.RAPIER = RAPIER;
    this.kind = "rapier";
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    // spec §4.3 — stairs autostep, slope snap, push dynamic crates
    this.controller = this.world.createCharacterController(0.02);
    this.controller.enableAutostep(0.4, 0.2, true);
    this.controller.enableSnapToGround(0.5);
    this.controller.setApplyImpulsesToDynamicBodies(true);
    this.bodies = new Map(); // entityId -> { body, collider }
    // static ground plane
    const g = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(300, 0.1, 300).setTranslation(0, -0.1, 0), g);
  }

  addBody(entity, pos, rb) {
    const R = this.RAPIER;
    let desc;
    if (rb.type === "dynamic") desc = R.RigidBodyDesc.dynamic();
    else if (rb.type === "kinematicPosition") desc = R.RigidBodyDesc.kinematicPositionBased();
    else desc = R.RigidBodyDesc.fixed();
    desc.setTranslation(pos[0], pos[1], pos[2]);
    const body = this.world.createRigidBody(desc);

    const size = rb.size ?? [1, 1, 1];
    let col;
    if (rb.collider === "ball") col = R.ColliderDesc.ball(size[0] / 2);
    else if (rb.collider === "capsule")
      col = R.ColliderDesc.capsule(Math.max(0.01, size[1] / 2 - size[0] / 2), size[0] / 2);
    else col = R.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2);
    if (rb.sensor) col.setSensor(true);
    const collider = this.world.createCollider(col, body);
    this.bodies.set(entity.id, { body, collider });
  }

  removeBody(entity) {
    const rec = this.bodies.get(entity.id);
    if (!rec) return;
    this.world.removeRigidBody(rec.body);
    this.bodies.delete(entity.id);
  }

  /** kinematic character move — returns { pos:[x,y,z], grounded } */
  moveCharacter(entity, desired) {
    const rec = this.bodies.get(entity.id);
    if (!rec) return null;
    this.controller.computeColliderMovement(rec.collider, desired);
    const mv = this.controller.computedMovement();
    const p = rec.body.translation();
    const next = { x: p.x + mv.x, y: p.y + mv.y, z: p.z + mv.z };
    rec.body.setNextKinematicTranslation(next);
    return { pos: [next.x, next.y, next.z], grounded: this.controller.computedGrounded() };
  }

  setKinematicPos(entity, pos) {
    this.bodies
      .get(entity.id)
      ?.body.setNextKinematicTranslation({ x: pos[0], y: pos[1], z: pos[2] });
  }

  posOf(entity) {
    const rec = this.bodies.get(entity.id);
    if (!rec) return null;
    const p = rec.body.translation();
    return [p.x, p.y, p.z];
  }

  step(dt) {
    this.world.timestep = dt;
    this.world.step();
  }

  clear() {
    for (const rec of this.bodies.values()) this.world.removeRigidBody(rec.body);
    this.bodies.clear();
  }
}

/// AABB physics-lite — kinematic characters vs static boxes + ground plane.
class LitePhysics {
  constructor() {
    this.kind = "lite";
    this.boxes = new Map(); // entityId -> { min, max }
    this.chars = new Map(); // entityId -> { pos, half }
  }
  addBody(entity, pos, rb) {
    const size = rb.size ?? [1, 1, 1];
    if (rb.type === "kinematicPosition" && rb.collider === "capsule") {
      this.chars.set(entity.id, {
        pos: [...pos],
        half: [size[0] / 2, size[1] / 2, size[0] / 2],
      });
    } else if (!rb.sensor && rb.type !== "dynamic") {
      this.boxes.set(entity.id, {
        min: [pos[0] - size[0] / 2, pos[1] - size[1] / 2, pos[2] - size[2] / 2],
        max: [pos[0] + size[0] / 2, pos[1] + size[1] / 2, pos[2] + size[2] / 2],
      });
    }
  }
  removeBody(entity) {
    this.chars.delete(entity.id);
    this.boxes.delete(entity.id);
  }
  moveCharacter(entity, desired) {
    const c = this.chars.get(entity.id);
    if (!c) return null;
    const next = [c.pos[0] + desired.x, c.pos[1] + desired.y, c.pos[2] + desired.z];
    let grounded = false;
    if (next[1] - c.half[1] <= 0) {
      next[1] = c.half[1];
      grounded = true;
    }
    for (const b of this.boxes.values()) {
      const inX = next[0] > b.min[0] - c.half[0] && next[0] < b.max[0] + c.half[0];
      const inZ = next[2] > b.min[2] - c.half[2] && next[2] < b.max[2] + c.half[2];
      const inY = next[1] - c.half[1] < b.max[1] && next[1] + c.half[1] > b.min[1];
      if (!(inX && inZ && inY)) continue;
      // land on top when falling onto it
      if (c.pos[1] - c.half[1] >= b.max[1] - 0.08 && desired.y <= 0) {
        next[1] = b.max[1] + c.half[1];
        grounded = true;
        continue;
      }
      const dxl = next[0] - (b.min[0] - c.half[0]);
      const dxr = b.max[0] + c.half[0] - next[0];
      const dzl = next[2] - (b.min[2] - c.half[2]);
      const dzr = b.max[2] + c.half[2] - next[2];
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) next[0] = b.min[0] - c.half[0];
      else if (m === dxr) next[0] = b.max[0] + c.half[0];
      else if (m === dzl) next[2] = b.min[2] - c.half[2];
      else next[2] = b.max[2] + c.half[2];
    }
    c.pos = next;
    return { pos: [...next], grounded };
  }
  setKinematicPos(entity, pos) {
    const c = this.chars.get(entity.id);
    if (c) c.pos = [...pos];
  }
  posOf(entity) {
    return this.chars.get(entity.id)?.pos ?? null;
  }
  step() {}
  clear() {
    this.boxes.clear();
    this.chars.clear();
  }
}

/// Transform-space distance check for sensor behaviors — identical on both
/// physics backends because it reads component data, not bodies.
export function within(aPos, bPos, dist) {
  const dx = aPos[0] - bPos[0];
  const dy = aPos[1] - bPos[1];
  const dz = aPos[2] - bPos[2];
  return dx * dx + dy * dy + dz * dz < dist * dist;
}
