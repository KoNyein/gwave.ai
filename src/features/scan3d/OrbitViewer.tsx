"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { SECTORS } from "./orbit";
import type { ScanRecord } from "./db";

/// 🔄 Orbit viewer — scan record ကို 3D-style ပြန်လှည့်ကြည့်တယ်။
///
/// ★ ဆွဲ/ပွတ်ဆွဲရင် sector frame တွေကြား လှည့်တယ် — object ဆို ပစ္စည်းကို
///   ပတ်ကြည့်သလို၊ room ဆို အခန်းထဲ မတ်တပ်ရပ် လှည့်ကြည့်သလို ခံစားရ။
/// ★ Frame တွေက capture တုန်း object URL အဖြစ် တစ်ခါ ပြောင်းပြီး cache —
///   unmount မှာ revoke (memory leak မဖြစ်စေရ)။

export function OrbitViewer({
  scan,
  onClose,
  onDelete,
}: {
  scan: ScanRecord;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const urls = useMemo(
    () =>
      scan.frames.map((f) => ({ sector: f.sector, url: URL.createObjectURL(f.blob) })),
    [scan],
  );
  useEffect(
    () => () => {
      for (const u of urls) URL.revokeObjectURL(u.url);
    },
    [urls],
  );

  const [idx, setIdx] = useState(0);
  const [auto, setAuto] = useState(scan.mode === "object");
  const drag = useRef<{ x: number; idx: number } | null>(null);

  // auto-rotate — object turntable သဘော
  useEffect(() => {
    if (!auto || urls.length < 2) return;
    const t = window.setInterval(() => setIdx((i) => (i + 1) % urls.length), 260);
    return () => window.clearInterval(t);
  }, [auto, urls.length]);

  if (urls.length === 0) return null;
  const cur = urls[Math.min(idx, urls.length - 1)]!;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button onClick={onClose} className="px-2 text-lg text-white/80">‹</button>
        <span className="max-w-[60vw] truncate text-sm font-semibold">
          {scan.mode === "room" ? "🏠" : "📦"} {scan.name}
        </span>
        {onDelete ? (
          <button onClick={onDelete} className="px-2 text-sm text-red-400">🗑</button>
        ) : (
          <span className="w-8" />
        )}
      </div>

      <div
        className="relative min-h-0 flex-1 touch-none select-none"
        onPointerDown={(e) => {
          setAuto(false);
          drag.current = { x: e.clientX, idx };
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          // မျက်နှာပြင် တစ်ဝက်ဆွဲ = တစ်ပတ်ဝက် လှည့်
          const per = (window.innerWidth * 0.5) / (urls.length || 1);
          const step = Math.round((e.clientX - d.x) / per);
          const n = urls.length;
          setIdx(((d.idx - step) % n + n) % n);
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cur.url}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain"
        />
        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-3">
          <span className="rounded-full bg-black/60 px-3 py-1 text-[11px] text-white/75 backdrop-blur">
            ↔ ဆွဲပြီး လှည့်ကြည့်ပါ · {cur.sector * (360 / SECTORS)}°
          </span>
          <button
            onClick={() => setAuto((a) => !a)}
            className={`rounded-full px-3 py-1 text-[11px] backdrop-blur ${
              auto ? "bg-sky-500/80 text-white" : "bg-black/60 text-white/75"
            }`}
          >
            {auto ? "⏸ ရပ်" : "▶ အလိုအလျောက်လှည့်"}
          </button>
        </div>
      </div>
    </div>
  );
}
