"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

import type { Avatar } from "@/components/metaverse/human";
import { createRealisticHuman } from "@/components/metaverse/realistichuman";

/// 🏃 Movement Lab — ခေါင်း/လက်/ခြေ လှုပ်ရှားမှုကို **ကိုယ်တိုင် ချိန်ညှိပြီး
/// လေ့ကျင့်** လို့ရတဲ့ studio tab (user: "ခြေလက်ခေါင်း movement အစုံရရမည် ·
/// studio မှ movement မှာ train ခြင်း ချိန်ညှိခြင်း လုပ်နိုင်ရမည်")။
///
/// ★ Preview က metaverse ထဲမှာ တကယ်သုံးတဲ့ realistic body အစစ် — ဒီမှာ
///   မြင်ရတဲ့အတိုင်း လောကထဲမှာ ဖြစ်တယ် (WYSIWYG)။
/// ★ Slider တစ်ချက်ပြောင်းတိုင်း ချက်ချင်း သက်ရောက် — bone quaternion ကို
///   mixer/procedural update ပြီးမှ ထပ်မြှောက်တဲ့ overlay ဖြစ်လို့ ဘယ်
///   locomotion နဲ့မဆို တွဲအလုပ်လုပ်တယ်။
/// ★ သိမ်းရင် account config (`/api/metaverse/avatar` ရဲ့ `motion`) ထဲ
///   ရောက်တယ် — စက်တိုင်း၊ metaverse ရော Open World ရော အတူတူ။

export type MotionTuning = {
  /// ခေါင်း — ကြည့်ရာဘက် လိုက်လှည့်နှုန်း (0 = မလှည့်, 1 = အပြည့်)
  headFollow: number;
  /// လက် — လမ်းလျှောက်ရင် ယိမ်းနှုန်း
  armSwing: number;
  /// လက် — ဘေးမှာ ဘယ်လောက်ဖြာထား (0 = ကပ်, 1 = ကား)
  armSpread: number;
  /// ခြေ — လှမ်းအရှည်
  stride: number;
  /// ခြေ — ဒူးကွေးအား
  kneeBend: number;
  /// ကိုယ်လုံး — ရှေ့ကိုင်း (ပြေးရင် ပိုကိုင်း)
  lean: number;
  /// အသက်ရှူ — ရင်ဘတ်/ပခုံး တက်ကျ
  breathing: number;
  /// လှုပ်ရှားနှုန်း တစ်ခုလုံး (animation speed)
  tempo: number;
};

export const DEFAULT_MOTION: MotionTuning = {
  headFollow: 0.6,
  armSwing: 1,
  armSpread: 0.15,
  stride: 1,
  kneeBend: 1,
  lean: 0.25,
  breathing: 1,
  tempo: 1,
};

const SLIDERS: {
  key: keyof MotionTuning;
  icon: string;
  label: string;
  hint: string;
  max?: number;
}[] = [
  { key: "headFollow", icon: "🙂", label: "ခေါင်းလှည့်", hint: "ကြည့်ရာဘက် ခေါင်းလိုက်မှု" },
  { key: "armSwing", icon: "💪", label: "လက်ယိမ်း", hint: "လမ်းလျှောက်ချိန် လက်ရွေ့မှု", max: 2 },
  { key: "armSpread", icon: "🙆", label: "လက်ဖြာ", hint: "ဘေးမှာ လက်ကားမှု" },
  { key: "stride", icon: "🦵", label: "ခြေလှမ်း", hint: "လှမ်းအရှည်", max: 2 },
  { key: "kneeBend", icon: "🦿", label: "ဒူးကွေး", hint: "လှမ်းချိန် ဒူးကွေးအား", max: 2 },
  { key: "lean", icon: "🏃", label: "ရှေ့ကိုင်း", hint: "ပြေးရင် ကိုယ်လုံး ကိုင်းမှု" },
  { key: "breathing", icon: "🫁", label: "အသက်ရှူ", hint: "ရပ်နေချိန် ရင်ဘတ်လှုပ်ရှား", max: 2 },
  { key: "tempo", icon: "⏩", label: "အမြန်နှုန်း", hint: "လှုပ်ရှားမှု တစ်ခုလုံး", max: 2 },
];

type Gait = "idle" | "walk" | "run";

const B = (n: string) => `mixamorig:${n}`;

export function MovementLab({ variant }: { variant: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const avatarRef = useRef<Avatar | null>(null);
  const motionRef = useRef<MotionTuning>(DEFAULT_MOTION);
  const gaitRef = useRef<Gait>("walk");

  const [motion, setMotion] = useState<MotionTuning>(DEFAULT_MOTION);
  const [gait, setGait] = useState<Gait>("walk");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  motionRef.current = motion;
  gaitRef.current = gait;

  // ── သိမ်းထားတဲ့ tuning ဖတ် ─────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    void fetch("/api/metaverse/avatar", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { config?: { motion?: Partial<MotionTuning> } } | null) => {
        if (alive && d?.config?.motion) {
          setMotion({ ...DEFAULT_MOTION, ...d.config.motion });
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // ── 3D preview ────────────────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f17);
    const camera = new THREE.PerspectiveCamera(
      38,
      mount.clientWidth / Math.max(1, mount.clientHeight),
      0.1,
      50,
    );
    camera.position.set(2.2, 1.5, 2.8);
    camera.lookAt(0, 1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xdfe9f5, 0x2a3040, 1));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(2, 4, 2.5);
    scene.add(key);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2, 40),
      new THREE.MeshStandardMaterial({ color: 0x151b28, roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const holder = new THREE.Group();
    scene.add(holder);
    const avatar = createRealisticHuman(variant);
    holder.add(avatar.group);
    avatarRef.current = avatar;

    // drag to orbit
    let drag: number | null = null;
    let lastX = 0;
    const el = renderer.domElement;
    el.style.touchAction = "none";
    const down = (e: PointerEvent) => {
      drag = e.pointerId;
      lastX = e.clientX;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (drag !== e.pointerId) return;
      holder.rotation.y += (e.clientX - lastX) * 0.01;
      lastX = e.clientX;
    };
    const up = (e: PointerEvent) => {
      if (drag === e.pointerId) drag = null;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);

    const onResize = () => {
      camera.aspect = mount.clientWidth / Math.max(1, mount.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    let t = 0;
    let raf = 0;
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const m = motionRef.current;
      const dt = Math.min(clock.getDelta(), 0.05) * m.tempo;
      t += dt;
      const g = gaitRef.current;
      const speed = g === "walk" ? 2.4 : g === "run" ? 6.2 : 0;

      avatar.update(dt, {
        speed,
        running: g === "run",
        airborne: false,
        emote: null,
      });

      // ── Tuning overlay — locomotion ပြီးမှ bone ပေါ် ထပ်မြှောက်တယ်၊
      //    ဒါကြောင့် baked clip ရော procedural ရော နှစ်မျိုးလုံးမှာ ရတယ်။
      const root = avatar.group;
      const bone = (n: string) => root.getObjectByName(B(n));
      const phase = t * (g === "run" ? 9 : 5);
      const cyc = speed > 0 ? Math.sin(phase) : 0;

      const head = bone("Head");
      if (head) {
        e.set(0, Math.sin(t * 0.8) * 0.5 * m.headFollow, 0);
        head.quaternion.multiply(q.setFromEuler(e));
      }
      const spine = bone("Spine1") ?? bone("Spine");
      if (spine) {
        const br = speed > 0 ? 0 : Math.sin(t * 1.6) * 0.03 * m.breathing;
        e.set(m.lean * (speed > 0 ? (g === "run" ? 0.3 : 0.12) : 0) + br, 0, 0);
        spine.quaternion.multiply(q.setFromEuler(e));
      }
      for (const [n, dir] of [
        ["LeftArm", 1],
        ["RightArm", -1],
      ] as const) {
        const b = bone(n);
        if (!b) continue;
        e.set(cyc * dir * 0.5 * (m.armSwing - 1), 0, dir * -0.5 * m.armSpread);
        b.quaternion.multiply(q.setFromEuler(e));
      }
      for (const [n, dir] of [
        ["LeftUpLeg", 1],
        ["RightUpLeg", -1],
      ] as const) {
        const b = bone(n);
        if (!b) continue;
        e.set(cyc * dir * 0.45 * (m.stride - 1), 0, 0);
        b.quaternion.multiply(q.setFromEuler(e));
      }
      for (const n of ["LeftLeg", "RightLeg"]) {
        const b = bone(n);
        if (!b) continue;
        const bend = Math.max(0, -cyc * (n[0] === "L" ? 1 : -1));
        e.set(-bend * 0.5 * (m.kneeBend - 1), 0, 0);
        b.quaternion.multiply(q.setFromEuler(e));
      }

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      avatar.dispose();
      avatarRef.current = null;
      renderer.dispose();
      if (el.parentNode === mount) mount.removeChild(el);
    };
  }, [variant]);

  const save = useCallback(async () => {
    setSaving(true);
    setNote(null);
    try {
      const cur = await fetch("/api/metaverse/avatar", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      const res = await fetch("/api/metaverse/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config: { ...(cur?.config ?? {}), motion } }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      setNote(
        res.ok && json.ok
          ? "✓ သိမ်းပြီး — လောကထဲမှာ ဒီအတိုင်း လှုပ်ပါမယ်"
          : (json.error ?? "သိမ်းလို့ မရပါ"),
      );
    } catch {
      setNote("server ကို မရောက်ပါ");
    } finally {
      setSaving(false);
    }
  }, [motion]);

  return (
    <div className="flex h-full flex-col md:flex-row">
      <div className="relative min-h-[42dvh] flex-1 md:min-h-0">
        <div ref={mountRef} className="h-full w-full" />
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
          {(
            [
              ["idle", "🧍 ရပ်"],
              ["walk", "🚶 လျှောက်"],
              ["run", "🏃 ပြေး"],
            ] as [Gait, string][]
          ).map(([g, label]) => (
            <button
              key={g}
              onClick={() => setGait(g)}
              className={`rounded-full border px-3 py-1.5 text-[12px] backdrop-blur ${
                gait === g
                  ? "border-emerald-400/70 bg-emerald-500/30 text-emerald-100"
                  : "border-white/20 bg-black/40 text-white/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex w-full flex-col border-t border-white/10 md:w-80 md:border-l md:border-t-0">
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          <p className="text-[12px] leading-relaxed text-white/55">
            🏃 လှုပ်ရှားမှုကို ကိုယ်တိုင် ချိန်ပါ — ဆွဲလိုက်တာနဲ့ ချက်ချင်း
            မြင်ရမယ်။ သိမ်းရင် Metaverse ရော Open World ရော ဒီအတိုင်း ဖြစ်တယ်။
          </p>
          {SLIDERS.map((sl) => (
            <label key={sl.key} className="block">
              <span className="mb-0.5 flex items-center justify-between text-[12px]">
                <span className="text-white/80">
                  {sl.icon} {sl.label}
                </span>
                <span className="tabular-nums text-white/45">
                  {Math.round(motion[sl.key] * 100)}
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={sl.max ?? 1}
                step={0.02}
                value={motion[sl.key]}
                onChange={(ev) =>
                  setMotion((m) => ({ ...m, [sl.key]: Number(ev.target.value) }))
                }
                className="w-full accent-emerald-400"
              />
              <span className="block text-[10.5px] text-white/35">{sl.hint}</span>
            </label>
          ))}
          <button
            onClick={() => setMotion(DEFAULT_MOTION)}
            className="w-full rounded-lg border border-white/20 py-2 text-[12px] text-white/70 hover:bg-white/5"
          >
            ↺ မူလအတိုင်း ပြန်ထား
          </button>
        </div>
        <div className="border-t border-white/10 p-3">
          {note && (
            <p className="mb-2 rounded bg-white/10 px-2 py-1 text-[11px] text-white/80">
              {note}
            </p>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
          >
            {saving ? "သိမ်းနေသည်…" : "💾 လှုပ်ရှားမှု သိမ်းမယ်"}
          </button>
        </div>
      </div>
    </div>
  );
}
