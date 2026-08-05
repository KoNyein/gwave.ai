import * as THREE from "three";
import type { GLTFLoader, GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";

/// Soldier GLB + animation FSM (blueprint §2.4).
/// Phase 1 uses the placeholder rig (soldier-placeholder.glb — a rigged kit
/// character whose clip names differ from Mixamo); CLIP_MAP translates FSM
/// states to whatever clips the loaded rig actually has, so swapping in the
/// real Vanguard GLB in Phase 2 is a map change, not a code change.
/// `SkeletonUtils.clone` is mandatory for per-instance skinned copies
/// (blueprint §13-style pitfall).

export type SoldierState =
  | "idle"
  | "walk"
  | "run"
  | "aim"
  | "fire"
  | "reload"
  | "death";

const CLIP_MAP: Record<SoldierState, string[]> = {
  idle: ["Rifle Aiming Idle", "Idle", "idle"],
  walk: ["Walk", "walk"],
  run: ["RunRifle", "Run", "sprint"],
  aim: ["Aim", "holding-right", "idle"],
  fire: ["Fire", "holding-right-shoot", "attack-melee-right"],
  reload: ["Reload", "interact-right", "idle"],
  death: ["Death", "die"],
};

let cached: Promise<GLTF> | null = null;
function loadBase(loader: GLTFLoader, url: string): Promise<GLTF> {
  if (!cached) cached = loader.loadAsync(url);
  return cached;
}

export class Soldier {
  readonly group = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<SoldierState, THREE.AnimationAction>();
  private current: SoldierState | null = null;
  private oneShotUntil = 0;
  private model: THREE.Object3D | null = null;
  private readyCbs: ((model: THREE.Object3D) => void)[] = [];
  dead = false;

  /// Runs once the async GLB clone is in the scene graph (immediately if it
  /// already is) — the scan-avatar attach needs the real bones, not the group.
  onReady(cb: (model: THREE.Object3D) => void) {
    if (this.model) cb(this.model);
    else this.readyCbs.push(cb);
  }

  /// The rig's head bone (or the nearest thing named like one) — scan faces
  /// ride it so they inherit every animation. Null on headless rigs.
  headBone(): THREE.Object3D | null {
    if (!this.model) return null;
    let head: THREE.Object3D | null = null;
    this.model.traverse((o) => {
      if (!head && /head/i.test(o.name)) head = o;
    });
    return head;
  }

  constructor(loader: GLTFLoader, url: string, tint?: number) {
    void loadBase(loader, url).then((gltf) => {
      const model = skeletonClone(gltf.scene);
      // Kit characters are authored large — normalize to ~1.75m
      const box = new THREE.Box3().setFromObject(model);
      const h = box.getSize(new THREE.Vector3()).y || 1;
      const s = 1.75 / h;
      model.scale.setScalar(s);
      const box2 = new THREE.Box3().setFromObject(model);
      model.position.y -= box2.min.y;
      model.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          if (tint !== undefined && o.material instanceof THREE.MeshStandardMaterial) {
            o.material = o.material.clone();
            o.material.color.multiply(new THREE.Color(tint));
          }
        }
      });
      this.group.add(model);

      this.mixer = new THREE.AnimationMixer(model);
      for (const [state, names] of Object.entries(CLIP_MAP) as [
        SoldierState,
        string[],
      ][]) {
        for (const n of names) {
          const clip = gltf.animations.find(
            (a) => a.name === n || a.name.toLowerCase() === n.toLowerCase(),
          );
          if (clip) {
            this.actions.set(state, this.mixer.clipAction(clip));
            break;
          }
        }
      }
      this.play("idle");
      this.model = model;
      for (const cb of this.readyCbs.splice(0)) cb(model);
    });
  }

  /// Crossfade locomotion/state change (0.2s per blueprint §2.4)
  play(state: SoldierState) {
    if (this.current === state || !this.mixer) return;
    const next = this.actions.get(state);
    if (!next) return;
    const prev = this.current ? this.actions.get(this.current) : undefined;
    const oneShot = state === "fire" || state === "reload" || state === "death";
    next.reset();
    next.setLoop(
      oneShot ? THREE.LoopOnce : THREE.LoopRepeat,
      oneShot ? 1 : Infinity,
    );
    next.clampWhenFinished = state === "death";
    if (prev && prev !== next) {
      next.crossFadeFrom(prev, 0.2, false);
    }
    next.play();
    this.current = state;
    if (oneShot && state !== "death") {
      this.oneShotUntil =
        performance.now() + (next.getClip().duration * 1000) / 1.0;
    }
  }

  /// Locomotion helper — respects in-flight one-shots (fire/reload)
  locomotion(speed: number, aiming: boolean) {
    if (this.dead) return;
    if (performance.now() < this.oneShotUntil) return;
    if (speed > 5) this.play("run");
    else if (speed > 0.3) this.play("walk");
    else this.play(aiming ? "aim" : "idle");
  }

  die() {
    this.dead = true;
    this.play("death");
  }

  revive() {
    this.dead = false;
    this.current = null;
    this.play("idle");
  }

  update(dt: number) {
    this.mixer?.update(dt);
  }
}
