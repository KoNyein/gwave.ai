// soldier/WeaponSystem.js — tasks 3.2, 3.3, 3.4, 3.7
// Data-driven guns · hitscan + sniper projectile · recoil pattern · ADS · viewmodel · tracer/flash
import * as THREE from 'three';

export const GUNS = {
  ak47: {
    name: 'AK-47', auto: true, rpm: 600, damage: 34, headMult: 2.3,
    mag: 30, reserve: 90, reloadTime: 2.4,
    spreadHip: 0.028, spreadAds: 0.004, adsZoom: 1.35, adsTime: 0.22,
    // recoil pattern (30 shots): [pitchKick(rad), yawKick] — CS-style up→right drift
    pattern: Array.from({ length: 30 }, (_, i) => [
      0.017 + i * 0.0006,
      i < 8 ? 0 : Math.sin(i * 0.55) * 0.006 + 0.002,
    ]),
    recoilRecover: 7,
    kind: 'hitscan', range: 220, sound: { freq: 180, dur: 0.11 },
  },
  m4: {
    name: 'M4A1', auto: true, rpm: 720, damage: 30, headMult: 2.3,
    mag: 30, reserve: 120, reloadTime: 2.1,
    spreadHip: 0.022, spreadAds: 0.003, adsZoom: 1.4, adsTime: 0.18,
    pattern: Array.from({ length: 30 }, (_, i) => [
      0.013 + i * 0.0005, Math.sin(i * 0.4) * 0.004,
    ]),
    recoilRecover: 8,
    kind: 'hitscan', range: 240, sound: { freq: 230, dur: 0.09 },
  },
  pistol: {
    name: 'Glock', auto: false, rpm: 400, damage: 20, headMult: 2.0,
    mag: 17, reserve: 51, reloadTime: 1.6,
    spreadHip: 0.02, spreadAds: 0.006, adsZoom: 1.15, adsTime: 0.12,
    pattern: Array.from({ length: 17 }, () => [0.02, 0]),
    recoilRecover: 10,
    kind: 'hitscan', range: 80, sound: { freq: 320, dur: 0.07 },
  },
  sniper: {
    name: 'Kar98', auto: false, rpm: 45, damage: 105, headMult: 2.4,
    mag: 5, reserve: 20, reloadTime: 3.4,
    spreadHip: 0.05, spreadAds: 0.0005, adsZoom: 3.5, adsTime: 0.3,
    pattern: [[0.06, 0]], recoilRecover: 4,
    kind: 'projectile', muzzleVel: 760, range: 800, sound: { freq: 110, dur: 0.22 },
  },
};

export class WeaponSystem {
  constructor(scene, camera, audio, haptic) {
    this.scene = scene; this.camera = camera;
    this.audio = audio; this.haptic = haptic;
    this.slots = ['ak47', 'sniper', 'pistol'];
    this.slot = 0;
    this.state = {};                          // per-gun ammo state
    for (const id of this.slots) this.state[id] = { mag: GUNS[id].mag, reserve: GUNS[id].reserve };
    this.cooldown = 0;
    this.reloading = 0;                       // remaining time
    this.shotIndex = 0;                       // recoil pattern index
    this.lastShot = 0;
    this.ads = 0;                             // 0..1
    this.adsHeld = false;
    this.recoilPitch = 0; this.recoilYaw = 0; // camera offset (recovering)
    this.targets = [];                        // {mesh, hp, onHit(dmg, point, head)}
    this.projectiles = [];
    this._ray = new THREE.Raycaster();
    this._tracers = [];
    this._buildViewmodel();
    this._muzzleLight = new THREE.PointLight(0xffc766, 0, 6);
    camera.add(this._muzzleLight);
    this._muzzleLight.position.set(0.16, -0.12, -0.65);
    this.onHitmarker = () => {};
  }

  get gun() { return GUNS[this.slots[this.slot]]; }
  get ammo() { return this.state[this.slots[this.slot]]; }

  switchSlot(i) {
    if (i === this.slot || i < 0 || i >= this.slots.length) return;
    this.slot = i; this.reloading = 0; this.shotIndex = 0;
    this._refreshViewmodel();
    this.audio?.beep(700, 0.05, 0.15);
  }

  reload() {
    const a = this.ammo, g = this.gun;
    if (this.reloading > 0 || a.mag >= g.mag || a.reserve <= 0) return;
    this.reloading = g.reloadTime;
    this.audio?.reloadClick?.();
  }

  // main update — fireHeld/adsHeld from input, origin = camera
  update(dt, fireHeld, adsHeld, moveSpeed) {
    const g = this.gun;
    this.cooldown = Math.max(0, this.cooldown - dt);
    // ADS blend
    this.adsHeld = adsHeld;
    this.ads += ((adsHeld && this.reloading <= 0 ? 1 : 0) - this.ads) * Math.min(1, dt / g.adsTime * 2);
    // reload
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        const a = this.ammo;
        const need = g.mag - a.mag, take = Math.min(need, a.reserve);
        a.mag += take; a.reserve -= take;
        this.shotIndex = 0;
      }
    }
    // recoil recovery + pattern index decay
    this.recoilPitch *= Math.max(0, 1 - g.recoilRecover * dt);
    this.recoilYaw *= Math.max(0, 1 - g.recoilRecover * dt);
    if (performance.now() - this.lastShot > 350) this.shotIndex = Math.max(0, this.shotIndex - 1);

    // fire
    if (fireHeld && this.cooldown <= 0 && this.reloading <= 0) {
      if (this.ammo.mag > 0) {
        this._fire(moveSpeed);
        this.cooldown = 60 / g.rpm;
        if (!g.auto) this.cooldown = Math.max(this.cooldown, 0.12); // semi handled by caller edge too
      } else { this.reload(); }
    }

    this._updateProjectiles(dt);
    this._updateTracers(dt);
    this._muzzleLight.intensity *= Math.max(0, 1 - dt * 30);
    this._animViewmodel(dt, moveSpeed);
  }

  _fire(moveSpeed) {
    const g = this.gun;
    this.ammo.mag--;
    this.lastShot = performance.now();
    // spread: hip↔ads + movement penalty
    const spread = THREE.MathUtils.lerp(g.spreadHip, g.spreadAds, this.ads)
      * (1 + Math.min(1, moveSpeed / 5) * 0.8);
    const dir = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(this.camera.quaternion);
    dir.x += (Math.random() - 0.5) * spread * 2;
    dir.y += (Math.random() - 0.5) * spread * 2;
    dir.normalize();
    const origin = this.camera.getWorldPosition(new THREE.Vector3());

    if (g.kind === 'projectile') {
      this.projectiles.push({ pos: origin.clone().addScaledVector(dir, 0.6),
        vel: dir.clone().multiplyScalar(g.muzzleVel), life: 3, dmg: g.damage, head: g.headMult });
    } else {
      // hitscan
      this._ray.set(origin, dir);
      this._ray.far = g.range;
      const meshes = this.targets.map(t => t.mesh);
      const hits = this._ray.intersectObjects(meshes, true);
      let end = origin.clone().addScaledVector(dir, g.range);
      if (hits.length) {
        end = hits[0].point;
        const t = this.targets.find(t => t.mesh === hits[0].object
          || this._isChild(t.mesh, hits[0].object));
        if (t) {
          const head = hits[0].point.y - t.mesh.position.y > (t.headY ?? 1.4);
          const dmg = Math.round(g.damage * (head ? g.headMult : 1));
          t.onHit(dmg, hits[0].point, head);
          this.onHitmarker(head);
        }
      }
      this._spawnTracer(origin, end);
    }
    // recoil pattern
    const [pk, yk] = g.pattern[Math.min(this.shotIndex, g.pattern.length - 1)];
    const adsMul = THREE.MathUtils.lerp(1, 0.62, this.ads);
    this.recoilPitch += pk * adsMul;
    this.recoilYaw += yk * adsMul;
    this.shotIndex++;
    // FX
    this._muzzleLight.intensity = 6;
    this._vmKick = 0.05;
    this.audio?.gunshot?.(g.sound.freq, g.sound.dur);
    this.haptic?.(0.5, 0.9, g.kind === 'projectile' ? 120 : 45);
  }

  _isChild(root, obj) { let f = false; root.traverse(o => { if (o === obj) f = true; }); return f; }

  // sniper projectile sim: gravity drop + target sphere test (task 3.4)
  _updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const prev = p.pos.clone();
      p.vel.y -= 9.81 * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.life -= dt;
      // segment vs target bounding sphere
      let hit = false;
      for (const t of this.targets) {
        const c = t.mesh.position.clone(); c.y += 0.9;
        const seg = p.pos.clone().sub(prev);
        const toC = c.sub(prev);
        const tt = THREE.MathUtils.clamp(toC.dot(seg) / seg.lengthSq(), 0, 1);
        const close = prev.clone().addScaledVector(seg, tt);
        if (close.distanceTo(t.mesh.position.clone().setY(t.mesh.position.y + 0.9)) < (t.radius ?? 0.6)) {
          const head = close.y - t.mesh.position.y > (t.headY ?? 1.4);
          t.onHit(Math.round(p.dmg * (head ? p.head : 1)), close, head);
          this.onHitmarker(head);
          hit = true; break;
        }
      }
      this._spawnTracer(prev, p.pos, 0.08);
      if (hit || p.life <= 0 || p.pos.y < 0) this.projectiles.splice(i, 1);
    }
  }

  // ---------- tracers ----------
  _spawnTracer(a, b, life = 0.06) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(geo,
      new THREE.LineBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this._tracers.push({ line, life });
  }
  _updateTracers(dt) {
    for (let i = this._tracers.length - 1; i >= 0; i--) {
      const t = this._tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life * 12);
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose(); t.line.material.dispose();
        this._tracers.splice(i, 1);
      }
    }
  }

  // ---------- viewmodel (procedural gun — production: GLB) ----------
  _buildViewmodel() {
    this.vm = new THREE.Group();
    this.camera.add(this.vm);
    this._refreshViewmodel();
    this._vmKick = 0;
  }
  _refreshViewmodel() {
    this.vm.clear();
    const dark = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.5 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4426, roughness: 0.7 });
    const isSniper = this.gun.kind === 'projectile';
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, isSniper ? 0.55 : 0.42),
      this.slots[this.slot] === 'ak47' ? wood : dark);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.3, 8), dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -(isSniper ? 0.42 : 0.34));
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.035, 0.012), dark);
    sight.position.set(0, 0.075, -0.1);
    this.vm.add(body, barrel, sight);
  }
  _animViewmodel(dt, moveSpeed) {
    this._vmKick = Math.max(0, this._vmKick - dt * 0.6);
    // hip ↔ ADS position lerp
    const hip = { x: 0.17, y: -0.14, z: -0.42 };
    const ads = { x: 0, y: -0.075, z: -0.3 };
    const a = this.ads;
    const sway = Math.sin(performance.now() * 0.0012) * 0.004 * (1 - a);
    const bob = Math.min(1, moveSpeed / 4) * (1 - a);
    this.vm.position.set(
      THREE.MathUtils.lerp(hip.x, ads.x, a) + sway,
      THREE.MathUtils.lerp(hip.y, ads.y, a) + Math.sin(performance.now() * 0.008) * 0.006 * bob,
      THREE.MathUtils.lerp(hip.z, ads.z, a) + this._vmKick);
    this.vm.rotation.set(this.reloading > 0 ? 0.5 : this._vmKick * 2, 0, 0);
  }

  // camera recoil offset — SoldierController.applyCamera ပြီးမှခေါ်
  applyRecoil(camera) {
    camera.rotation.x += this.recoilPitch;
    camera.rotation.y += this.recoilYaw;
  }
  // ADS FOV
  targetFov(baseFov) { return baseFov / THREE.MathUtils.lerp(1, this.gun.adsZoom, this.ads); }
}
