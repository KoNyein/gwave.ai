import {
  GRID_COLS,
  LIMITS,
  type BuildData,
  type BuildObject,
} from "@/lib/metaverse/build";

import type { BuildRender } from "./render";

/// ကွက် streaming (Phase 18.6)。
///
/// ★ ကွက် ၁,၀၂၄ ခုလုံးကို တစ်ပြိုင်နက် load လုပ်လို့မရဘူး — ကွက်တစ်ခုမှာ
///   object ၂၀၀ အထိ ရှိလို့ payload က ကြီးလွန်းမယ်၊ InstancedMesh က
///   instance ၂၀၀,၀၀၀ ဖြစ်သွားမယ်။ ၄၀ unit အတွင်းကိုသာ ဆွဲတယ်။
/// ★ ရွှေ့တိုင်း fetch မလုပ်ဘူး — နောက်ဆုံး fetch ကနေ REFETCH_DIST ကျော်
///   ရွှေ့မှသာ။ မဟုတ်ရင် ရွှေ့နေတဲ့ player တစ်ယောက်က တစ်စက္ကန့် request
///   ၆၀ ပို့မယ်။

const REFETCH_DIST = 20;
const MIN_GAP_MS = 4000;

export type PlotInfo = { plotId: number; mine: boolean; build: BuildData };

export type PlotStream = {
  /// Render loop ကနေ ခေါ်တယ် — လိုအပ်မှသာ fetch လုပ်တယ်
  update(x: number, z: number): void;
  /// ဆောက်နေစဉ် ကိုယ့်ကွက်ရဲ့ object တွေကို local အနေနဲ့ အစားထိုးတယ်
  /// (မသိမ်းရသေးတာကို ချက်ချင်း မြင်ရဖို့)
  setDraft(plotId: number | null, objects: BuildObject[] | null): void;
  /// ဒီနေရာက ဘယ်ကွက်ထဲလဲ
  plotAt(x: number, z: number): { plotId: number; mine: boolean };
  get(plotId: number): PlotInfo | null;
  /// သိမ်းပြီးရင် ချက်ချင်း ပြန်ဆွဲဖို့
  invalidate(): void;
  dispose(): void;
};

/// ကမ္ဘာ့ coordinate → plotId (server ရဲ့ `plot_id = gx * 32 + gz` နဲ့ တူညီရမယ်)
export function plotIdAt(x: number, z: number): number {
  const gx = Math.floor(x / LIMITS.plotSize) + GRID_COLS / 2;
  const gz = Math.floor(z / LIMITS.plotSize) + GRID_COLS / 2;
  const cx = Math.min(GRID_COLS - 1, Math.max(0, gx));
  const cz = Math.min(GRID_COLS - 1, Math.max(0, gz));
  return cx * GRID_COLS + cz;
}

export function createPlotStream(render: BuildRender): PlotStream {
  const loaded = new Map<number, PlotInfo>();
  let lastX = Infinity;
  let lastZ = Infinity;
  let lastAt = 0;
  let inflight = false;
  let killed = false;
  let draftId: number | null = null;
  let draftObjects: BuildObject[] | null = null;

  const rebuild = () => {
    const all: BuildObject[] = [];
    for (const [plotId, info] of loaded) {
      if (plotId === draftId && draftObjects) continue; // draft က အစားထိုးတယ်
      for (const o of info.build?.objects ?? []) all.push(o);
    }
    if (draftObjects) for (const o of draftObjects) all.push(o);
    render.set(all);
  };

  const fetchAround = async (x: number, z: number) => {
    if (inflight) return;
    inflight = true;
    try {
      const res = await fetch(
        `/api/metaverse/plots?x=${Math.round(x)}&z=${Math.round(z)}&r=2`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const json = (await res.json()) as { plots?: PlotInfo[] };
      if (killed) return;
      loaded.clear();
      for (const p of json.plots ?? []) {
        if (p && typeof p.plotId === "number") loaded.set(p.plotId, p);
      }
      rebuild();
    } catch {
      // ★ ကွက်တွေ မဆွဲရလည်း လောကက ဆက်လည်ရမယ် — ဆောက်ထားတာ မမြင်ရရုံပဲ
    } finally {
      inflight = false;
    }
  };

  return {
    update(x, z) {
      const now = Date.now();
      if (now - lastAt < MIN_GAP_MS) return;
      if (Math.hypot(x - lastX, z - lastZ) < REFETCH_DIST) return;
      lastX = x;
      lastZ = z;
      lastAt = now;
      void fetchAround(x, z);
    },

    setDraft(plotId, objects) {
      draftId = plotId;
      draftObjects = objects;
      rebuild();
    },

    plotAt(x, z) {
      const plotId = plotIdAt(x, z);
      return { plotId, mine: loaded.get(plotId)?.mine ?? false };
    },

    get: (plotId) => loaded.get(plotId) ?? null,

    invalidate() {
      lastX = Infinity;
      lastZ = Infinity;
      lastAt = 0;
    },

    dispose() {
      killed = true;
      loaded.clear();
    },
  };
}
