"use client";

import { useCallback, useEffect, useState } from "react";

import { ScanCapture } from "./ScanCapture";
import { OrbitViewer } from "./OrbitViewer";
import {
  downloadCover,
  exportScan,
  importScanFile,
  renameScan,
} from "./exchange";
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
  /// Import/export လုပ်နေတုန်း ပြမယ့် စာတန်း (error လည်း ဒီမှာပဲ)
  const [busy, setBusy] = useState<string | null>(null);

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
        {/* 📥 ဖိုင်ကနေ ပြန်သွင်း — တခြားစက်/တခြားလူဆီက .gwscan.json */}
        <label className="col-span-2 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-white/15 p-3 text-left transition hover:bg-white/5">
          <span className="text-xl">📥</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Scan သွင်းမယ်</span>
            <span className="block text-[11px] text-white/50">
              .gwscan.json ဖိုင်ကနေ library ထဲ ပြန်ထည့် (import)
            </span>
          </span>
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setBusy("သွင်းနေသည်…");
              importScanFile(f)
                .then(() => {
                  setBusy(null);
                  refresh();
                })
                .catch((err: Error) => setBusy(`⚠️ ${err.message}`));
            }}
          />
        </label>
        <a
          href="/studio?tab=avatar"
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

      {busy && (
        <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-center text-xs text-white/80">
          {busy}
        </p>
      )}

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
          <div
            key={s.id}
            className="overflow-hidden rounded-2xl border border-white/10 bg-white/5"
          >
          <button onClick={() => open(s.id)} className="w-full text-left">
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
            <span className="block px-3 text-[10px] text-white/45">
              {s.frameCount} frames · {new Date(s.createdAt).toLocaleDateString()}
            </span>
          </button>
          {/* ✏️ နာမည်ပြောင်း · 📤 ဖိုင်ထုတ် · 🖼 ပုံ download — card တစ်ခုစီ */}
          <div className="flex gap-1 px-2 pb-2 pt-1.5">
            <Act
              title="နာမည်ပြောင်း"
              icon="✏️"
              onClick={() => {
                const name = window.prompt("နာမည်အသစ်", s.name);
                if (name) void renameScan(s.id, name).then(refresh);
              }}
            />
            <Act
              title="ဖိုင်အဖြစ် ထုတ်"
              icon="📤"
              onClick={() => {
                setBusy("ထုတ်နေသည်…");
                exportScan(s.id)
                  .then(() => setBusy(null))
                  .catch((e: Error) => setBusy(`⚠️ ${e.message}`));
              }}
            />
            <Act
              title="ပုံ download"
              icon="🖼"
              onClick={() => {
                downloadCover(s.id).catch(() => setBusy("⚠️ ပုံ မရှိပါ"));
              }}
            />
          </div>
          </div>
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

/// Card အောက်က အသေးစား action ခလုတ် — icon + title (a11y အတွက် title)
function Act({
  icon,
  title,
  onClick,
}: {
  icon: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex-1 rounded-lg border border-white/10 bg-black/30 py-1.5 text-[13px] hover:bg-white/10"
    >
      {icon}
    </button>
  );
}
