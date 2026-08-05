// main.js — GWAVE DRONE: FPV sim + Avatar (3D scan) + AR/VR
import * as THREE from 'three';
import { Race } from './race/Race.js';
import { DroneAudio } from './audio/DroneAudio.js';
import { DronePhysics } from './DronePhysics.js';
import { Controller } from './Controller.js';
import { SettingsUI } from './SettingsUI.js';
import { loadConfig } from './config.js';
import { XRManager } from './xr/XRManager.js';
import { Avatar } from './avatar/Avatar.js';
import { Motions } from './avatar/Motions.js';

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

// ---------- world: DRONE VALLEY ----------
// Phase 2.6 — track as data. tracks/valley.json can override the default
// ring; the format is just {gates:[{x,z}...]} so new tracks are files.
let TRACK = { gates: Array.from({ length: 8 }, (_, i) => ({
  x: Math.cos((i / 8) * Math.PI * 2) * 70,
  z: Math.sin((i / 8) * Math.PI * 2) * 70 })) };
const worldGates = [];
const worldColliders = [];
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
  const gateMat = new THREE.MeshLambertMaterial({ color: 0xff4d6d });
  const N = TRACK.gates.length || 8;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const gate = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(6, 0.35, 0.35), gateMat);
    top.position.y = 5;
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5, 0.35), gateMat);
    l.position.set(-3, 2.5, 0);
    const r = l.clone(); r.position.x = 3;
    gate.add(top, l, r);
    const gd = TRACK.gates[i] || { x: Math.cos(a) * 70, z: Math.sin(a) * 70 };
    gate.position.set(gd.x, 0, gd.z);
    const nx = TRACK.gates[(i + 1) % N] || gd;
    gate.lookAt(nx.x, 0, nx.z);
    gate.traverse(o => { o.castShadow = true; });
    world.add(gate);
    worldGates.push(gate);
    // gate posts are crashable
    for (const px of [-3, 3]) {
      const wp = new THREE.Vector3(px, 0, 0).applyQuaternion(gate.quaternion).add(gate.position);
      worldColliders.push({ type: 'cylinder', pos: wp, r: 0.22, h: 5 });
    }
  }
  const barrelMat = new THREE.MeshLambertMaterial({ color: 0x3d6b8a });
  for (let i = 0; i < 12; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 14), barrelMat);
    b.position.set((Math.random() - 0.5) * 160, 0.55, (Math.random() - 0.5) * 160);
    b.castShadow = true;
    world.add(b);
    worldColliders.push({ type: 'cylinder', pos: b.position.clone().setY(0), r: 0.6, h: 1.2 });
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
    worldColliders.push({ type: 'cylinder', pos: t.position.clone(), r: 0.45, h: 3 });
    worldColliders.push({ type: 'sphere', pos: t.position.clone().setY(5), r: 2.0 });
  }
}
try {
  const r = await fetch('./tracks/valley.json');
  if (r.ok) TRACK = await r.json();
} catch { /* default ring */ }
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
const droneMesh = buildDroneMesh();
world.add(droneMesh);

// ---------- Phase 2: race + audio ----------
const race = new Race(world, buildDroneMesh);
worldGates.forEach(g => race.registerGate(g));
worldColliders.forEach(c => race.registerCollider(c));
const droneAudio = new DroneAudio();

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
    // drone ကို avatar ရှေ့မှာချ
    const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), avatarYaw);
    physics.reset(avatar.root.position.clone().addScaledVector(fwd, 1.2).setY(0.08));
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
    motions.setLookTarget(physics.pos);        // pilot က drone ကိုကြည့်နေ
    motions.update(dt, 0);
    return;
  }
  motions.setLookTarget(null);
  // movement input: keyboard / touch left stick / gamepad left stick
  let mx = 0, mz = 0, run = false, crouch = false, jump = false;
  const k = controller._keys;
  if (k['KeyW']) mz -= 1; if (k['KeyS']) mz += 1;
  if (k['KeyA']) mx -= 1; if (k['KeyD']) mx += 1;
  run = !!k['ShiftLeft']; crouch = !!k['KeyC'];
  if (k['Space'] && motions.state !== 'JUMP') jump = true;
  if (controller.touch.l.active) { mx = controller.touch.l.x; mz = controller.touch.l.y; }
  const gp = navigator.getGamepads?.()[0];
  if (gp && Math.hypot(gp.axes[0] ?? 0, gp.axes[1] ?? 0) > 0.15) {
    mx = gp.axes[0]; mz = gp.axes[1]; run = gp.buttons[10]?.pressed;
  }
  const len = Math.hypot(mx, mz);
  const speed = len > 0.05 ? (crouch ? 1.4 : run ? 6.0 : 2.6) * Math.min(1, len) : 0;
  if (speed > 0) {
    const dir = Math.atan2(mx, mz) + orbitYaw + Math.PI;   // camera-relative
    avatarYaw += ((dir - avatarYaw + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 10);
    avatar.root.rotation.y = avatarYaw;
    avatar.root.position.x += Math.sin(avatarYaw) * speed * dt;
    avatar.root.position.z += Math.cos(avatarYaw) * speed * dt;
  }
  if (jump) motions.set('JUMP');
  else if (motions.state !== 'JUMP') {
    motions.set(speed === 0 ? (crouch ? 'CROUCH' : 'IDLE')
      : crouch ? 'CROUCH_WALK' : run ? 'RUN' : 'WALK');
  }
  motions.update(dt, speed);
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
  msg: $('armed-msg'), horizon: $('horizon'), race: $('race-osd') };
function updateOSD(input) {
  const fpv = mode === 'FPV';
  osd.volt.textContent = physics.voltage.toFixed(1);
  osd.thrFill.style.width = (input.throttle * 100).toFixed(0) + '%';
  osd.thrPct.textContent = (input.throttle * 100).toFixed(0);
  const t = physics.flightTime | 0;
  osd.timer.textContent = String((t / 60) | 0).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  osd.alt.textContent = physics.altitude.toFixed(1);
  osd.spd.textContent = physics.speedKmh.toFixed(0);
  osd.mode.textContent = fpv ? cfg.flightMode : 'AVATAR · ' + motions.state;
  osd.arm.textContent = !fpv ? '[F] DEPLOY DRONE'
    : physics.crashed ? 'CRASHED' : physics.armed ? 'ARMED' : 'DISARMED';
  osd.arm.style.color = physics.armed ? '#8dffa0' : '#ffd28d';
  osd.warn.style.display = physics.voltage < 21.4 && physics.armed ? 'block' : 'none';
  if (osd.race) osd.race.textContent = fpv ? race.osdText(performance.now()) : '';
  osd.msg.style.display = fpv && !physics.armed ? 'block' : 'none';
  osd.horizon.style.display = fpv ? 'block' : 'none';
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
    if (ev.arm) physics.armed ? physics.disarm() : physics.arm();
    if (ev.reset) physics.reset();
    if (ev.modeToggle) cfg.flightMode = cfg.flightMode === 'ACRO' ? 'ANGLE' : 'ACRO';
    if (xr.sticks?.squeeze && !physics.armed) physics.arm();  // VR grip = arm
  }

  if (mode === 'FPV') {
    acc += frameDt;
    while (acc >= PHYS_DT) { physics.step(PHYS_DT, input); acc -= PHYS_DT; }
  }
  updateAvatar(frameDt);

  droneMesh.position.copy(physics.pos);
  droneMesh.quaternion.copy(physics.quat);

  // Phase 2: obstacle crash + lap timing + ghost + sound
  if (mode === 'FPV' && physics.armed && !physics.crashed &&
      race.hitsObstacle(physics.pos)) {
    physics.crashed = true;
    physics.disarm();
  }
  race.update(physics.pos, physics.quat, now, mode === 'FPV' && physics.armed);
  droneAudio.update(physics.motors, mode === 'FPV' && physics.armed,
    physics.voltage, 21.4);
  droneMesh.props?.forEach((p, i) => {
    p.rotation.z += physics.motors[i] * 3.2;
    p.material.opacity = 0.25 + physics.motors[i] * 0.4;
  });

  // camera
  if (xr.mode === 'NONE') {
    if (mode === 'FPV') {
      camera.position.copy(physics.pos);
      camera.quaternion.copy(physics.quat);
      camera.rotateX(cfg.camAngle * Math.PI / 180);
      camera.translateZ(-0.06);
    } else {
      // 3rd-person orbit
      const target = avatar.root.position.clone().add(new THREE.Vector3(0, 1.4, 0));
      const off = new THREE.Vector3(
        Math.sin(orbitYaw) * Math.cos(orbitPitch),
        Math.sin(orbitPitch),
        Math.cos(orbitYaw) * Math.cos(orbitPitch)).multiplyScalar(4.2);
      camera.position.copy(target).add(off);
      camera.lookAt(target);
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
  if (physics.crashed && !lastCrashed) { haptic(1, 1, 320); droneAudio.crash(); }
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
