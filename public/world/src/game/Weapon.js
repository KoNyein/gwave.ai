// ============================================================
// Weapon.js — ကစားသမား၏ သေနတ် (Hitscan Rifle)
// Left Click ပစ် / R ကျည်ထည့် — Raycast ဖြင့် bot များကို ထိမှန်စစ်
// နံရံနောက်ကွယ်ကို ဖောက်မထွက် (Physics colliders ဖြင့် စစ်)
// ============================================================
import * as THREE from 'three';

const _ray = new THREE.Ray();
const _tmp = new THREE.Vector3();
const _dir = new THREE.Vector3();

export class Weapon {
  constructor(engine, physics) {
    this.engine = engine;
    this.physics = physics;
    this.ammo = 30;
    this.magSize = 30;
    this.damage = 34;
    this.cooldown = 0;
    this.reloadTimer = 0;
    this.raycaster = new THREE.Raycaster();

    // ကင်မရာမှာ ချိတ်ထားသော ရိုးရှင်း gun model (FPS viewmodel)
    engine.scene.add(engine.camera); // camera ၏ child များ render ဖြစ်ရန်
    this.model = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x22262f, metalness: 0.7, roughness: 0.35 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.55), bodyMat);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 10), bodyMat);
    barrel.rotation.x = Math.PI / 2; barrel.position.z = -0.4;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.1), bodyMat);
    grip.position.set(0, -0.13, 0.12); grip.rotation.x = 0.3;
    this.muzzleFlash = new THREE.PointLight(0xffcc66, 0, 4);
    this.muzzleFlash.position.set(0, 0, -0.6);
    this.model.add(body, barrel, grip, this.muzzleFlash);
    this.model.position.set(0.28, -0.24, -0.55);
    this.model.visible = false;
    engine.camera.add(this.model);

    this.tracers = []; // { line, life }
  }

  setActive(active) {
    this.model.visible = active;
    if (active) { this.ammo = this.magSize; this.reloadTimer = 0; }
  }

  startReload() {
    if (this.reloadTimer <= 0 && this.ammo < this.magSize) this.reloadTimer = 2;
  }

  // ပစ်ခတ်ခြင်း → ထိမှန်လျှင် { bot, died } ပြန်၊ မဟုတ်လျှင် null
  shoot(botMeshes) {
    if (this.cooldown > 0 || this.reloadTimer > 0 || this.ammo <= 0) return null;
    this.cooldown = 0.14;
    this.ammo--;
    this.muzzleFlash.intensity = 8; // မီးပွင့် — update() မှာ ပြန်မှိန်

    const cam = this.engine.camera;
    cam.getWorldDirection(_dir);
    this.raycaster.set(cam.getWorldPosition(_tmp.clone()), _dir);
    const hits = this.raycaster.intersectObjects(botMeshes, false);

    let hitPoint = _tmp.copy(this.raycaster.ray.origin).addScaledVector(_dir, 60);
    let result = null;

    if (hits.length) {
      const hit = hits[0];
      // ကြားမှာ နံရံရှိလျှင် ထိမမှန်
      _ray.set(this.raycaster.ray.origin, _dir);
      if (!this.physics.blocked(_ray, hit.distance - 0.2, _tmp)) {
        hitPoint = hit.point;
        const ud = hit.object.userData;
        if (ud.bot) {
          // PvE — bot ကို client ဘက်မှာပဲ ဆုံးဖြတ်
          const headshot = hit.object === ud.bot.headMesh;
          const died = ud.bot.takeDamage(headshot ? 100 : this.damage);
          result = { bot: ud.bot, died, headshot };
        } else if (ud.netId != null) {
          // PvP — server ဆီ claim ပို့ရန် netId ပြန်ပေး (server ကသာ ဆုံးဖြတ်)
          result = { netId: ud.netId };
        }
      }
    }
    this.spawnTracer(hitPoint);
    if (result) {
      result.origin = this.raycaster.ray.origin.clone();
      result.dir = _dir.clone();
    }
    return result;
  }

  spawnTracer(endPoint) {
    const start = this.model.localToWorld(new THREE.Vector3(0, 0, -0.6));
    const geo = new THREE.BufferGeometry().setFromPoints([start, endPoint]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0xffe08a, transparent: true, opacity: 0.9
    }));
    this.engine.scene.add(line);
    this.tracers.push({ line, life: 0.08 });
  }

  update(dt, hud) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.muzzleFlash.intensity = Math.max(0, this.muzzleFlash.intensity - dt * 60);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) { this.ammo = this.magSize; hud?.setAmmo(this.ammo, this.magSize); }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.engine.scene.remove(t.line);
        t.line.geometry.dispose(); t.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }
}
