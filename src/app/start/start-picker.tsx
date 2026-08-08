"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { HOME_CHOICES, HOME_COOKIE } from "@/lib/home-choice";
import { cn } from "@/lib/utils";

/**
 * 🚪 ဝင်ရာ တံခါး — ဘယ် category ကို သွားမလဲ ရွေးတယ်။
 *
 * user: "start page မှာ slide menu / floating menu မသုံးပါနဲ့ —
 *        ကိုယ်ပိုင် page menu ခန့်ငြားစွာ ထားပါ"
 *
 * ★ ဒါက **စာမျက်နှာ တစ်ခုလုံး** ပါ — ဘေးကနေ ပွတ်ဆွဲထုတ်ရတဲ့ drawer မဟုတ်၊
 *   အပေါ်မှာ မျောနေတဲ့ floating menu လည်း မဟုတ်ဘူး။ ရွေးစရာတွေက ဖုံးထားတာ
 *   မရှိဘဲ တစ်ချက်တည်းနဲ့ မြင်ရတယ်၊ တစ်ခုနဲ့တစ်ခု လုံလောက်စွာ ခြားထားတယ်။
 * ★ ခလုတ်တွေက အနည်းဆုံး 108px မြင့်တယ် — လက်မနဲ့ လွယ်လွယ် ထိရအောင်။
 * ★ "မှတ်ထားမယ်" အမှန်ခြစ်ရင် cookie သိမ်းပြီး နောက်တစ်ခါ ဝင်ရင် ဒီစာမျက်နှာ
 *   မဖြတ်ဘဲ တိုက်ရိုက် ရောက်တယ်။ ☰ menu ရဲ့ "🚪 ဝင်ရာနေရာ" ကနေ အမြဲ
 *   ပြန်ပြောင်းလို့ရတယ် — ဆုံးဖြတ်ချက်က ချုပ်နှောင်တာ မဟုတ်ရဘူး။
 */
export function StartPicker({ name }: { name: string }) {
  const router = useRouter();
  const [remember, setRemember] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);

  const go = (key: string, href: string) => {
    setBusy(key);
    if (remember) {
      // ၁ နှစ် — UI နှစ်သက်မှုသာ၊ httpOnly မလို။ SameSite=Lax က
      // ပြင်ပ site ကနေ ပါလာတဲ့ navigation မှာ မပါစေဘူး။
      document.cookie = `${HOME_COOKIE}=${encodeURIComponent(key)}; path=/; max-age=31536000; samesite=lax`;
    } else {
      document.cookie = `${HOME_COOKIE}=; path=/; max-age=0; samesite=lax`;
    }
    router.push(href);
  };

  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        {/* ── ခေါင်းစီး — စာမျက်နှာရဲ့ ကိုယ်ပိုင် အမည် ─────────────────── */}
        <header className="border-b pb-7">
          <p className="text-sm text-muted-foreground">
            မင်္ဂလာပါ {name} 👋
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            ဘယ်ကို သွားမလဲ?
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            တစ်ခုကို ရွေးပါ — ရွေးပြီးရင် အဲဒီနေရာကို တိုက်ရိုက် ရောက်ပါမယ်။
            နောက်ပိုင်း ☰ menu ထဲက “🚪 ဝင်ရာနေရာ” ကနေ အမြဲ ပြောင်းလို့ရပါတယ်။
          </p>
        </header>

        {/* ── ရွေးစရာများ — တစ်ခုနဲ့တစ်ခု ခြားထားပြီး အပြည့်မြင်ရတယ် ──── */}
        <nav aria-label="ဝင်ရာနေရာ" className="mt-8">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HOME_CHOICES.map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => go(c.key, c.href)}
                  className={cn(
                    "flex h-full min-h-[108px] w-full items-start gap-4 rounded-2xl border",
                    "bg-card px-5 py-5 text-left transition",
                    "hover:border-primary hover:bg-muted active:scale-[.99]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    busy === c.key && "border-primary bg-muted",
                    busy !== null && busy !== c.key && "opacity-50",
                  )}
                >
                  <span className="text-4xl leading-none" aria-hidden>
                    {c.emoji}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-lg font-semibold">
                      {c.title}
                    </span>
                    <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">
                      {c.blurb}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* ── မှတ်ထားမလား ───────────────────────────────────────────── */}
        <label className="mt-8 flex cursor-pointer items-center gap-3 rounded-xl border bg-card px-5 py-4 text-sm">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          နောက်တစ်ခါ ဝင်ရင် ဒီနေရာကို တိုက်ရိုက် သွားပါ
        </label>
      </div>
    </main>
  );
}
