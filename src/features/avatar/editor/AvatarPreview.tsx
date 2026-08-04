"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import type { AvatarConfig } from "../types";

/// 🧬 Editor preview — turntable + idle animation (spec §8)။
///
/// ★ Phase 1 placeholder body = kit character GLB (27-clip rigged)။
///   Morph slider တွေက **placeholder mapping** — height/weight/headScale
///   ကို scale နဲ့ ခန့်မှန်းပြတယ်၊ ကျန်တာ config ထဲ သိမ်းပြီး Phase 1
///   asset (11-morph base body) ရောက်မှ တကယ့် morph target ဖြစ်မယ်။
/// ★ GLB ကို config.outfitId ပြောင်းမှသာ ပြန်ဆွဲတယ် — slider လှုပ်တိုင်း
///   ပြန်ဆွဲရင် editor က လေးသွားမယ်။

const KIT_BASE = "/metaverse/kits/characters/";
const FALLBACK_GLB = `${KIT_BASE}character-a.glb`;

export function AvatarPreview({
  config,
  bodyGlbUrl,
}: {
  config: AvatarConfig;
  bodyGlbUrl: string | null;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  /// morph/skin update တွေက three ဘက်ကို ref တစ်ခုတည်းနဲ့ ရောက်တယ် —
  /// React re-render မလို
  const applyRef = useRef<((c: AvatarConfig) => void) | null>(null);

  useEffect(() => {
    applyRef.current?.(config);
  }, [config]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x10141d);
    const camera = new THREE.PerspectiveCamera(
      38,
      mount.clientWidth / Math.max(1, mount.clientHeight),
      0.1,
      50,
    );
    camera.position.set(0, 1.5, 3.4);
    camera.lookAt(0, 1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    // Light rig — key + fill + rim (spec §8 preview)
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2, 3, 2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.7);
    rim.position.set(-2, 2, -2);
    scene.add(rim);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.4, 40),
      new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const holder = new THREE.Group();
    scene.add(holder);

    let mixer: THREE.AnimationMixer | null = null;
    let disposed = false;
    let dragging = false;
    let lastX = 0;
    const spin = 0.35; // auto-turntable rad/s — drag ရင် ရပ်

    const tintMats: THREE.MeshStandardMaterial[] = [];
    let modelRoot: THREE.Object3D | null = null;
    let headBone: THREE.Object3D | null = null;
    let facePlate: THREE.Object3D | null = null;
    let faceUrlLoaded: string | null = null;

    /// 🧬 Scan face GLB ကို ခေါင်း node မှာ rigid attach (spec §6 HeadSocket
    /// သဘော — placeholder body မှာ socket မပါလို့ head node ကို တိုက်ရိုက်)
    const loadFacePlate = (url: string | null) => {
      if (url === faceUrlLoaded) return;
      faceUrlLoaded = url;
      if (facePlate) {
        facePlate.parent?.remove(facePlate);
        facePlate = null;
      }
      if (!url || !modelRoot) return;
      loader.load(
        url,
        (g) => {
          if (disposed || url !== faceUrlLoaded || !modelRoot) return;
          facePlate = g.scene;
          const host = headBone ?? modelRoot;
          host.add(facePlate);
          // Head node ရဲ့ world scale ကို ချေဖျက်ပြီး မျက်နှာအရွယ် မှန်အောင်
          const ws = new THREE.Vector3();
          host.getWorldScale(ws);
          const inv = ws.x !== 0 ? 1 / ws.x : 1;
          facePlate.scale.setScalar(inv);
          // ခေါင်းရှေ့ဘက် အနည်းငယ် — kit head က ~0.12m radius လောက်
          facePlate.position.set(0, 0.02 * inv, 0.09 * inv);
        },
        undefined,
        () => {
          /* face GLB ဆွဲမရ — body သက်သက်နဲ့ ဆက်ပြ */
        },
      );
    };

    const applyConfig = (c: AvatarConfig) => {
      if (!modelRoot) return;
      const m = c.morphs;
      // Placeholder morph mapping (Phase 1) — scale approximations
      const h = 1 + 0.12 * (m.height ?? 0);
      const w = 1 + 0.1 * (m.weight ?? 0) + 0.05 * (m.muscle ?? 0);
      modelRoot.scale.set(w, h, w);
      if (headBone) {
        const hs = 1 + 0.18 * (m.headScale ?? 0);
        headBone.scale.setScalar(hs);
      }
      // Skin tint — kit texture ပေါ် အနုစား multiply
      const tint = new THREE.Color(c.skinColor).lerp(new THREE.Color("#ffffff"), 0.55);
      for (const mat of tintMats) mat.color.copy(tint);
      // 🧬 Scan မျက်နှာ — URL ပြောင်းမှသာ ပြန်ဆွဲ
      loadFacePlate(c.faceGlbUrl);
    };
    applyRef.current = (c) => applyConfig(c);

    const loader = new GLTFLoader();
    const url = bodyGlbUrl || FALLBACK_GLB;
    loader.load(
      url,
      (gltf) => {
        if (disposed) return;
        holder.clear();
        tintMats.length = 0;
        modelRoot = gltf.scene;
        modelRoot.scale.setScalar(1);
        // Kit character တွေက scale ကြီး — bounding box နဲ့ ~1.7m ဖြစ်အောင် ညှိ
        const box = new THREE.Box3().setFromObject(modelRoot);
        const size = box.getSize(new THREE.Vector3());
        const s = size.y > 0 ? 1.7 / size.y : 1;
        modelRoot.scale.setScalar(s);
        const box2 = new THREE.Box3().setFromObject(modelRoot);
        modelRoot.position.y -= box2.min.y;
        holder.add(modelRoot);

        modelRoot.traverse((o) => {
          if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
            // Clone — asset cache ကို မညစ်အောင်
            o.material = o.material.clone();
            tintMats.push(o.material as THREE.MeshStandardMaterial);
          }
          const n = o.name.toLowerCase();
          if (!headBone && (n === "head" || n.endsWith("head"))) headBone = o;
        });

        const idle =
          gltf.animations.find((a) => a.name.toLowerCase().includes("idle")) ??
          gltf.animations[0];
        if (idle) {
          mixer = new THREE.AnimationMixer(modelRoot);
          mixer.clipAction(idle).play();
        }
        applyConfig(config);
      },
      undefined,
      () => {
        /* GLB ဆွဲမရ — မျက်နှာပြင် မည်းနေမယ့်အစား placeholder box */
        if (disposed) return;
        const ph = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.3, 1, 6, 12),
          new THREE.MeshStandardMaterial({ color: 0x334455 }),
        );
        ph.position.y = 0.85;
        holder.add(ph);
      },
    );

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      holder.rotation.y += (e.clientX - lastX) * 0.01;
      lastX = e.clientX;
    };
    const onUp = () => {
      dragging = false;
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    const onResize = () => {
      camera.aspect = mount.clientWidth / Math.max(1, mount.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = clock.getDelta();
      if (!dragging) holder.rotation.y += spin * dt;
      mixer?.update(dt);
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) m.dispose();
        }
      });
    };
    // config intentionally excluded — applyRef effect handles live updates;
    // rebuilding the whole scene per slider tick would stutter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyGlbUrl]);

  return <div ref={mountRef} className="h-full w-full" />;
}
