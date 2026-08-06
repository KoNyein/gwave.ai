"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import type { Avatar } from "../human";
import { createRealisticHuman, REALISTIC_VARIANTS } from "../realistichuman";
import { DEFAULT_AVATAR, type AvatarConfig } from "./config";

/// 🧑 Avatar Studio — avatar function **အားလုံး တစ်မျက်နှာတည်း** (user:
/// "function တစ်ခုတည်း page တစ်ခုတည်းမှာ — ကျဲပျံနေတယ် ကျစ်လစ်အောင်")။
///
/// အရင် customiser ရဲ့ procedural tab တွေ (ဆံပင်/မျက်နှာ/အဝတ်/ပစ္စည်း) က
/// ကာတွန်း body အတွက်သာ — realistic Mixamo body မှာ အလုပ်မလုပ်တော့လို့
/// ဖယ်ပြီး တကယ်အလုပ်လုပ်တဲ့ ၄ ခုကိုပဲ တစ်နေရာတည်း စုထားတယ်:
///   1. 🧍 ရုပ်ရွေး — realistic variant 18 (Remy/Soldier/Michelle/X Bot)
///   2. 📸 Photo Avatar — selfie ကနေ Ready Player Me လူသားရုပ်
///   3. 🧬 Scan — မျက်နှာ/ကိုယ်ခန္ဓာ scan (avatar editor page)
///   4. 📏 အရပ် — height slider (scan morph ပေါ် ထပ်ချိန်)
///
/// ★ Preview က ရွေးထားတဲ့ variant ရဲ့ realistic body အစစ် — ဆွဲလှည့်ကြည့်လို့ရ။
/// ★ Variant က localStorage (mv:soldier) + config.variant နှစ်နေရာ သိမ်း —
///   ဒီစက်မှာ ချက်ချင်း၊ တခြားစက်မှာ config ကနေ လိုက်တယ်။

const BASE_META: Record<string, { icon: string; label: string }> = {
  Remy: { icon: "🧑", label: "Remy" },
  Soldier: { icon: "🎖", label: "Soldier" },
  Michelle: { icon: "👩", label: "Michelle" },
  Xbot: { icon: "🤖", label: "X Bot" },
};

function readVariant(): string {
  try {
    const v = window.localStorage.getItem("mv:soldier");
    if (v && /^[a-r]$/.test(v)) return v;
  } catch {
    /* private mode */
  }
  return "a";
}

export function AvatarCustomiser({
  onClose,
  onPhotoAvatar,
}: {
  onClose: () => void;
  /// 📸 RPM creator overlay ဖွင့် (studio ထဲက ခလုတ်)
  onPhotoAvatar?: () => void;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const avatarRef = useRef<Avatar | null>(null);
  const holderRef = useRef<THREE.Group | null>(null);
  const [cfg, setCfg] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [variant, setVariant] = useState("a");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => setVariant(readVariant()), []);

  // ── သိမ်းထားတဲ့ config ဖတ် ──────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    void fetch("/api/metaverse/avatar", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { config?: AvatarConfig } | null) => {
        if (alive && d?.config) setCfg(d.config);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // ── 3D preview — realistic body အစစ်၊ ဆွဲလှည့်လို့ရ ────────────────────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      38,
      mount.clientWidth / mount.clientHeight,
      0.1,
      50,
    );
    camera.position.set(0, 1.1, 3.2);
    camera.lookAt(0, 0.95, 0);
    scene.add(new THREE.HemisphereLight(0xdfe9f5, 0x333a44, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(2, 4, 3);
    scene.add(key);

    // variant ပြောင်းတိုင်း body လဲလို့ရအောင် holder ခံထား
    const holder = new THREE.Group();
    scene.add(holder);
    holderRef.current = holder;

    let drag: number | null = null;
    let lastX = 0;
    const el = renderer.domElement;
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
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      avatarRef.current?.update(dt, {
        speed: 0,
        running: false,
        airborne: false,
        emote: null,
      });
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
      avatarRef.current?.dispose();
      avatarRef.current = null;
      holderRef.current = null;
      renderer.dispose();
      renderer.forceContextLoss();
      if (el.parentNode === mount) mount.removeChild(el);
    };
  }, []);

  // variant / အရပ် ပြောင်းတိုင်း preview body ပြန်ဆောက်
  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    avatarRef.current?.dispose();
    if (avatarRef.current) holder.remove(avatarRef.current.group);
    const a = createRealisticHuman(variant);
    holder.add(a.group);
    avatarRef.current = a;
    const hw = Math.max(-1, Math.min(1, (cfg.body.height - 1) * 10));
    (a.group.userData.setMorphs as
      | ((m: Record<string, number>) => void)
      | undefined)?.({ height: hw });
  }, [variant, cfg.body.height]);

  const save = async () => {
    setSaving(true);
    setNote(null);
    try {
      window.localStorage.setItem("mv:soldier", variant);
    } catch {
      /* private mode — session သက်သက် */
    }
    try {
      const res = await fetch("/api/metaverse/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config: { ...cfg, variant } }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        // Guest (login မဝင်) — local ရွေးချယ်မှုကတော့ အလုပ်လုပ်နေပြီ
        setNote(json.error ?? "Account ထဲ မသိမ်းနိုင်ပါ — ဒီစက်မှာတော့ ပြောင်းပြီးပါပြီ");
      }
      onClose();
    } catch {
      setNote("server ကို မရောက်ပါ");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const swatch = (t: number | null) =>
    t === null ? "#e8e8e8" : `#${t.toString(16).padStart(6, "0")}`;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-black/85 backdrop-blur sm:flex-row">
      {/* preview — realistic body အစစ်၊ ဆွဲလှည့် */}
      <div className="relative h-[38vh] w-full shrink-0 sm:h-full sm:w-1/2">
        <div ref={mountRef} className="h-full w-full" />
        <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[10px] text-white/60">
          ↔ ဆွဲပြီး လှည့်ကြည့်ပါ
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/90">🧑 Avatar Studio</h2>
          <button
            onClick={onClose}
            className="min-h-[44px] rounded-lg px-3 text-xs text-white/60 hover:text-white"
          >
            ပိတ်မယ်
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {/* ၁။ ရုပ်ရွေး */}
          <section>
            <p className="pb-2 text-[11px] font-medium text-white/50">
              🧍 ရုပ်ရွေး — လူသားရုပ်စစ်စစ် (နှိပ်ရင် ချက်ချင်း preview)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {REALISTIC_VARIANTS.map((v) => {
                const meta = BASE_META[v.file] ?? { icon: "🧍", label: v.file };
                return (
                  <button
                    key={v.id}
                    onClick={() => setVariant(v.id)}
                    className={`flex min-h-[44px] items-center gap-1.5 rounded-lg border px-2 py-2 text-left text-[11px] transition ${
                      variant === v.id
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                        : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10"
                    }`}
                  >
                    <span>{meta.icon}</span>
                    <span className="min-w-0 flex-1 truncate">{meta.label}</span>
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border border-white/30"
                      style={{ background: swatch(v.tint) }}
                    />
                  </button>
                );
              })}
            </div>
          </section>

          {/* ၂။ Photo Avatar + Scan — တစ်တန်းတည်း */}
          <section className="space-y-2">
            <p className="text-[11px] font-medium text-white/50">
              ✨ ကိုယ်ပိုင်မျက်နှာ/ကိုယ်ခန္ဓာနဲ့ တည်ဆောက်မယ်
            </p>
            {onPhotoAvatar && (
              <button
                onClick={onPhotoAvatar}
                className="flex min-h-[48px] w-full items-center gap-2.5 rounded-xl border border-sky-400/40 bg-sky-500/15 px-3 text-left text-xs text-sky-100 transition hover:bg-sky-500/25"
              >
                <span className="text-base">📸</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">Photo Avatar</span>
                  <span className="block text-[10px] text-sky-200/60">
                    Selfie ကနေ Ready Player Me လူသားရုပ် — ရုပ်ရွေးထက် ဦးစားပေး
                  </span>
                </span>
                {cfg.rpmUrl ? <span className="text-[10px] text-emerald-300">✓ သုံးနေသည်</span> : <span>›</span>}
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <a
                href="/profile/avatar"
                className="flex min-h-[48px] items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-xs text-white/80 transition hover:bg-white/10"
              >
                <span className="text-base">🙂</span>
                <span>
                  <span className="block font-semibold">မျက်နှာ Scan</span>
                  <span className="block text-[10px] text-white/45">ခေါင်းမှာ တပ်မယ်</span>
                </span>
              </a>
              <a
                href="/profile/avatar"
                className="flex min-h-[48px] items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-xs text-white/80 transition hover:bg-white/10"
              >
                <span className="text-base">🧍</span>
                <span>
                  <span className="block font-semibold">ကိုယ်ခန္ဓာ Scan</span>
                  <span className="block text-[10px] text-white/45">အချိုးအစား တိုင်းမယ်</span>
                </span>
              </a>
            </div>
          </section>

          {/* ၃။ အရပ် */}
          <section>
            <p className="pb-1 text-[11px] font-medium text-white/50">
              📏 အရပ် — {cfg.body.height.toFixed(2)}
            </p>
            <input
              type="range"
              min={0.9}
              max={1.1}
              step={0.01}
              value={cfg.body.height}
              onChange={(e) =>
                setCfg({
                  ...cfg,
                  body: { ...cfg.body, height: Number(e.target.value) },
                })
              }
              className="h-11 w-full accent-emerald-400"
            />
          </section>
        </div>

        {note && <div className="mt-2 text-[11px] text-amber-300">{note}</div>}

        <button
          onClick={() => void save()}
          disabled={saving}
          className="mt-3 min-h-[44px] rounded-lg bg-emerald-500/90 px-4 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {saving ? "သိမ်းနေသည်…" : "✓ သိမ်းပြီး သုံးမယ်"}
        </button>
      </div>
    </div>
  );
}
