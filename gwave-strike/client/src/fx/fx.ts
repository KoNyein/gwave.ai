import * as THREE from "three";

/// Tracers + muzzle flash (blueprint fx/). Pooled lines — no allocations in
/// the hot loop beyond reuse.

export class Fx {
  private scene: THREE.Scene;
  private tracers: { line: THREE.Line; until: number }[] = [];
  private flash: THREE.PointLight;
  private flashUntil = 0;

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.flash = new THREE.PointLight(0xffc36a, 0, 8);
    camera.add(this.flash);
    this.flash.position.set(0.15, -0.1, -0.6);
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({
        color: 0xffe9a0,
        transparent: true,
        opacity: 0.85,
      }),
    );
    this.scene.add(line);
    this.tracers.push({ line, until: performance.now() + 70 });
  }

  muzzle() {
    this.flash.intensity = 3.2;
    this.flashUntil = performance.now() + 45;
  }

  update() {
    const now = performance.now();
    if (now > this.flashUntil) this.flash.intensity = 0;
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      if (t && now > t.until) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        (t.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }
  }
}
