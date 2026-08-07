"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { HOME_CHOICES, HOME_COOKIE } from "@/lib/home-choice";
import { cn } from "@/lib/utils";

/**
 * 🚪 ဝင်ရာ တံခါး — ဘယ် category ကို သွားမလဲ ရွေးတယ်။
 *
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
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <p className="text-sm text-muted-foreground">မင်္ဂလာပါ {name} 👋</p>
      <h1 className="mt-1 text-2xl font-bold">ဘယ်ကို သွားမလဲ?</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        တစ်ခုကို ရွေးပါ — နောက်ပိုင်း ☰ menu ထဲက “🚪 ဝင်ရာနေရာ” ကနေ
        အမြဲ ပြောင်းလို့ရပါတယ်။
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {HOME_CHOICES.map((c) => (
          <button
            key={c.key}
            type="button"
            disabled={busy !== null}
            onClick={() => go(c.key, c.href)}
            className={cn(
              "flex min-h-[84px] items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition",
              "hover:border-primary hover:bg-muted active:scale-[.99]",
              busy === c.key && "border-primary bg-muted",
              busy !== null && busy !== c.key && "opacity-50",
            )}
          >
            <span className="text-3xl" aria-hidden>
              {c.emoji}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">{c.title}</span>
              <span className="block text-xs leading-relaxed text-muted-foreground">
                {c.blurb}
              </span>
            </span>
          </button>
        ))}
      </div>

      <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="h-4 w-4 accent-[hsl(var(--primary))]"
        />
        နောက်တစ်ခါ ဝင်ရင် ဒီနေရာကို တိုက်ရိုက် သွားပါ
      </label>
    </div>
  );
}
