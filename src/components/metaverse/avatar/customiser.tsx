"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { createHuman, type Avatar } from "../human";
import {
  ACCESSORIES,
  CLOTH_PALETTE,
  DEFAULT_AVATAR,
  HAIR_COLORS,
  MAX_ACCESSORIES,
  PART_IDS,
  SKIN_TONES,
  type AvatarConfig,
} from "./config";
import { applyAvatarConfig } from "./parts";

/// Avatar ပြင်ဆင်ရေး (spec 15.3)。
///
/// မဖြစ်မနေ ၄ ချက်:
///  1. **Live preview** — ပြောင်းတိုင်း ချက်ချင်း မြင်ရမယ် (သိမ်းမလုပ်ခင်)
///  2. **Idle animation** — ရုပ်တုလို ငြိမ်နေရင် မလှဘူး
///  3. **ပိတ်ထားတဲ့ပစ္စည်းကို 🔒 နဲ့ ပြထား** — ဖျောက်ထားရင် ရှိမှန်းမသိဘူး
///  4. **ဖုန်းအတွက်** — ခလုတ်တိုင်း ၄၄px အနည်းဆုံး

type Tab = "body" | "hair" | "face" | "outfit" | "extra";

const TABS: { id: Tab; label: string }[] = [
  { id: "body", label: "ကိုယ်" },
  { id: "hair", label: "ဆံပင်" },
  { id: "face", label: "မျက်နှာ" },
  { id: "outfit", label: "အဝတ်" },
  { id: "extra", label: "ပစ္စည်း" },
];

const LABELS: Record<string, string> = {
  none: "မရှိ", short: "တို", long: "ရှည်", bun: "ထုံး", braid: "ကျစ်",
  normal: "ပုံမှန်", happy: "ပျော်", sharp: "ထက်", sleepy: "အိပ်ငိုက်",
  thick: "ထူ", thin: "ပါး", smile: "ပြုံး", flat: "တည်",
  tee: "တီရှပ်", shirt: "ရှပ်အင်္ကျီ", hoodie: "ဟူးဒီ", tank: "လက်ပြတ်",
  longyi_top: "မြန်မာအင်္ကျီ", jeans: "ဂျင်း", shorts: "ဘောင်းဘီတို",
  skirt: "စကတ်", longyi: "လုံချည်", sneaker: "ဖိနပ်", boot: "ဘွတ်ဖိနပ်",
  sandal: "ညှပ်ဖိနပ်", barefoot: "ခြေဗလာ", slim: "ပိန်", broad: "ကြံ့ခိုင်",
};
const lab = (id: string) => LABELS[id] ?? id;

/// ★ ဒီ component ၃ ခုကို **parent ရဲ့ အပြင်မှာ** ကြေညာရမယ်။ အထဲမှာ
/// ရေးလိုက်ရင် render တိုင်း component type အသစ် ဖြစ်ပြီး React က subtree
/// တစ်ခုလုံးကို unmount → remount လုပ်တယ် — focus ပျောက်, scroll ပြန်တက်,
/// DOM node တွေ အမြဲ ပြန်ဆောက်။ (browser test မှာ "element detached"
/// ဆိုပြီး ဖမ်းမိတယ်။)
function Grid({
  ids,
  active,
  onPick,
}: {
  ids: readonly string[];
  active: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {ids.map((id) => (
        <button
          key={id}
          onClick={() => onPick(id)}
          // ★ ၄၄px အနည်းဆုံး — လက်ချောင်းနဲ့ နှိပ်ရလွယ်ဖို့
          className={`min-h-[44px] rounded-lg border px-2 py-2 text-xs transition ${
            active === id
              ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
              : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10"
          }`}
        >
          {lab(id)}
        </button>
      ))}
    </div>
  );
}

function Colors({
  list,
  active,
  onPick,
}: {
  list: number[];
  active: number;
  onPick: (c: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((c) => (
        <button
          key={c}
          onClick={() => onPick(c)}
          aria-label={`#${c.toString(16)}`}
          style={{ background: `#${c.toString(16).padStart(6, "0")}` }}
          className={`h-11 w-11 rounded-full border-2 transition ${
            active === c ? "border-emerald-300" : "border-white/20"
          }`}
        />
      ))}
    </div>
  );
}

export function AvatarCustomiser({ onClose }: { onClose: () => void }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const avatarRef = useRef<Avatar | null>(null);
  const [cfg, setCfg] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>("body");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // ── သိမ်းထားတဲ့ config ကို ဖတ် ──────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    void fetch("/api/metaverse/avatar", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { config?: AvatarConfig; owned?: string[] } | null) => {
        if (!alive || !d) return;
        if (d.config) setCfg(d.config);
        setOwned(new Set(d.owned ?? []));
      })
      .catch(() => {
        /* မရရင် default နဲ့ ဆက်သွားတယ် */
      });
    return () => {
      alive = false;
    };
  }, []);

  // ── 3D preview ────────────────────────────────────────────────────────
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
    camera.position.set(0, 1.1, 3.4);
    camera.lookAt(0, 0.95, 0);

    scene.add(new THREE.HemisphereLight(0xdfe9f5, 0x333a44, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2, 4, 3);
    scene.add(key);

    const avatar = createHuman();
    scene.add(avatar.group);
    avatarRef.current = avatar;

    // လှည့်ကြည့်လို့ရ
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
      avatar.group.rotation.y += (e.clientX - lastX) * 0.01;
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
      // ★ idle animation — ငြိမ်နေရင် ရုပ်တုလို ဖြစ်တယ်
      avatar.update(dt, { speed: 0, running: false, airborne: false, emote: null });
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
      avatarRef.current = null;
      avatar.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (el.parentNode === mount) mount.removeChild(el);
    };
  }, []);

  // config ပြောင်းတိုင်း preview ကို ချက်ချင်း update
  useEffect(() => {
    if (avatarRef.current) applyAvatarConfig(avatarRef.current, cfg);
  }, [cfg]);

  const save = async () => {
    setSaving(true);
    setNote(null);
    try {
      const res = await fetch("/api/metaverse/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config: cfg }),
      });
      const json = (await res.json()) as { ok?: boolean; config?: AvatarConfig; error?: string };
      if (!res.ok || !json.ok) {
        setNote(json.error ?? "သိမ်းလို့ မရပါ");
        return;
      }
      // ★ Server က သန့်စင်ပြီးသား config ပြန်ပေးတယ် — မပိုင်တဲ့ပစ္စည်း
      // ဖယ်ခံရရင် UI မှာ ချက်ချင်း ပြန်ပြရမယ်
      if (json.config) setCfg(json.config);
      onClose();
    } catch {
      setNote("server ကို မရောက်ပါ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-black/80 backdrop-blur sm:flex-row">
      <div ref={mountRef} className="h-56 w-full shrink-0 sm:h-full sm:w-1/2" />

      <div className="flex min-h-0 flex-1 flex-col p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/90">Avatar ပြင်ဆင်ရန်</h2>
          <button
            onClick={onClose}
            className="min-h-[44px] rounded-lg px-3 text-xs text-white/60 hover:text-white"
          >
            ပယ်ဖျက်
          </button>
        </div>

        <div className="mb-3 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`min-h-[44px] shrink-0 rounded-lg px-3 text-xs transition ${
                tab === t.id
                  ? "bg-emerald-500/25 text-emerald-100"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {tab === "body" && (
            <>
              <Field label="အသားရောင်">
                <Colors
                  list={SKIN_TONES}
                  active={cfg.body.skin}
                  onPick={(c) => setCfg({ ...cfg, body: { ...cfg.body, skin: c } })}
                />
              </Field>
              <Field label="ကိုယ်ထည်">
                <Grid
                  ids={["slim", "normal", "broad"]}
                  active={cfg.body.build}
                  onPick={(id) =>
                    setCfg({
                      ...cfg,
                      body: { ...cfg.body, build: id as "slim" | "normal" | "broad" },
                    })
                  }
                />
              </Field>
              <Field label={`အရပ် — ${cfg.body.height.toFixed(2)}`}>
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
              </Field>
            </>
          )}

          {tab === "hair" && (
            <>
              <Field label="ပုံစံ">
                <Grid
                  ids={PART_IDS.hair}
                  active={cfg.hair.style}
                  onPick={(id) => setCfg({ ...cfg, hair: { ...cfg.hair, style: id } })}
                />
              </Field>
              <Field label="အရောင်">
                <Colors
                  list={HAIR_COLORS}
                  active={cfg.hair.color}
                  onPick={(c) => setCfg({ ...cfg, hair: { ...cfg.hair, color: c } })}
                />
              </Field>
            </>
          )}

          {tab === "face" && (
            <>
              <Field label="မျက်လုံး">
                <Grid
                  ids={PART_IDS.eyes}
                  active={cfg.face.eyes}
                  onPick={(id) => setCfg({ ...cfg, face: { ...cfg.face, eyes: id } })}
                />
              </Field>
              <Field label="မျက်ခုံး">
                <Grid
                  ids={PART_IDS.brows}
                  active={cfg.face.brows}
                  onPick={(id) => setCfg({ ...cfg, face: { ...cfg.face, brows: id } })}
                />
              </Field>
              <Field label="ပါးစပ်">
                <Grid
                  ids={PART_IDS.mouth}
                  active={cfg.face.mouth}
                  onPick={(id) => setCfg({ ...cfg, face: { ...cfg.face, mouth: id } })}
                />
              </Field>
            </>
          )}

          {tab === "outfit" && (
            <>
              <Field label="အပေါ်ထည်">
                <Grid
                  ids={PART_IDS.top}
                  active={cfg.outfit.top}
                  onPick={(id) => setCfg({ ...cfg, outfit: { ...cfg.outfit, top: id } })}
                />
                <Colors
                  list={CLOTH_PALETTE}
                  active={cfg.outfit.topColor}
                  onPick={(c) => setCfg({ ...cfg, outfit: { ...cfg.outfit, topColor: c } })}
                />
              </Field>
              <Field label="အောက်ထည်">
                <Grid
                  ids={PART_IDS.bottom}
                  active={cfg.outfit.bottom}
                  onPick={(id) => setCfg({ ...cfg, outfit: { ...cfg.outfit, bottom: id } })}
                />
                <Colors
                  list={CLOTH_PALETTE}
                  active={cfg.outfit.bottomColor}
                  onPick={(c) =>
                    setCfg({ ...cfg, outfit: { ...cfg.outfit, bottomColor: c } })
                  }
                />
              </Field>
              <Field label="ဖိနပ်">
                <Grid
                  ids={PART_IDS.shoes}
                  active={cfg.outfit.shoes}
                  onPick={(id) => setCfg({ ...cfg, outfit: { ...cfg.outfit, shoes: id } })}
                />
              </Field>
            </>
          )}

          {tab === "extra" && (
            <Field label={`ပစ္စည်း — ${cfg.accessories.length}/${MAX_ACCESSORIES}`}>
              <div className="grid grid-cols-2 gap-2">
                {ACCESSORIES.map((a) => {
                  const has = cfg.accessories.includes(a.id);
                  // ★ မပိုင်တာကို **ဖျောက်မထားဘူး** — 🔒 နဲ့ ပြထားတယ်
                  const locked = !a.free && !owned.has(a.id);
                  return (
                    <button
                      key={a.id}
                      disabled={locked}
                      onClick={() =>
                        setCfg({
                          ...cfg,
                          accessories: has
                            ? cfg.accessories.filter((x) => x !== a.id)
                            : [...cfg.accessories, a.id].slice(0, MAX_ACCESSORIES),
                        })
                      }
                      className={`min-h-[44px] rounded-lg border px-2 py-2 text-left text-xs transition ${
                        locked
                          ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/35"
                          : has
                            ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                            : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10"
                      }`}
                    >
                      {locked ? "🔒 " : ""}
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}
        </div>

        {note && <div className="mt-2 text-[11px] text-amber-300">{note}</div>}

        <button
          onClick={() => void save()}
          disabled={saving}
          className="mt-3 min-h-[44px] rounded-lg bg-emerald-500/90 px-4 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {saving ? "သိမ်းနေသည်…" : "သိမ်းမယ်"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-medium text-white/50">{label}</div>
      {children}
    </div>
  );
}
