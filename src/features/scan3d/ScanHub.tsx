"use client";

import { useCallback, useEffect, useState } from "react";

import { ScanCapture } from "./ScanCapture";
import { OrbitViewer } from "./OrbitViewer";
import {
  deleteScan,
  getScan,
  listScans,
  type ScanMeta,
  type ScanMode,
  type ScanRecord,
} from "./db";

/// 🛰 3D Scanner hub — mode ရွေး (Room / Object / Avatar) + My Scans library။
///
/// ★ Room/Object scan တွေက စက်ထဲ (IndexedDB) မှာ သိမ်းတယ် — ဒီစာမျက်နှာက
///   library ရော viewer ရော။ Avatar scan ကတော့ သူ့ pipeline (GLB → account)
///   ရှိပြီးသားမို့ editor ဆီ လင့်ပေးတယ်။

export function ScanHub() {
  const [capturing, setCapturing] = useState<ScanMode | null>(null);
  const [viewing, setViewing] = useState<ScanRecord | null>(null);
  const [scans, setScans] = useState<ScanMeta[]>([]);
  const [covers, setCovers] = useState<Map<string, string>>(new Map());

  const refresh = useCallback(() => {
    listScans()
      .then((list) => {
        setScans(list);
        setCovers((old) => {
          for (const u of old.values()) URL.revokeObjectURL(u);
          const next = new Map<string, string>();
          for (const s of list) {
            if (s.cover) next.set(s.id, URL.createObjectURL(s.cover));
          }
          return next;
        });
      })
      .catch(() => setScans([]));
  }, []);

  useEffect(() => {
    refresh();
    return () => {
      setCovers((old) => {
        for (const u of old.values()) URL.revokeObjectURL(u);
        return new Map();
      });
    };
  }, [refresh]);

  const open = (id: string) => {
    void getScan(id).then((rec) => rec && setViewing(rec));
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16">
      {/* mode cards */}
      <div className="grid grid-cols-2 gap-3 pt-4">
        <button
          onClick={() => setCapturing("room")}
          className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10"
        >
          <span className="text-2xl">🏠</span>
          <span className="mt-1 block text-sm font-semibold">Room Scan</span>
          <span className="block text-[11px] text-white/50">
            အခန်းကို ၃၆၀° ပတ်ရိုက်ပြီး ပြန်လှည့်ကြည့်မယ်
          </span>
        </button>
        <button
          onClick={() => setCapturing("object")}
          className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10"
        >
          <span className="text-2xl">📦</span>
          <span className="mt-1 block text-sm font-semibold">Object Scan</span>
          <span className="block text-[11px] text-white/50">
            ပစ္စည်းပတ်လည် ရိုက်ပြီး turntable လှည့်ကြည့်မယ်
          </span>
        </button>
        <a
          href="/profile/avatar"
          className="col-span-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
        >
          <span className="text-2xl">🧍</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Avatar Scan</span>
            <span className="block text-[11px] text-white/50">
              မျက်နှာ + ကိုယ်ခန္ဓာ scan — metaverse avatar အဖြစ် တစ်ခါတည်း သုံး
            </span>
          </span>
          <span className="text-white/35">›</span>
        </a>
      </div>

      {/* library */}
      <p className="pb-2 pt-6 text-xs font-semibold uppercase tracking-wide text-white/40">
        🗂 My Scans
      </p>
      {scans.length === 0 && (
        <p className="rounded-2xl border border-dashed border-white/15 py-8 text-center text-xs text-white/40">
          Scan မရှိသေးပါ — အပေါ်က Room/Object ကနေ စရိုက်ကြည့်ပါ
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {scans.map((s) => (
          <button
            key={s.id}
            onClick={() => open(s.id)}
            className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left"
          >
            {covers.get(s.id) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={covers.get(s.id)}
                alt=""
                className="aspect-[4/3] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center text-3xl">
                {s.mode === "room" ? "🏠" : "📦"}
              </div>
            )}
            <span className="block truncate px-3 pt-2 text-xs font-medium">
              {s.mode === "room" ? "🏠" : "📦"} {s.name}
            </span>
            <span className="block px-3 pb-2 text-[10px] text-white/45">
              {s.frameCount} frames · {new Date(s.createdAt).toLocaleDateString()}
            </span>
          </button>
        ))}
      </div>

      {capturing && (
        <ScanCapture
          mode={capturing}
          onExit={() => setCapturing(null)}
          onDone={(id) => {
            setCapturing(null);
            refresh();
            open(id);
          }}
        />
      )}
      {viewing && (
        <OrbitViewer
          scan={viewing}
          onClose={() => setViewing(null)}
          onDelete={() => {
            void deleteScan(viewing.id).then(() => {
              setViewing(null);
              refresh();
            });
          }}
        />
      )}
    </div>
  );
}
