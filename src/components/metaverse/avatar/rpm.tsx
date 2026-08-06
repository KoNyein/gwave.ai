"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RPM_URL_RE, type AvatarConfig } from "./config";

/// 📸 Ready Player Me creator overlay (photo-real avatar)။
///
/// International-standard avatar pipeline — selfie ကနေ RPM က rigged GLB
/// ထုတ်ပေးတယ်။ iframe ရဲ့ frame API (postMessage) ကနေ `v1.avatar.exported`
/// event နဲ့ GLB url ရပြီး `/api/metaverse/avatar` config ထဲ သိမ်းတယ် —
/// room client တွေက အဲဒီ URL ကို kit rig အစား ဆွဲတယ် (rpmavatar.ts)။
///
/// ★ Origin စစ်တယ် — readyplayer.me က message သာ လက်ခံ။
/// ★ သိမ်းပြီးရင် page reload — scene ထဲ avatar က load-time မှာ ဆောက်တာမို့
///   ပြန်ဆောက်တာက အရိုးရှင်းဆုံး၊ ဘေးအကျိုးအပြစ်လည်း မရှိ။

const RPM_FRAME = "https://demo.readyplayer.me/avatar?frameApi&clearCache";

export function RpmOverlay({ onClose }: { onClose: () => void }) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = useCallback(async (url: string) => {
    setSaving(true);
    setErr(null);
    try {
      const cur = (await fetch("/api/metaverse/avatar", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)) as { config?: AvatarConfig } | null;
      const res = await fetch("/api/metaverse/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: { ...(cur?.config ?? {}), rpmUrl: url } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Avatar က scene load မှာ ဆောက်တာ — reload နဲ့ ချက်ချင်း အသက်ဝင်
      window.location.reload();
    } catch (e) {
      setSaving(false);
      setErr(
        e instanceof Error ? e.message : "သိမ်းလို့မရပါ — ပြန်ကြိုးစားပါ",
      );
    }
  }, []);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      let host = "";
      try {
        host = new URL(e.origin).hostname;
      } catch {
        return;
      }
      if (!host.endsWith("readyplayer.me")) return;
      let d: unknown = e.data;
      if (typeof d === "string") {
        try {
          d = JSON.parse(d);
        } catch {
          return;
        }
      }
      const msg = d as { eventName?: string; data?: { url?: string } };
      if (msg.eventName === "v1.frame.ready") {
        frameRef.current?.contentWindow?.postMessage(
          JSON.stringify({
            target: "readyplayerme",
            type: "subscribe",
            eventName: "v1.**",
          }),
          "*",
        );
      }
      if (
        msg.eventName === "v1.avatar.exported" &&
        typeof msg.data?.url === "string" &&
        RPM_URL_RE.test(msg.data.url)
      ) {
        void save(msg.data.url);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [save]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/90">
      <div className="flex items-center justify-between px-4 py-2 text-white">
        <div className="text-sm font-semibold">
          📸 Photo Avatar — မျက်နှာဓာတ်ပုံနဲ့ လူသားရုပ်စစ်စစ် ဆောက်မယ်
        </div>
        <button
          onClick={onClose}
          className="rounded-full px-3 py-1 text-white/60 hover:text-white"
        >
          ✕
        </button>
      </div>
      {saving ? (
        <div className="flex flex-1 items-center justify-center text-sm text-emerald-300">
          💾 Avatar သိမ်းနေသည်… ပြီးရင် အလိုအလျောက် ပြန်ဝင်ပါမယ်
        </div>
      ) : (
        <iframe
          ref={frameRef}
          src={RPM_FRAME}
          allow="camera *; microphone *; clipboard-write"
          className="w-full flex-1 border-0"
          title="Ready Player Me"
        />
      )}
      {err && (
        <p className="bg-red-500/15 px-4 py-2 text-center text-xs text-red-300">
          ⚠️ {err}
        </p>
      )}
      <p className="px-4 pb-2 text-center text-[11px] text-white/40">
        Ready Player Me နဲ့ တည်ဆောက်ထားသည် — ဓာတ်ပုံရိုက် (သို့) ရွေးပြီး
        avatar ထုတ်ပါ၊ Done/Next နှိပ်ရင် Gwave ထဲ အလိုအလျောက် သိမ်းပါမယ်
      </p>
    </div>
  );
}
