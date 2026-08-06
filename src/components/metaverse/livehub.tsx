"use client";

import { useEffect, useRef, useState } from "react";

/// 📺 Live & Replays hub — metaverse ထဲကနေ ခုလွှင့်နေတဲ့ live တွေ ကြည့်ဖို့နဲ့
/// ပြီးသွားတဲ့ broadcast တွေရဲ့ **replay** တွေကို ချက်ချင်း ပြန်ဖွင့်ဖို့။
///
/// ★ Replay က overlay ထဲမှာပဲ ဖွင့်တယ် — metaverse ကနေ မထွက်ရဘူး။
///   MP4 (LiveKit egress) က <video> တိုက်ရိုက်၊ HLS (.m3u8 — IVS replay)
///   ဆို hls.js ကို dynamic import (livescreen.ts နဲ့ တစ်နည်းတည်း)။
/// ★ Live ချိန်တွေကတော့ /live/[id] page ဆီ လင့် — chat/gift/reaction
///   အပြည့်ပါတဲ့ full experience က အဲဒီမှာ ရှိပြီးသား။

type HubLive = { id: string; title: string; host: string };
type HubReplay = { id: string; title: string; host: string; url: string };

export function LiveHub({ onClose }: { onClose: () => void }) {
  const [lives, setLives] = useState<HubLive[]>([]);
  const [replays, setReplays] = useState<HubReplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<HubReplay | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let dead = false;
    fetch("/api/metaverse/lives", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { lives?: HubLive[]; replays?: HubReplay[] } | null) => {
        if (dead || !d) return;
        setLives(d.lives ?? []);
        setReplays(d.replays ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!dead) setLoading(false);
      });
    return () => {
      dead = true;
    };
  }, []);

  // Replay ဖွင့် — HLS ဆို hls.js၊ မဟုတ်ရင် video src တိုက်ရိုက်
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !playing) return;
    let hls: { destroy(): void } | null = null;
    let dead = false;
    if (playing.url.includes(".m3u8")) {
      if (v.canPlayType("application/vnd.apple.mpegurl")) {
        v.src = playing.url;
        void v.play().catch(() => undefined);
      } else {
        void import("hls.js").then(({ default: Hls }) => {
          if (dead) return;
          if (Hls.isSupported()) {
            const h = new Hls();
            h.loadSource(playing.url);
            h.attachMedia(v);
            hls = h;
            void v.play().catch(() => undefined);
          }
        });
      }
    } else {
      v.src = playing.url;
      void v.play().catch(() => undefined);
    }
    return () => {
      dead = true;
      hls?.destroy();
      v.removeAttribute("src");
      v.load();
    };
  }, [playing]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/90" data-hud="1">
      <div className="flex items-center justify-between px-4 py-2 text-white">
        <div className="text-sm font-semibold">📺 Live & Replays</div>
        <button
          onClick={onClose}
          className="rounded-full px-3 py-1 text-white/60 hover:text-white"
        >
          ✕
        </button>
      </div>

      {playing ? (
        <div className="flex flex-1 flex-col">
          <video
            ref={videoRef}
            controls
            playsInline
            className="min-h-0 w-full flex-1 bg-black object-contain"
          />
          <div className="flex items-center justify-between px-4 py-2">
            <p className="truncate text-xs text-white/70">
              📼 {playing.title} — {playing.host}
            </p>
            <button
              onClick={() => setPlaying(null)}
              className="shrink-0 rounded-full border border-white/25 px-3 py-1 text-xs text-white/80"
            >
              ← စာရင်းပြန်သွား
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {loading && (
            <p className="py-8 text-center text-sm text-white/50">ဖွင့်နေသည်…</p>
          )}

          {!loading && lives.length > 0 && (
            <>
              <p className="pb-2 pt-2 text-xs font-semibold text-red-300">
                🔴 ခု လွှင့်နေတယ်
              </p>
              <div className="space-y-2">
                {lives.map((l) => (
                  <a
                    key={l.id}
                    href={`/live/${l.id}`}
                    className="flex items-center gap-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-3"
                  >
                    <span className="animate-pulse text-lg">🔴</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-white">{l.title}</span>
                      <span className="block truncate text-xs text-white/50">{l.host}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-red-500/80 px-3 py-1 text-xs text-white">
                      ကြည့်မယ်
                    </span>
                  </a>
                ))}
              </div>
            </>
          )}

          {!loading && (
            <p className="pb-2 pt-4 text-xs font-semibold text-sky-300">
              📼 Replays
            </p>
          )}
          {!loading && replays.length === 0 && (
            <p className="py-6 text-center text-xs text-white/45">
              Replay မရှိသေးပါ — Live လွှင့်ပြီးတိုင်း ဒီမှာ အလိုအလျောက်
              စုဆောင်းပေးပါမယ်
            </p>
          )}
          <div className="space-y-2">
            {replays.map((r) => (
              <button
                key={r.id}
                onClick={() => setPlaying(r)}
                className="flex w-full items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-left"
              >
                <span className="text-lg">▶️</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-white">{r.title}</span>
                  <span className="block truncate text-xs text-white/50">{r.host}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
