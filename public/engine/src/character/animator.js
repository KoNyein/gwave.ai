// character/animator.js — Phase 2 animator state machine (spec §6)
// States: idle ↔ walk ↔ run ↔ jump ↔ fall, crossfaded on a THREE
// AnimationMixer. Clips resolve by fuzzy name from the character's own GLB,
// optionally topped up from a shared animation-library GLB (Mixamo-rigged
// clips retarget onto same-skeleton characters by bone name — the auto-rig
// pipeline's browser end).

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const ALIASES = {
  idle: ["idle", "stand"],
  walk: ["walk"],
  run: ["run", "sprint", "jog"],
  jump: ["jump"],
  fall: ["fall", "air"],
};

export class Animator {
  constructor(mixer, clips) {
    this.mixer = mixer;
    this.clips = [...(clips ?? [])];
    this.actions = {};
    this.current = null;
    this.currentName = "";
    this._resolve();
  }

  _resolve() {
    for (const [state, names] of Object.entries(ALIASES)) {
      if (this.actions[state]) continue;
      for (const n of names) {
        const clip = this.clips.find((c) => c.name.toLowerCase().includes(n));
        if (clip) {
          this.actions[state] = this.mixer.clipAction(clip);
          break;
        }
      }
    }
    // last resorts so a rigged model always animates
    this.actions.idle ??= this.clips[0] ? this.mixer.clipAction(this.clips[0]) : null;
    this.actions.fall ??= this.actions.jump ?? this.actions.idle;
    this.actions.jump ??= this.actions.idle;
    this.actions.walk ??= this.actions.idle;
    this.actions.run ??= this.actions.walk;
  }

  /** merge extra clips (shared animation library GLB) */
  addClips(clips) {
    this.clips.push(...clips);
    this._resolve();
  }

  set(state, fade = 0.18) {
    if (this.currentName === state) return;
    const next = this.actions[state];
    if (!next || next === this.current) {
      this.currentName = state;
      return;
    }
    next.reset().fadeIn(fade).play();
    this.current?.fadeOut(fade);
    this.current = next;
    this.currentName = state;
  }
}

const libLoader = new GLTFLoader();
const libCache = new Map(); // url -> Promise<AnimationClip[]>

/** load an animation-library GLB and return only its clips (cached) */
export function loadAnimationLibrary(url) {
  if (!libCache.has(url)) {
    libCache.set(
      url,
      new Promise((resolve) => {
        libLoader.load(
          url,
          (g) => resolve(g.animations ?? []),
          undefined,
          (err) => {
            console.warn("[animator] anim library failed", url, err);
            resolve([]);
          },
        );
      }),
    );
  }
  return libCache.get(url);
}

/** keep three import used even when tree-shaken contexts inline this file */
export const _three = THREE.MathUtils;
