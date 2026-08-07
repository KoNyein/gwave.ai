/// Edu Arcade ရဲ့ three.js engine အနှစ် — game တိုင်း မျှဝေသုံးတယ်။
///
/// ★ Asset file မလိုဘူး — emoji/စာလုံးတွေကို canvas texture အဖြစ် ဆွဲပြီး
///   sprite/box ပေါ် ကပ်တယ်။ ဖုန်းမှာ load ချက်ချင်းပြီး ရုပ်ထွက်လည်း
///   ရောင်စုံလှတယ်။
/// ★ Interaction က **tap raycast** တစ်ခုတည်း — mouse/touch နှစ်မျိုးလုံး
///   အလုပ်လုပ်တယ် (PC / iPad / ဖုန်း)။

import * as THREE from "three";

import { applyGpuBudget, gpuRendererOptions } from "@/lib/gpu-budget";

/// Emoji ကို canvas texture အဖြစ် ဆွဲတယ်
export function emojiTexture(emoji: string, size = 256): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${size * 0.72}px sans-serif`;
  ctx.fillText(emoji, size / 2, size / 2 + size * 0.04);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/// စာသား (ဂဏန်း/hex/စာလုံး) texture — ရွေးစရာ tile တွေအတွက်
export function textTexture(
  text: string,
  opts?: { bg?: string; fg?: string; size?: number },
): THREE.CanvasTexture {
  const size = opts?.size ?? 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  if (opts?.bg) {
    ctx.fillStyle = opts.bg;
    // ထောင့်ဝိုင်း tile
    const r = size * 0.16;
    ctx.beginPath();
    ctx.roundRect(size * 0.04, size * 0.04, size * 0.92, size * 0.92, r);
    ctx.fill();
  }
  ctx.fillStyle = opts?.fg ?? "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fs = text.length > 5 ? size * 0.28 : text.length > 2 ? size * 0.4 : size * 0.56;
  ctx.font = `bold ${fs}px ui-monospace, monospace`;
  ctx.fillText(text, size / 2, size / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/// ရိုးရှင်း sound effects — WebAudio synth (file မလို)။ AudioContext ကို
/// ပထမ tap မှာမှ ဖွင့်တယ် (browser policy)။
export function makeSynth() {
  let ctx: AudioContext | null = null;
  const ensure = () => {
    if (!ctx) {
      try {
        ctx = new AudioContext();
      } catch {
        ctx = null;
      }
    }
    if (ctx?.state === "suspended") void ctx.resume();
    return ctx;
  };
  const blip = (freq: number, dur: number, type: OscillatorType, vol = 0.15) => {
    const a = ensure();
    if (!a) return;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.connect(g).connect(a.destination);
    o.start();
    o.stop(a.currentTime + dur);
  };
  return {
    unlock: ensure,
    pop() {
      blip(660, 0.12, "triangle");
      blip(990, 0.18, "sine", 0.1);
    },
    buzz() {
      blip(140, 0.25, "sawtooth", 0.12);
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => blip(f, 0.25, "triangle", 0.14), i * 120),
      );
    },
    tick() {
      blip(880, 0.05, "square", 0.05);
    },
  };
}

export type Synth = ReturnType<typeof makeSynth>;

export type Arcade = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  add(obj: THREE.Object3D): void;
  /// Tap ခံမယ့် object စာရင်းထဲ ထည့် (raycast target)
  pickable(obj: THREE.Object3D, id: string): void;
  clearPickables(): void;
  onTap(cb: (id: string, obj: THREE.Object3D) => void): void;
  confetti(at: THREE.Vector3, color?: number): void;
  /// မှားရင် object ကို ခါစေ
  shake(obj: THREE.Object3D): void;
  /// Frame callback (game logic / animation)
  onFrame(cb: (dt: number, t: number) => void): void;
  dispose(): void;
};

export function createArcade(mount: HTMLElement): Arcade {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101a33);
  scene.fog = new THREE.Fog(0x101a33, 18, 55);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 3.2, 10);
  camera.lookAt(0, 1.6, 0);

  const renderer = new THREE.WebGLRenderer(gpuRendererOptions());
  applyGpuBudget(renderer);
  mount.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x334466, 1.0));
  const key = new THREE.DirectionalLight(0xffe9c9, 1.2);
  key.position.set(5, 9, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x88aaff, 0.5);
  rim.position.set(-6, 4, -6);
  scene.add(rim);

  // စင်မြင့် ကြမ်းပြင် — အရောင်နုနဲ့ ဝိုင်းစက်
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(16, 48),
    new THREE.MeshStandardMaterial({ color: 0x1b2b4d, roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(6.4, 6.7, 48),
    new THREE.MeshBasicMaterial({ color: 0x3d5da8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  scene.add(ring);

  // နောက်ခံ ကြယ်လေးတွေ — ပညာရေး app ဆိုပေမယ့် ကလေးတွေ ကြိုက်တဲ့
  // ညကောင်းကင် mood
  {
    const n = 220;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 22 + Math.random() * 18;
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = 2 + Math.random() * 18;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9db8ff, size: 0.12 })));
  }

  const onResize = () => {
    const w = mount.clientWidth;
    const h = mount.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  onResize();
  window.addEventListener("resize", onResize);

  // ── Tap raycast ──────────────────────────────────────────────────────
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickables = new Map<THREE.Object3D, string>();
  let tapCb: ((id: string, obj: THREE.Object3D) => void) | null = null;
  const onPointer = (e: PointerEvent) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([...pickables.keys()], true);
    if (hits.length === 0) return;
    // Hit ဖြစ်တဲ့ mesh ရဲ့ pickable root ကို ရှာ
    let o: THREE.Object3D | null = hits[0]!.object;
    while (o) {
      if (pickables.has(o)) {
        tapCb?.(pickables.get(o)!, o);
        return;
      }
      o = o.parent;
    }
  };
  renderer.domElement.addEventListener("pointerdown", onPointer);

  // ── Confetti + shake ────────────────────────────────────────────────
  type Burst = { pts: THREE.Points; vel: THREE.Vector3[]; mat: THREE.PointsMaterial; geo: THREE.BufferGeometry };
  const bursts: Burst[] = [];
  const shakes = new Map<THREE.Object3D, { t: number; base: number }>();

  // ── Loop ─────────────────────────────────────────────────────────────
  const clock = new THREE.Clock();
  let frameCb: ((dt: number, t: number) => void) | null = null;
  let raf = 0;
  let t = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    // 🔋 မမြင်ရချိန် frame မပုံဖော်ဘူး (WebView/PWA မှာ rAF က မရပ်ဘူး)
    if (document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    // Camera က ဖြည်းဖြည်း လူးလာနေတယ် — static ဖြစ်မနေအောင်
    camera.position.x = Math.sin(t * 0.12) * 1.2;
    camera.lookAt(0, 1.6, 0);
    frameCb?.(dt, t);
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]!;
      const arr = b.geo.getAttribute("position") as THREE.BufferAttribute;
      for (let j = 0; j < b.vel.length; j++) {
        b.vel[j]!.y -= 9 * dt;
        arr.setXYZ(
          j,
          arr.getX(j) + b.vel[j]!.x * dt,
          arr.getY(j) + b.vel[j]!.y * dt,
          arr.getZ(j) + b.vel[j]!.z * dt,
        );
      }
      arr.needsUpdate = true;
      b.mat.opacity -= dt * 0.8;
      if (b.mat.opacity <= 0) {
        scene.remove(b.pts);
        b.geo.dispose();
        b.mat.dispose();
        bursts.splice(i, 1);
      }
    }
    for (const [obj, s] of shakes) {
      s.t -= dt;
      obj.position.x = s.base + Math.sin(s.t * 60) * 0.12 * Math.max(0, s.t);
      if (s.t <= 0) {
        obj.position.x = s.base;
        shakes.delete(obj);
      }
    }
    renderer.render(scene, camera);
  };
  tick();

  return {
    scene,
    camera,
    add: (o) => scene.add(o),
    pickable(obj, id) {
      pickables.set(obj, id);
    },
    clearPickables() {
      pickables.clear();
    },
    onTap(cb) {
      tapCb = cb;
    },
    confetti(at, color) {
      const n = 46;
      const pos = new Float32Array(n * 3);
      const vel: THREE.Vector3[] = [];
      for (let i = 0; i < n; i++) {
        pos[i * 3] = at.x;
        pos[i * 3 + 1] = at.y;
        pos[i * 3 + 2] = at.z;
        vel.push(new THREE.Vector3((Math.random() - 0.5) * 7, 2 + Math.random() * 6, (Math.random() - 0.5) * 7));
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color: color ?? [0xf5c542, 0x44e0c0, 0xf06a9a, 0x7ea0ff][Math.floor(Math.random() * 4)],
        size: 0.22,
        transparent: true,
        opacity: 1,
      });
      const pts = new THREE.Points(geo, mat);
      scene.add(pts);
      bursts.push({ pts, vel, mat, geo });
    },
    shake(obj) {
      shakes.set(obj, { t: 0.45, base: obj.position.x });
    },
    onFrame(cb) {
      frameCb = cb;
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerdown", onPointer);
      renderer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mm = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mm)) mm.forEach((x) => x.dispose());
        else mm?.dispose();
      });
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    },
  };
}
