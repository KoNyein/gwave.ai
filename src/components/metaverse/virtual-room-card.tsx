"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Copy, Hammer, Home } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

/**
 * 🏠 ကိုယ်ပိုင် Virtual Room — profile တိုင်းမှာ တစ်ခန်း。
 *
 * user: "user တိုင်း virtual room များ profile မှာ ထည့်ပေးပါ"
 *
 * Open World မှာ account တိုင်းအတွက် ကမ္ဘာတစ်ခု ရှိပြီးသား ဖြစ်တယ် —
 * `world_load` ကို key မပါဘဲ ပို့ရင် server က ကိုယ့်ကမ္ဘာကို load လုပ်တယ်၊
 * မရှိသေးရင် starter world အသစ် ဆောက်ပေးတယ်။ ဒါပေမယ့် အဲဒါကို လောကထဲက
 * radial menu ကနေမှ ရောက်လို့ ဘယ်သူမှ မသိဘူး။ အခု profile ကနေ
 * တိုက်ရိုက် ဝင်လို့ရပြီး၊ သူငယ်ချင်းတွေကို ခေါ်ဖို့ link လည်း ကူးလို့ရတယ်။
 *
 * ★ Share link ထဲက key က Cognito sub — `/api/world/room` က **ကိုယ့်ဟာ
 *   ကိုယ်ပဲ** ပြန်ပေးတယ်၊ တခြားသူ့ဟာ မထုတ်ပေးဘူး။
 */
export function VirtualRoomCard({ displayName }: { displayName: string }) {
  const [key, setKey] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    void fetch("/api/world/room", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d: { key?: string } | null) => {
        if (alive && d?.key) setKey(d.key);
      });
    return () => {
      alive = false;
    };
  }, []);

  const share = key
    ? `${typeof window === "undefined" ? "" : window.location.origin}/metaverse?world=${encodeURIComponent(key)}`
    : null;

  const copy = async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard ခွင့်မပြုရင် — link ကို မြင်နေရပြီးသား၊ ကိုယ်တိုင် ကူးလို့ရ
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Home className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">🏠 ကိုယ်ပိုင် Virtual Room</p>
            <p className="truncate text-xs text-muted-foreground">
              {displayName} ရဲ့ကမ္ဘာ — Metaverse ထဲက ကိုယ်ပိုင်နေရာ
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Link
            href="/metaverse?world=me"
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            <Home className="h-4 w-4" />
            အခန်းထဲ ဝင်မယ်
          </Link>
          <Link
            href="/metaverse?world=me&build=1"
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition hover:bg-muted"
          >
            <Hammer className="h-4 w-4" />
            တည်ဆောက်မယ် (B)
          </Link>
        </div>

        {share ? (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              သူငယ်ချင်းများ လာလည်ဖို့ link
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-2 text-[11px]">
                {share}
              </code>
              <button
                type="button"
                onClick={copy}
                aria-label="Copy room link"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition hover:bg-muted"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
