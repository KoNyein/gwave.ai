"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import type { Avatar } from "@/components/metaverse/human";
import { createRealisticHuman } from "@/components/metaverse/realistichuman";
import type { AvatarConfig, MorphWeights } from "../types";
import { MORPH_KEYS } from "../types";

/// 🧬 Editor preview v3 — realistic Mixamo body + physics feel။
///
/// v2 complaint: "UI UX နဲ့ 3D quality အရမ်းနိမ့်တယ်" — အရင် preview က
/// Soldier GLB ကို scale ၃ ချက်နဲ့ ခန့်မှန်းပြတာ။ အခု —
/// ★ Body = createRealisticHuman — metaverse ထဲမှာ တကယ်သုံးမယ့် rig အစစ်၊
///   အသက်ရှူ idle / လမ်းလျှောက် / emote အကုန်ပါ — WYSIWYG။
/// ★ Morph ၁၁ ခုလုံး bone-level သက်ရောက် (setMorphs) — slider တစ်ချက်ချင်း
///   spring-damped ဖြစ်ပြီး တဖြည်းဖြည်း ပြောင်းတယ် (snap မဖြစ်)။
/// ★ Physics: turntable မှာ drag inertia (လွှတ်ရင် အရှိန်နဲ့ ဆက်လည်ပြီး
///   friction နဲ့ ရပ်)၊ zoom spring၊ shadow အစစ်။
/// ★ Scan face GLB — head bone မှာ rigid attach (metaverse scanface.ts နဲ့
///   သဘောတူ) — body နဲ့အတူ လှုပ်တယ်။

export type PreviewMotion = "idle" | "walk" | "run" | "wave" | "dance";

function readVariant(): string {
  try {
    const v = window.localStorage.getItem("mv:soldier");
    if (v && /^[a-r]$/.test(v)) return v;
  } catch {
    /* private mode */
  }
  return "a";
}

export function AvatarPreview({
  config,
  bodyGlbUrl,
  variant,
  motion = "idle",
}: {
  config: AvatarConfig;
  /// Legacy outfit-asset override — null ဆို realistic body (default)
  bodyGlbUrl: string | null;
  /// realistichuman variant (a–r) — မပေးရင် localStorage (mv:soldier)
  variant?: string | null;
  /// လှုပ်ရှားဟန် စမ်းကြည့် — idle/walk/run/wave/dance
  motion?: PreviewMotion;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const applyRef = useRef<((c: AvatarConfig) => void) | null>(null);
  const motionRef = useRef<PreviewMotion>(motion);
  motionRef.current = motion;

  useEffect(() => {
    applyRef.current?.(config);
  }, [config]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x10141d);
    scene.fog = new THREE.Fog(0x10141d, 6, 14);
    const camera = new THREE.PerspectiveCamera(
      36,
      mount.clientWidth / Math.max(1, mount.clientHeight),
      0.1,
      50,
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    // Studio light rig — key(shadow) + hemi fill + rim
    scene.add(new THREE.HemisphereLight(0xdfe9f5, 0x2a3040, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(2, 4, 2.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 12;
    key.shadow.camera.left = -2;
    key.shadow.camera.right = 2;
    key.shadow.camera.top = 3;
    key.shadow.camera.bottom = -1;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.8);
    rim.position.set(-2, 2, -2);
    scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 48),
      new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.92 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.18, 1.22, 64),
      new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.25 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    scene.add(ring);

    const holder = new THREE.Group();
    scene.add(holder);

    let disposed = false;
    let avatar: Avatar | null = null;
    let legacyMixer: THREE.AnimationMixer | null = null;
    let legacyRoot: THREE.Object3D | null = null;
    let facePlate: THREE.Object3D | null = null;
    let faceUrlLoaded: string | null = null;
    const loader = new GLTFLoader();

    // ── Physics state ────────────────────────────────────────────────────
    let dragging = false;
    let lastX = 0;
    let spinVel = 0.4; // rad/s — idle turntable; drag က override
    let zoomTarget = 3.3;
    let zoom = 3.3;
    /// Morph spring — display value → target ကို critically-damped ဆွဲ
    const morphNow: Record<string, number> = {};
    let morphTarget: MorphWeights = {};
    let tintColor = new THREE.Color("#ffffff");
    let lastCfg: AvatarConfig | null = null;

    const applyTint = () => {
      const root = avatar?.group ?? legacyRoot;
      if (!root) return;
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (!(m instanceof THREE.MeshStandardMaterial)) continue;
          const store = m.userData as { origColor?: THREE.Color };
          store.origColor ??= m.color.clone();
          m.color.copy(store.origColor).multiply(tintColor);
        }
      });
    };

    /// 🧬 Scan face GLB → head attach (world-scale ချေဖျက်ပြီး မျက်နှာအရွယ်မှန်)
    const loadFacePlate = (url: string | null) => {
      if (url === faceUrlLoaded) return;
      faceUrlLoaded = url;
      if (facePlate) {
        facePlate.parent?.remove(facePlate);
        facePlate = null;
      }
      if (!url) return;
      loader.load(
        url,
        (g) => {
          if (disposed || url !== faceUrlLoaded) return;
          const host = avatar?.attach.head ?? legacyRoot;
          if (!host) return;
          facePlate = g.scene;
          host.add(facePlate);
          host.updateWorldMatrix(true, false);
          const ws = new THREE.Vector3();
          host.getWorldScale(ws);
          const inv = ws.x > 1e-6 ? 1 / ws.x : 1;
          facePlate.scale.setScalar(inv);
          facePlate.position.set(0, 0.03 * inv, 0.1 * inv);
        },
        undefined,
        () => {
          /* face GLB ဆွဲမရ — body သက်သက်နဲ့ ဆက်ပြ */
        },
      );
    };

    const applyConfig = (c: AvatarConfig) => {
      lastCfg = c;
      morphTarget = c.morphs;
      tintColor = new THREE.Color(c.skinColor).lerp(new THREE.Color("#ffffff"), 0.6);
      applyTint();
      loadFacePlate(c.faceGlbUrl);
    };
    applyRef.current = applyConfig;

    // ── Body ─────────────────────────────────────────────────────────────
    if (bodyGlbUrl) {
      // Legacy outfit asset path — GLB ကို တိုက်ရိုက် (idle clip ရှိရင် ဖွင့်)
      loader.load(
        bodyGlbUrl,
        (gltf) => {
          if (disposed) return;
          legacyRoot = gltf.scene;
          const box = new THREE.Box3().setFromObject(legacyRoot);
          const size = box.getSize(new THREE.Vector3());
          const s = size.y > 0 ? 1.7 / size.y : 1;
          legacyRoot.scale.setScalar(s);
          const box2 = new THREE.Box3().setFromObject(legacyRoot);
          legacyRoot.position.y -= box2.min.y;
          legacyRoot.traverse((o) => {
            if ((o as THREE.Mesh).isMesh) o.castShadow = true;
          });
          holder.add(legacyRoot);
          const idle =
            gltf.animations.find((a) => a.name.toLowerCase().includes("idle")) ??
            gltf.animations[0];
          if (idle) {
            legacyMixer = new THREE.AnimationMixer(legacyRoot);
            legacyMixer.clipAction(idle).play();
          }
          if (lastCfg) applyConfig(lastCfg);
        },
        undefined,
        () => undefined,
      );
    } else {
      avatar = createRealisticHuman(variant ?? readVariant());
      holder.add(avatar.group);
      // Model load က async — materials ရောက်လာမှ tint/morph ပြန်စမ်းဖို့
      // frame loop ထဲမှာ dirty-check လုပ်တယ် (အောက် tick)။
    }

    // ── Input: drag inertia + wheel/pinch zoom ───────────────────────────
    const el = renderer.domElement;
    el.style.touchAction = "none";
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDist = 0;
    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture(e.pointerId);
      if (pointers.size === 1) {
        dragging = true;
        lastX = e.clientX;
        spinVel = 0;
      } else if (pointers.size === 2) {
        dragging = false;
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      }
    };
    const onMove = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (pinchDist > 0) {
          zoomTarget = THREE.MathUtils.clamp(
            zoomTarget * (pinchDist / Math.max(1, d)),
            1.6,
            5,
          );
        }
        pinchDist = d;
        return;
      }
      if (!dragging) return;
      const dx = e.clientX - lastX;
      holder.rotation.y += dx * 0.011;
      spinVel = dx * 0.011 * 60; // drag velocity → release inertia
      lastX = e.clientX;
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDist = 0;
      if (pointers.size === 0) dragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomTarget = THREE.MathUtils.clamp(
        zoomTarget * (1 + Math.sign(e.deltaY) * 0.12),
        1.6,
        5,
      );
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    const onResize = () => {
      camera.aspect = mount.clientWidth / Math.max(1, mount.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    let raf = 0;
    let materialsSeen = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);

      // Turntable inertia — drag လွှတ်ရင် အရှိန်ကျန်ပြီး friction နဲ့ နှေး
      if (!dragging) {
        holder.rotation.y += spinVel * dt;
        spinVel = THREE.MathUtils.damp(spinVel, 0.4, 1.2, dt);
      }
      // Zoom spring
      zoom = THREE.MathUtils.damp(zoom, zoomTarget, 8, dt);
      camera.position.set(0, 1.05 + zoom * 0.16, zoom);
      camera.lookAt(0, 0.95, 0);

      // Morph spring — display → target တဖြည်းဖြည်း (bone scale တွေ ချော)
      if (avatar) {
        let dirty = false;
        for (const k of MORPH_KEYS) {
          const t = morphTarget[k] ?? 0;
          const cur = morphNow[k] ?? 0;
          if (Math.abs(t - cur) > 0.001) {
            morphNow[k] = THREE.MathUtils.damp(cur, t, 10, dt);
            dirty = true;
          }
        }
        if (dirty) {
          (avatar.group.userData.setMorphs as
            | ((m: Record<string, number>) => void)
            | undefined)?.(morphNow);
        }
        // Model async load ပြီးမှ materials ပေါ်လာတယ် — အသစ်တွေ့ရင် tint ပြန်ထည့်
        let count = 0;
        avatar.group.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) count++;
        });
        if (count !== materialsSeen) {
          materialsSeen = count;
          applyTint();
          if (faceUrlLoaded) {
            const u = faceUrlLoaded;
            faceUrlLoaded = null;
            loadFacePlate(u);
          }
        }
        const m = motionRef.current;
        avatar.update(dt, {
          speed: m === "walk" ? 2.2 : m === "run" ? 6 : 0,
          running: m === "run",
          airborne: false,
          emote: m === "wave" ? "wave" : m === "dance" ? "dance" : null,
        });
      }
      legacyMixer?.update(dt);
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
      avatar?.dispose();
      renderer.dispose();
      if (el.parentNode === mount) mount.removeChild(el);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) m.dispose();
        }
      });
    };
    // config intentionally excluded — applyRef effect streams live updates;
    // rebuilding the scene per slider tick would stutter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyGlbUrl, variant]);

  return <div ref={mountRef} className="h-full w-full" />;
}
