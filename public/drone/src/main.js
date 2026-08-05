// main.js — GWAVE DRONE: FPV sim + Avatar (3D scan) + AR/VR
import * as THREE from 'three';
import { DronePhysics } from './DronePhysics.js';
import { Controller } from './Controller.js';
import { SettingsUI } from './SettingsUI.js';
import { loadConfig } from './config.js';
import { XRManager } from './xr/XRManager.js';
import { Avatar } from './avatar/Avatar.js';
import { Motions } from './avatar/Motions.js';
import { TRACK_VALLEY } from './race/track_valley.js';
import { RaceSystem } from './race/RaceSystem.js';
import { CollisionSystem } from './race/CollisionSystem.js';
import { DroneAudio } from './audio/DroneAudio.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SoldierController } from './soldier/SoldierController.js';
import { WeaponSystem } from './soldier/WeaponSystem.js';
import { TargetRange } from './soldier/TargetRange.js';
import { ExplosionSystem } from './combat/Explosion.js';
import { FireGrid, Destructibles, TrapSystem } from './combat/Systems.js';
import { WaveManager } from './ai/EnemyAI.js';

const cfg = loadConfig();
const PHYS_HZ = 240, PHYS_DT = 1 / PHYS_HZ;

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d9);
scene.fog = new THREE.Fog(0x87b5d9, 120, 900);

const camera = new THREE.PerspectiveCamera(cfg.camFov, innerWidth / innerHeight, 0.05, 2000);
scene.add(camera);

// world group — AR miniature scaling အတွက် world အားလုံး ဒီထဲ
const world = new THREE.Group();
scene.add(world);

const sun = new THREE.DirectionalLight(0xfff2dd, 2.6);
sun.position.set(120, 180, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -120; sun.shadow.camera.right = 120;
sun.shadow.camera.top = 120; sun.shadow.camera.bottom = -120;
world.add(sun, new THREE.HemisphereLight(0xbcd8f0, 0x4a6b3a, 0.9));

// ---------- race systems (world build မတိုင်ခင် — colliders register ရန်) ----------
const collision = new CollisionSystem();
const race = new RaceSystem(TRACK_VALLEY);
const audio = new DroneAudio();
let gateMeshes = [];
const GATE_MATS = {};

// ---------- world: DRONE VALLEY ----------
function buildWorld() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#5a8f3c'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = `hsl(${95 + Math.random() * 20},45%,${28 + Math.random() * 16}%)`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3;
  g.strokeRect(4, 4, 504, 504);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(60, 60);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200),
    new THREE.MeshLambertMaterial({ map: tex }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  world.add(ground);

  for (let i = 0; i < 6; i++) {
    const h = new THREE.Mesh(
      new THREE.ConeGeometry(120 + Math.random() * 80, 90 + Math.random() * 70, 7),
      new THREE.MeshLambertMaterial({ color: 0x7a8a6a, flatShading: true }));
    const a = (i / 6) * Math.PI * 2;
    h.position.set(Math.cos(a) * 480, 0, Math.sin(a) * 480);
    world.add(h);
  }
  GATE_MATS.normal = new THREE.MeshLambertMaterial({ color: 0xff4d6d });
  GATE_MATS.next = new THREE.MeshLambertMaterial({ color: 0x35e0b8, emissive: 0x0a4a3a });
  const gateMat = GATE_MATS.normal;
  gateMeshes = TRACK_VALLEY.gates.map(gd => {
    const gate = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(gd.width, 0.35, 0.35), gateMat);
    top.position.y = gd.height;
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, gd.height, 0.35), gateMat);
    l.position.set(-gd.width / 2, gd.height / 2, 0);
    const r = l.clone(); r.position.x = gd.width / 2;
    gate.add(top, l, r);
    gate.position.set(...gd.pos);
    gate.rotation.y = gd.yaw;
    gate.traverse(o => { o.castShadow = true; });
    world.add(gate);
    // gate post colliders (world-space)
    const c = Math.cos(gd.yaw), sn = Math.sin(gd.yaw), hw = gd.width / 2;
    collision.addCylinder(gd.pos[0] - hw * c, gd.pos[2] + hw * sn, 0.3, gd.height);
    collision.addCylinder(gd.pos[0] + hw * c, gd.pos[2] - hw * sn, 0.3, gd.height);
    return { gate, mats: [top, l, r] };
  });
  const barrelMat = new THREE.MeshLambertMaterial({ color: 0x3d6b8a });
  for (let i = 0; i < 12; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 14), barrelMat);
    b.position.set((Math.random() - 0.5) * 160, 0.55, (Math.random() - 0.5) * 160);
    b.castShadow = true;
    world.add(b);
    collision.addCylinder(b.position.x, b.position.z, 0.55, 1.1);
  }
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f6b2f });
  for (let i = 0; i < 60; i++) {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 3, 6), trunkMat);
    trunk.position.y = 1.5;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5, 7), leafMat);
    leaf.position.y = 5;
    t.add(trunk, leaf);
    const d = 90 + Math.random() * 320;
    const a = Math.random() * Math.PI * 2;
    t.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    t.traverse(o => { o.castShadow = true; });
    world.add(t);
    collision.addCylinder(t.position.x, t.position.z, 0.45, 3);
  }
}
buildWorld();

// ---------- drone mesh ----------
function buildDroneMesh() {
  const drone = new THREE.Group();
  const carbon = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.6 });
  drone.add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.045, 0.16), carbon));
  const batt = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.038, 0.11),
    new THREE.MeshStandardMaterial({ color: 0xcc2233 }));
  batt.position.y = 0.045;
  drone.add(batt);
  const propMat = new THREE.MeshBasicMaterial({ color: 0x35e04d, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  const a = 0.115 * 0.707;
  drone.props = [];
  [[a, a], [a, -a], [-a, a], [-a, -a]].forEach(([x, z]) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, Math.hypot(x, z) * 2), carbon);
    arm.position.set(x / 2, 0, z / 2); arm.lookAt(x, 0, z);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.02, 10), carbon);
    motor.position.set(x, 0.015, z);
    const prop = new THREE.Mesh(new THREE.CircleGeometry(0.064, 18), propMat);
    prop.rotation.x = -Math.PI / 2; prop.position.set(x, 0.028, z);
    drone.add(arm, motor, prop);
    drone.props.push(prop);
  });
  drone.traverse(o => { o.castShadow = true; });
  return drone;
}
let droneMesh = buildDroneMesh();
world.add(droneMesh);
// GLB drone model (task 2.3): ?drone=URL သို့ ./assets/drone.glb ရှိရင် အလိုအလျောက်လဲ
(async () => {
  const url = new URLSearchParams(location.search).get('drone') ?? './assets/drone.glb';
  try {
    const gltf = await new GLTFLoader().loadAsync(url);
    const m = gltf.scene;
    const box = new THREE.Box3().setFromObject(m);
    const size = box.max.distanceTo(box.min);
    if (size > 0.01) m.scale.setScalar(0.28 / size);       // 5" frame size normalize
    m.traverse(o => { o.castShadow = true; });
    world.remove(droneMesh);
    droneMesh = m;
    droneMesh.props = [];                                   // GLB မှာ prop bones: 'prop1..4' နာမည်ရှာ
    m.traverse(o => { if (/^prop[1-4]$/i.test(o.name)) droneMesh.props.push(o); });
    world.add(droneMesh);
    console.log('GLB drone loaded', droneMesh.props.length, 'props');
  } catch (_) { /* fallback: procedural mesh ဆက်သုံး */ }
})();

// ghost drone (semi-transparent clone)
const ghostMesh = buildDroneMesh();
ghostMesh.traverse(o => {
  if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.28; o.castShadow = false; }
});
ghostMesh.visible = false;
world.add(ghostMesh);
const _gp = new THREE.Vector3(), _gq = new THREE.Quaternion();

// race events → OSD + audio
race.onEvent = (ev, val) => {
  if (ev === 'gate') audio.gateBeep();
  if (ev === 'lap') { audio.beep(2000, 0.1, 0.35); setTimeout(() => audio.beep(2600, 0.12, 0.35), 110); }
  if (ev === 'best') haptic(0.4, 0.8, 180);
  if (ev === 'finish') { audio.beep(1600, 0.4, 0.3); race.stop(); }
};

// ---------- systems ----------
const physics = new DronePhysics(cfg);
const controller = new Controller(cfg);
new SettingsUI(cfg, controller, () => {
  camera.fov = cfg.camFov; camera.updateProjectionMatrix();
});

// ---------- avatar ----------
const avatar = new Avatar(world);
const motions = new Motions(avatar);
avatar.root.position.set(2, 0, 3);
let avatarYaw = Math.PI;
avatar.root.rotation.y = avatarYaw;
let orbitYaw = Math.PI, orbitPitch = 0.25;

// ---------- soldier FPS (P3) ----------
const soldier = new SoldierController(collision);
const weapons = new WeaponSystem(scene, camera, audio, (s, w, ms) => haptic(s, w, ms));
const range = new TargetRange(world, weapons, camera);

// ---------- P4: combat systems ----------
const vo = (() => {                    // Burmese captions + radio beep (task 4.8)
  const el = document.getElementById('caption');
  let timer = null;
  return (text, kind = 'info') => {
    if (!el) return;
    el.textContent = text;
    el.style.color = kind === 'warn' ? '#ffb060' : kind === 'wave' ? '#7dffb0'
      : kind === 'kill' ? '#ffd28d' : '#ffe9c8';
    audio.beep(kind === 'warn' ? 600 : 1000, 0.05, 0.12);
    clearTimeout(timer);
    timer = setTimeout(() => el.textContent = '', 3200);
  };
})();

const explosion = new ExplosionSystem(world, audio);
const fireGrid = new FireGrid(world, explosion);
explosion.onExplode = (pos, r) => fireGrid.igniteArea(pos, r);
const traps = new TrapSystem(world, explosion, audio);
traps.onMessage = m => vo(m, 'info');
const destruct = new Destructibles(world, explosion, fireGrid, weapons);
// ကား ၃ စီး + red barrels (chain demo)
destruct.addCar(-14, -12, 0.4);
destruct.addCar(14, -26, -0.7);
destruct.addCar(-20, -40, 1.6);
destruct.addBarrel(-12.5, -13.5); destruct.addBarrel(-11, -12);
destruct.addBarrel(15.5, -24.5); destruct.addBarrel(12, -28);
[[-14,-12],[14,-26],[-20,-40]].forEach(([x,z]) => collision.addCylinder(x, z, 1.6, 1.7));

// player combat interface
const player = {
  hp: 100, maxHp: 100, alive: true,
  regenT: 0,
  get pos() { return soldier.pos; },
  get crouched() { return soldier.crouched; },
  get moveSpeed() { return soldier.moveSpeed; },
  get recentShot() { return performance.now() - weapons.lastShot < 1500; },
  getPos: () => soldier.pos,
  takeDamage(dmg, fromPos) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.regenT = 5;
    const vg = document.getElementById('vignette');
    if (vg) { vg.style.opacity = Math.min(1, 0.4 + (1 - this.hp / 100) * 0.6); }
    haptic(0.7, 0.7, 160);
    if (this.hp <= 0) {
      this.alive = false;
      vo('ကျဆုံးသွားပြီ… ၃ စက္ကန့်အတွင်း ပြန်စမည်', 'warn');
      setTimeout(() => {
        this.hp = this.maxHp; this.alive = true;
        soldier.pos.set(2, 0, 8); soldier.vel.set(0, 0, 0);
      }, 3000);
    }
  },
  stumble() { soldier.vel.x *= 0.2; soldier.vel.z *= 0.2; },
};
explosion.register(player);
traps.victims.push(player);

const waveCtx = {
  player, audio, vo,
  tracer: (a, b) => weapons._spawnTracer(a, b),
  registerVictim(v) {
    traps.victims.push(v);
    explosion.register(v);
    weapons.targets.push(v);           // player ပစ်လို့ရအောင်
  },
};
const waves = new WaveManager(world, collision, waveCtx, traps);
let burnT = 0;

// trap placement — aim ground point (2.6m ရှေ့)
function aimGround() {
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const p = soldier.pos.clone().addScaledVector(dir.setY(0).normalize(), 2.6);
  p.y = 0;
  return p;
}
let firstPerson = true;
let fireHeld = false, adsHeld = false;
const SOLDIER_FOV = 75;
weapons.onHitmarker = (head) => {
  const hm = document.getElementById('hitmarker');
  hm.style.color = head ? '#ffcf40' : '#fff';
  hm.style.opacity = 1;
  setTimeout(() => hm.style.opacity = 0, 90);
  audio.beep(head ? 1900 : 1500, 0.03, 0.18);
};
// pointer lock + mouse
renderer.domElement.addEventListener('click', () => {
  if (mode === 'AVATAR' && firstPerson && !document.pointerLockElement)
    renderer.domElement.requestPointerLock();
});
addEventListener('mousemove', e => {
  if (document.pointerLockElement && mode === 'AVATAR' && firstPerson)
    soldier.look(e.movementX, e.movementY);
});
addEventListener('mousedown', e => {
  if (mode !== 'AVATAR' || !document.pointerLockElement) return;
  if (e.button === 0) fireHeld = true;
  if (e.button === 2) adsHeld = true;
});
addEventListener('mouseup', e => {
  if (e.button === 0) fireHeld = false;
  if (e.button === 2) adsHeld = false;
});
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => {
  if (mode !== 'AVATAR') return;
  if (e.code === 'KeyR') weapons.reload();
  if (e.code === 'KeyV') firstPerson = !firstPerson;
  if (e.code === 'Digit1') weapons.switchSlot(0);
  if (e.code === 'Digit2') weapons.switchSlot(1);
  if (e.code === 'Digit3') weapons.switchSlot(2);
  if (e.code === 'Digit4') traps.placeMine(aimGround());
  if (e.code === 'Digit5') traps.placeTripwireStake(aimGround());
  if (e.code === 'Digit6') traps.placeC4(aimGround());
  if (e.code === 'KeyG') traps.detonateC4();
  if (e.code === 'KeyP' && waves.state !== 'ACTIVE') waves.startWave();
});

// scan GLB load — settings input / ?avatar= URL param
const params = new URLSearchParams(location.search);
if (params.get('avatar')) avatar.loadScan(params.get('avatar')).then(s => console.log('avatar:', s));
document.getElementById('avatar-file')?.addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) avatar.loadScan(URL.createObjectURL(f)).then(s =>
    document.getElementById('bind-status').textContent = 'Avatar: ' + s);
});

// ---------- game mode: AVATAR (3rd person) ↔ FPV ----------
let mode = 'AVATAR';
function deployDrone() {
  if (mode === 'AVATAR') {
    mode = 'FPV';
    document.exitPointerLock?.();
    weapons.vm.visible = false;
    fireHeld = adsHeld = false;
    const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), avatarYaw);
    physics.reset(soldier.pos.clone().addScaledVector(fwd, 1.4).setY(0.08));
    avatar.root.visible = true;
    motions.set('PILOT_SIT');
  } else {
    mode = 'AVATAR';
    physics.disarm();
    motions.set('IDLE');
  }
}
addEventListener('keydown', e => { if (e.code === 'KeyF') deployDrone(); });

// mouse orbit (AVATAR mode)
let dragging = false;
renderer.domElement.addEventListener('pointerdown', e => { if (mode === 'AVATAR') dragging = true; });
addEventListener('pointerup', () => dragging = false);
addEventListener('pointermove', e => {
  if (!dragging || mode !== 'AVATAR') return;
  orbitYaw -= e.movementX * 0.004;
  orbitPitch = THREE.MathUtils.clamp(orbitPitch + e.movementY * 0.003, -0.1, 1.1);
});

function updateAvatar(dt) {
  if (mode === 'FPV') {
    motions.set('PILOT_SIT');
    motions.setLookTarget(physics.pos);
    motions.update(dt, 0);
    return;
  }
  motions.setLookTarget(null);
  // input gather
  const k = controller._keys;
  let ix = 0, iz = 0;
  if (k['KeyW']) iz -= 1; if (k['KeyS']) iz += 1;
  if (k['KeyA']) ix -= 1; if (k['KeyD']) ix += 1;
  if (controller.touch.l.active) { ix = controller.touch.l.x; iz = controller.touch.l.y; }
  const gp = navigator.getGamepads?.()[0];
  if (gp && Math.hypot(gp.axes[0] ?? 0, gp.axes[1] ?? 0) > 0.15) {
    ix = gp.axes[0]; iz = gp.axes[1];
    soldier.look((gp.axes[2] ?? 0) * 14, (gp.axes[3] ?? 0) * 14);
    if (gp.buttons[7]?.pressed) fireHeld = true; else if (gp.connected) fireHeld = fireHeld && !gp.mapping;
    adsHeld = adsHeld || gp.buttons[6]?.pressed;
  }
  soldier.update(dt, {
    x: ix, z: iz,
    sprint: !!k['ShiftLeft'],
    crouch: !!k['KeyC'],
    jump: !!k['Space'],
  });
  weapons.update(dt, fireHeld, adsHeld, soldier.moveSpeed);
  range.update(dt);
  // avatar body sync (3rd person / shadow)
  avatar.root.position.copy(soldier.pos);
  avatarYaw = soldier.yaw + Math.PI;
  avatar.root.rotation.y = avatarYaw;
  motions.setAim(weapons.ads);
  if (!soldier.grounded) motions.set('JUMP');
  else motions.set(soldier.moveSpeed < 0.3
    ? (soldier.crouched ? 'CROUCH' : 'IDLE')
    : soldier.crouched ? 'CROUCH_WALK' : soldier.sprinting ? 'RUN' : 'WALK');
  motions.update(dt, soldier.moveSpeed);
  avatar.root.visible = !firstPerson;
  weapons.vm.visible = firstPerson;
}

// ---------- XR ----------
const xr = new XRManager(renderer, scene, world, camera);
xr.supported().then(({ vr, ar }) => {
  const bar = document.getElementById('xr-bar');
  if (vr) { const b = mkBtn('🥽 VR'); b.onclick = () => xr.enterVR(); bar.appendChild(b); }
  if (ar) { const b = mkBtn('📱 AR'); b.onclick = () => xr.enterAR(); bar.appendChild(b); }
  if (vr) {
    const t = mkBtn('VR: SCREEN');
    t.onclick = () => { xr.setVRView(xr.vrView === 'SCREEN' ? 'FULL' : 'SCREEN'); t.textContent = 'VR: ' + xr.vrView; };
    bar.appendChild(t);
  }
  if (!vr && !ar) bar.style.display = 'none';
});
function mkBtn(txt) {
  const b = document.createElement('button');
  b.textContent = txt; b.className = 'xr-btn';
  return b;
}

// ---------- haptics ----------
function haptic(strong, weak, ms) {
  const gp = navigator.getGamepads?.()[0];
  gp?.vibrationActuator?.playEffect?.('dual-rumble',
    { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {});
  if (navigator.vibrate && strong > 0.5) navigator.vibrate(ms);
  xr.haptic('right', strong, ms); xr.haptic('left', weak, ms);
}
let lastCrashed = false, hum = 0;

// ---------- OSD ----------
const $ = id => document.getElementById(id);
const osd = { volt: $('volt'), thrFill: $('thr-fill'), thrPct: $('thr-pct'),
  timer: $('timer'), alt: $('alt'), spd: $('spd'),
  mode: $('mode-label'), arm: $('arm-label'), warn: $('warn'),
  msg: $('armed-msg'), horizon: $('horizon') };
function updateOSD(input) {
  const fpv = mode === 'FPV';
  osd.volt.textContent = physics.voltage.toFixed(1);
  osd.thrFill.style.width = (input.throttle * 100).toFixed(0) + '%';
  osd.thrPct.textContent = (input.throttle * 100).toFixed(0);
  const t = physics.flightTime | 0;
  osd.timer.textContent = String((t / 60) | 0).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  osd.alt.textContent = physics.altitude.toFixed(1);
  osd.spd.textContent = physics.speedKmh.toFixed(0);
  osd.mode.textContent = fpv ? cfg.flightMode : 'SOLDIER · ' + motions.state;
  const hpWrap = document.getElementById('hp-wrap');
  if (hpWrap) {
    hpWrap.style.display = fpv ? 'none' : 'block';
    const f = document.getElementById('hp-fill');
    f.style.width = Math.max(0, player.hp) + '%';
    f.style.background = player.hp > 55 ? '#7dff8d' : player.hp > 25 ? '#ffd24d' : '#ff5a5a';
    document.getElementById('wave-label').textContent =
      waves.state === 'ACTIVE'
        ? `Wave ${waves.wave} · ရန်သူ ${waves.enemies.filter(e => e.alive).length}`
        : waves.state === 'CLEARED' ? `Wave ${waves.wave} ရှင်း — [P] နောက်တစ်ခု` : '[P] = Wave စတင်';
  }
  const ammoEl = document.getElementById('ammo');
  if (ammoEl) {
    ammoEl.style.display = fpv ? 'none' : 'block';
    document.getElementById('gun-name').textContent = weapons.gun.name
      + (weapons.reloading > 0 ? ' · RELOADING' : '');
    document.getElementById('mag').textContent = weapons.ammo.mag;
    document.getElementById('reserve').textContent = weapons.ammo.reserve;
  }
  osd.arm.textContent = !fpv ? '[F] DEPLOY DRONE'
    : physics.crashed ? 'CRASHED' : physics.armed ? 'ARMED' : 'DISARMED';
  osd.arm.style.color = physics.armed ? '#8dffa0' : '#ffd28d';
  osd.warn.style.display = physics.voltage < 21.4 && physics.armed ? 'block' : 'none';
  osd.msg.style.display = fpv && !physics.armed ? 'block' : 'none';
  osd.horizon.style.display = fpv ? 'block' : 'none';
  // race panel
  const rp = document.getElementById('race-panel');
  if (rp) {
    rp.style.display = fpv ? 'block' : 'none';
    document.getElementById('race-time').textContent = RaceSystem.fmt(race.raceTime);
    document.getElementById('lap-label').textContent =
      `Lap ${Math.min(race.lap + 1, race.track.laps)}/${race.track.laps}`;
    document.getElementById('lap-list').innerHTML = race.lapTimes
      .map((t, i) => `<div>${i + 1} &nbsp;${RaceSystem.fmt(t)}</div>`).join('');
    document.getElementById('best-time').textContent = RaceSystem.fmt(race.bestLap?.time);
  }
  osd.horizon.style.transform =
    `translateY(${(physics.pitchDeg * 3).toFixed(1)}px) rotate(${(-physics.rollDeg).toFixed(1)}deg)`;
}

// ---------- main loop (XR-compatible) ----------
let last = performance.now(), acc = 0;
renderer.setAnimationLoop((now, frame) => {
  const frameDt = Math.min(0.05, (now - last) / 1000);
  last = now;

  // VR sticks → FPV controller override
  controller.xrSticks = (mode === 'FPV') ? xr.sticks : null;

  const input = controller.update(frameDt);
  const ev = controller.consumeEvents();
  if (mode === 'FPV') {
    if (ev.arm) {
      if (physics.armed) { physics.disarm(); audio.disarmBeep(); race.stop(); }
      else { physics.arm(); audio.armBeep(); race.start(physics.pos); }
    }
    if (ev.reset) { physics.reset(); race.stop(); }
    if (ev.modeToggle) cfg.flightMode = cfg.flightMode === 'ACRO' ? 'ANGLE' : 'ACRO';
    if (xr.sticks?.squeeze && !physics.armed) physics.arm();  // VR grip = arm
  }

  if (mode === 'FPV') {
    acc += frameDt;
    while (acc >= PHYS_DT) {
      physics.step(PHYS_DT, input);
      const hit = collision.check(physics);            // task 2.2
      if (hit === 'crash') { audio.crash(); haptic(1, 1, 320); }
      acc -= PHYS_DT;
    }
    race.update(frameDt, physics.pos, physics.quat);   // task 2.1
    ghostMesh.visible = race.ghostPose(frameDt, _gp, _gq); // task 2.5
    if (ghostMesh.visible) { ghostMesh.position.copy(_gp); ghostMesh.quaternion.copy(_gq); }
    // next-gate highlight
    gateMeshes.forEach((g, i) => {
      const mat = (race.state === 'RACING' && i === race.nextGate) ? GATE_MATS.next : GATE_MATS.normal;
      g.mats.forEach(m => m.material = mat);
    });
  } else { ghostMesh.visible = false; }
  audio.update(physics.motors, physics.armed, physics.voltage, frameDt); // task 2.4
  updateAvatar(frameDt);
  // P4 systems (mode မရွေး run — drone ပျံနေချိန်လည်း ရန်သူတွေလှုပ်)
  explosion.update(frameDt);
  fireGrid.update(frameDt);
  traps.update(frameDt);
  destruct.update(frameDt);
  waves.update(frameDt);
  // burn damage (0.5s tick)
  burnT += frameDt;
  if (burnT > 0.5) {
    burnT = 0;
    if (player.alive && fireGrid.burning(soldier.pos)) player.takeDamage(6, soldier.pos);
    for (const e of waves.enemies) if (e.alive && fireGrid.burning(e.pos)) e.takeDamage(6, null);
  }
  // hp regen + vignette decay
  player.regenT -= frameDt;
  if (player.regenT < 0 && player.alive && player.hp < player.maxHp)
    player.hp = Math.min(player.maxHp, player.hp + 8 * frameDt);
  const vg = document.getElementById('vignette');
  if (vg) {
    const target = player.hp < 30 ? 0.55 : 0;
    const cur = parseFloat(vg.style.opacity) || 0;
    vg.style.opacity = Math.max(target, cur - frameDt * 0.8).toFixed(2);
  }
  // low-hp heartbeat haptic
  if (player.alive && player.hp < 25 && ((performance.now() / 900) | 0) !== window.__hb) {
    window.__hb = (performance.now() / 900) | 0;
    haptic(0.35, 0.1, 80);
  }
  // explosion camera shake
  if (explosion.shake > 0.01 && xr.mode === 'NONE') {
    camera.position.x += (Math.random() - 0.5) * explosion.shake * 0.25;
    camera.position.y += (Math.random() - 0.5) * explosion.shake * 0.25;
  }

  droneMesh.position.copy(physics.pos);
  droneMesh.quaternion.copy(physics.quat);
  droneMesh.props?.forEach((p, i) => {
    p.rotation.z += physics.motors[i] * 3.2;
    p.material.opacity = 0.25 + physics.motors[i] * 0.4;
  });

  // camera
  if (xr.mode === 'NONE') {
    if (mode === 'FPV') {
      if (Math.abs(camera.fov - cfg.camFov) > 0.1) { camera.fov = cfg.camFov; camera.updateProjectionMatrix(); }
      camera.position.copy(physics.pos);
      camera.quaternion.copy(physics.quat);
      camera.rotateX(cfg.camAngle * Math.PI / 180);
      camera.translateZ(-0.06);
    } else if (firstPerson) {
      soldier.applyCamera(camera, weapons.ads);
      weapons.applyRecoil(camera);
      const tf = weapons.targetFov(SOLDIER_FOV);
      if (Math.abs(camera.fov - tf) > 0.1) { camera.fov = tf; camera.updateProjectionMatrix(); }
    } else {
      // 3rd person (V) — soldier ကျောဘက်
      const target = soldier.pos.clone().add(new THREE.Vector3(0, 1.4, 0));
      const off = new THREE.Vector3(
        Math.sin(soldier.yaw), 0.35, Math.cos(soldier.yaw)).normalize().multiplyScalar(3.6);
      camera.position.copy(target).add(off);
      camera.lookAt(target.clone().addScaledVector(
        new THREE.Vector3(-Math.sin(soldier.yaw), Math.tan(soldier.pitch) * 0.6, -Math.cos(soldier.yaw)), 6));
      const tf = weapons.targetFov(SOLDIER_FOV);
      if (Math.abs(camera.fov - tf) > 0.1) { camera.fov = tf; camera.updateProjectionMatrix(); }
    }
  } else {
    // XR sessions
    xr.update(frame, physics.pos);
    if (mode === 'FPV') {
      if (!xr.applyFullFPV(camera, physics.pos, physics.quat, cfg.camAngle)) {
        // SCREEN mode: FPV view → virtual screen
        camera.position.copy(physics.pos);
        camera.quaternion.copy(physics.quat);
        camera.rotateX(cfg.camAngle * Math.PI / 180);
        xr.renderToScreen(camera);
      }
    }
  }

  // haptics
  hum += frameDt;
  if (physics.armed && hum > 0.28) {
    hum = 0;
    const avg = (physics.motors[0] + physics.motors[1] + physics.motors[2] + physics.motors[3]) / 4;
    haptic(0, Math.min(0.35, avg * 0.35), 260);
  }
  if (physics.crashed && !lastCrashed) haptic(1, 1, 320);
  lastCrashed = physics.crashed;

  updateOSD(input);
  renderer.render(scene, camera);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
addEventListener('gamepadconnected', e =>
  console.log('🎮', e.gamepad.id, e.gamepad.axes.length, 'axes'));
