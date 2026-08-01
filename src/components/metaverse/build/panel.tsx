"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  BUILD_ERROR_MY,
  BUILD_TYPES,
  LIMITS,
  validateBuild,
  plotCenter,
  type BuildError,
  type BuildObject,
  type BuildType,
} from "@/lib/metaverse/build";

/// ဆောက်လုပ်ရေး UI (Phase 18.3)。
///
/// ★ **Undo/Redo မဖြစ်မနေ** — မှားချမိတာ ပြန်ဖျက်လို့မရရင် လူတွေက
///   ဆောက်တာကို လုံးဝ ရပ်သွားတယ်။ ၅၀ ဆင့် သိမ်းတယ်။
/// ★ Snapshot နဲ့ undo လုပ်တယ် (command pattern မဟုတ်ဘူး) — object ၂၀၀ က
///   array တစ်ခုမှာ ဘာမှမဟုတ်ဘူး၊ ပြီးတော့ မှားနိုင်ခြေ အများကြီး နည်းတယ်။
/// ★ Sub-component တွေကို module scope မှာ ကြေညာရမယ် — component ထဲမှာ
///   ကြေညာရင် render တိုင်း type အသစ်ဖြစ်ပြီး React က panel တစ်ခုလုံးကို
///   ဖျက်ပြီး ပြန်ဆောက်တယ်။

const TYPE_LABEL: Record<BuildType, string> = {
  wall: "နံရံ",
  floor: "ကြမ်း",
  roof: "အမိုး",
  door: "တံခါး",
  window: "ပြတင်း",
  fence: "ခြံစည်း",
  tree: "အပင်",
  lamp: "မီးအိမ်",
  chair: "ခုံ",
  table: "စားပွဲ",
  sign: "ဆိုင်းဘုတ်",
};

const TYPE_ICON: Record<BuildType, string> = {
  wall: "🧱",
  floor: "⬜",
  roof: "🔺",
  door: "🚪",
  window: "🪟",
  fence: "🚧",
  tree: "🌳",
  lamp: "💡",
  chair: "🪑",
  table: "🪵",
  sign: "🪧",
};

const PALETTE = [
  0xd8d3c8, 0xe94f37, 0x3f88c5, 0xf6ae2d, 0x44bba4, 0xa06cd5, 0x6cc551,
  0x2b3038, 0x8b5a2b, 0xf2f2f2,
];

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

const btn =
  "rounded-lg border border-white/15 bg-black/50 px-2.5 py-1.5 text-[11px] text-white/80 transition hover:bg-black/70 disabled:opacity-35";

/// Scene ဆီ ချိတ်ဆက်ဖို့ — 3D ဘက်က ဒီ interface ကို ဖြည့်ပေးတယ်။
export type BuildBridge = {
  /// Ghost ရဲ့ လက်ရှိနေရာ (grid snap ပြီးသား)
  ghostPos(): { x: number; y: number; z: number };
  /// Ghost ကို ဘယ်ပစ္စည်း/ဘယ်ထောင့်နဲ့ ပြမလဲ (null = ဖျောက်)
  setGhost(type: BuildType | null, ry: number, valid: boolean): void;
  /// မသိမ်းရသေးတဲ့ ပုံစံကို ချက်ချင်း ပြခိုင်းတယ်
  setDraft(plotId: number | null, objects: BuildObject[] | null): void;
  /// ကိုယ်ရပ်နေတဲ့ ကွက်
  plotHere(): { plotId: number; mine: boolean };
  /// သိမ်းပြီးရင် ကွက်တွေ ပြန်ဆွဲခိုင်းတယ်
  invalidate(): void;
};

function TypeGrid({
  value,
  onPick,
}: {
  value: BuildType;
  onPick: (t: BuildType) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {BUILD_TYPES.map((t) => (
        <button
          key={t}
          onClick={() => onPick(t)}
          title={TYPE_LABEL[t]}
          // ★ 44px touch target — ဖုန်းမှာ သေးလွန်းရင် မှားနှိပ်တယ်
          className={`flex h-11 flex-col items-center justify-center rounded-lg text-base transition ${
            value === t ? "bg-emerald-500/30 ring-1 ring-emerald-400" : "hover:bg-white/10"
          }`}
        >
          {TYPE_ICON[t]}
        </button>
      ))}
    </div>
  );
}

function Palette({ value, onPick }: { value: number; onPick: (c: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {PALETTE.map((c) => (
        <button
          key={c}
          onClick={() => onPick(c)}
          aria-label={hex(c)}
          className={`h-7 w-7 rounded-md border ${
            value === c ? "border-emerald-300 ring-1 ring-emerald-400" : "border-white/20"
          }`}
          style={{ backgroundColor: hex(c) }}
        />
      ))}
    </div>
  );
}

export function BuildPanel({
  bridge,
  onClose,
}: {
  bridge: React.RefObject<BuildBridge | null>;
  onClose: () => void;
}) {
  const [type, setType] = useState<BuildType>("wall");
  const [ry, setRy] = useState(0);
  const [color, setColor] = useState<number>(PALETTE[0] ?? 0xd8d3c8);
  const [objects, setObjects] = useState<BuildObject[]>([]);
  const [signText, setSignText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [plotId, setPlotId] = useState<number | null>(null);
  const [mine, setMine] = useState(false);
  const [loaded, setLoaded] = useState(false);

  /// ★ Undo/Redo — snapshot stack ၅၀ ဆင့် (spec 18.3)。
  const undoStack = useRef<BuildObject[][]>([]);
  const redoStack = useRef<BuildObject[][]>([]);
  const [depth, setDepth] = useState({ undo: 0, redo: 0 });

  const pushHistory = useCallback((prev: BuildObject[]) => {
    undoStack.current.push(prev);
    if (undoStack.current.length > LIMITS.undoDepth) undoStack.current.shift();
    // ★ လုပ်ဆောင်ချက်အသစ် လုပ်တာနဲ့ redo က အဓိပ္ပာယ်မရှိတော့ဘူး
    redoStack.current = [];
    setDepth({ undo: undoStack.current.length, redo: 0 });
  }, []);

  // ── ကိုယ်ရပ်နေတဲ့ ကွက်ကို ရှာပြီး ဆောက်ထားပြီးသားကို ဆွဲ ─────────────
  useEffect(() => {
    const here = bridge.current?.plotHere();
    if (!here) return;
    setPlotId(here.plotId);
    let alive = true;
    void fetch(`/api/metaverse/plot/${here.plotId}/build`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { mine?: boolean; build?: { objects?: BuildObject[] } } | null) => {
        if (!alive) return;
        setMine(Boolean(j?.mine));
        setObjects(j?.build?.objects ?? []);
        setLoaded(true);
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [bridge]);

  // Draft ကို scene ဆီ တင်တယ် — မသိမ်းရသေးလည်း ချက်ချင်း မြင်ရမယ်
  useEffect(() => {
    if (!loaded || plotId === null) return;
    bridge.current?.setDraft(plotId, objects);
  }, [objects, plotId, loaded, bridge]);

  // Ghost — ရွေးထားတဲ့ ပစ္စည်းနဲ့ ထောင့်ကို ပြတယ်
  useEffect(() => {
    const api = bridge.current;
    api?.setGhost(type, ry, mine);
    return () => api?.setGhost(null, 0, false);
  }, [type, ry, mine, bridge]);

  // ★ ထွက်သွားရင် draft ကို ဖယ်တယ် — မဟုတ်ရင် မသိမ်းရသေးတဲ့ ပုံစံက
  // ဆက်ပေါ်နေပြီး "သိမ်းပြီးပြီ" လို့ ထင်စေမယ်။
  useEffect(() => {
    const api = bridge.current;
    return () => {
      api?.setDraft(null, null);
    };
  }, [bridge]);

  const centre = plotId === null ? null : plotCenter(plotId);

  const place = () => {
    const pos = bridge.current?.ghostPos();
    if (!pos || !centre) return;
    if (objects.length >= LIMITS.maxObjects) {
      setNote(BUILD_ERROR_MY.too_many_objects);
      return;
    }
    const next: BuildObject = {
      t: type,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      ry,
      sx: 1,
      sy: 1,
      sz: 1,
      c: color,
      ...(type === "sign" && signText.trim()
        ? { txt: signText.trim().slice(0, LIMITS.maxSignLength) }
        : {}),
    };
    // ★ ချမယ့်ခဏမှာ ကိုယ့်ဘာသာ စစ်တယ် — server ကို ပို့ပြီးမှ ငြင်းခံရတာက
    // နောက်ကျပြီး ဘယ်ဟာ မှားလဲ ရှာရခက်တယ်။
    const check = validateBuild(
      { v: 1, plotId, objects: [next] },
      { centerX: centre.x, centerZ: centre.z },
    );
    if (!check.ok) {
      setNote(BUILD_ERROR_MY[check.error as BuildError]);
      return;
    }
    setNote(null);
    pushHistory(objects);
    setObjects([...objects, next]);
  };

  const removeNearGhost = () => {
    const pos = bridge.current?.ghostPos();
    if (!pos) return;
    let bestIndex = -1;
    let bestDist = 1.6;
    objects.forEach((o, i) => {
      const d = Math.hypot(o.x - pos.x, o.z - pos.z);
      if (d < bestDist) {
        bestDist = d;
        bestIndex = i;
      }
    });
    if (bestIndex < 0) {
      setNote("ဒီနေရာမှာ ဖျက်စရာ မရှိပါ");
      return;
    }
    setNote(null);
    pushHistory(objects);
    setObjects(objects.filter((_, i) => i !== bestIndex));
  };

  const undo = () => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(objects);
    if (redoStack.current.length > LIMITS.undoDepth) redoStack.current.shift();
    setObjects(prev);
    setDepth({ undo: undoStack.current.length, redo: redoStack.current.length });
  };

  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(objects);
    setObjects(next);
    setDepth({ undo: undoStack.current.length, redo: redoStack.current.length });
  };

  const save = async () => {
    if (plotId === null) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/metaverse/plot/${plotId}/build`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ build: { v: 1, plotId, objects } }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        hash?: string;
      };
      if (!res.ok) {
        setNote(
          json.error && json.error in BUILD_ERROR_MY
            ? BUILD_ERROR_MY[json.error as BuildError]
            : (json.error ?? "သိမ်းလို့ မရပါ"),
        );
        return;
      }
      // ★ Hash ကို ပြတယ် — on-chain တင်ချင်ရင် ကိုယ်တိုင် တင်လို့ရတယ်
      // (server က gas မကုန်ပေးဘူး — spec 18.5)。
      setNote(`သိမ်းပြီးပါပြီ · hash ${json.hash?.slice(0, 10)}…`);
      bridge.current?.invalidate();
    } catch {
      setNote("ကွန်ရက် ပြဿနာ — ထပ်ကြိုးစားပါ");
    } finally {
      setBusy(false);
    }
  };

  const report = async () => {
    if (plotId === null) return;
    await fetch(`/api/metaverse/plot/${plotId}/report`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "မလျော်ကန်သော ဆောက်လုပ်မှု" }),
    }).catch(() => null);
    setNote("တိုင်ကြားချက် ပို့ပြီးပါပြီ — စစ်ဆေးပေးပါမယ်");
  };

  return (
    <div
      data-hud="1"
      className="absolute bottom-3 left-1/2 z-30 w-[min(22rem,92vw)] -translate-x-1/2 rounded-2xl border border-white/15 bg-black/75 p-3 text-white backdrop-blur"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[12px] font-semibold text-emerald-300">
          🏗 ဆောက်လုပ်ရေး
          {plotId !== null && <span className="ml-1 text-white/40">#{plotId}</span>}
        </div>
        <button onClick={onClose} className={btn}>
          ပိတ်မယ်
        </button>
      </div>

      {!loaded && <div className="py-3 text-center text-[11px] text-white/50">ဆွဲနေသည်…</div>}

      {loaded && !mine && (
        <div className="space-y-2">
          {/* ★ တခြားသူ့ကွက်မှာ ဆောက်လို့မရဘူး — client မှာ ဖျောက်ရုံနဲ့
              မလုံခြုံပေမယ့် server ကလည်း ငြင်းတယ် (spec 18.7)。 */}
          <div className="rounded-lg bg-amber-500/15 px-2 py-1.5 text-[11px] leading-snug text-amber-200">
            ဒီကွက်ဟာ သင့်ဟာ မဟုတ်ပါ။ ကိုယ်ပိုင်ကွက်ပေါ်မှာသာ ဆောက်လို့ရပါတယ်။
          </div>
          <button onClick={() => void report()} className={`w-full ${btn}`}>
            🚩 ဒီကွက်ကို တိုင်ကြားမယ်
          </button>
        </div>
      )}

      {loaded && mine && (
        <div className="space-y-2">
          <TypeGrid value={type} onPick={setType} />

          {type === "sign" && (
            <input
              value={signText}
              onChange={(e) => setSignText(e.target.value)}
              maxLength={LIMITS.maxSignLength}
              placeholder={`ဆိုင်းဘုတ်စာသား (${LIMITS.maxSignLength} လုံးအထိ)`}
              className="w-full rounded-lg border border-white/15 bg-black/45 px-2 py-1.5 text-[11px] outline-none placeholder:text-white/35 focus:border-emerald-400/60"
            />
          )}

          <Palette value={color} onPick={setColor} />

          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setRy((r) => (r + 90) % 360)} className={btn}>
              ↻ {ry}°
            </button>
            <button onClick={place} className={`${btn} bg-emerald-500/25`}>
              ✚ ချမယ်
            </button>
            <button onClick={removeNearGhost} className={btn}>
              🗑️ ဖျက်
            </button>
            <button onClick={undo} disabled={depth.undo === 0} className={btn}>
              ↶ ပယ်ဖျက်
            </button>
            <button onClick={redo} disabled={depth.redo === 0} className={btn}>
              ↷ ပြန်လုပ်
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-[11px] ${
                objects.length >= LIMITS.maxObjects ? "text-amber-300" : "text-white/50"
              }`}
            >
              ပစ္စည်း {objects.length}/{LIMITS.maxObjects}
            </span>
            <button
              onClick={() => void save()}
              disabled={busy}
              className="rounded-lg border border-emerald-400/60 bg-emerald-500/25 px-3 py-1.5 text-[11px] text-emerald-100 transition hover:bg-emerald-500/40 disabled:opacity-50"
            >
              {busy ? "သိမ်းနေသည်…" : "သိမ်းမယ်"}
            </button>
          </div>
        </div>
      )}

      {note && (
        <div className="mt-2 rounded-lg bg-white/10 px-2 py-1 text-[11px] leading-snug text-white/80">
          {note}
        </div>
      )}
    </div>
  );
}
