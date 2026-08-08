import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { NAV_SECTIONS, visibleNav } from "@/components/layout/nav-items";
import { HOME_CHOICES } from "@/lib/home-choice";

/**
 * 🚪 **ပင်မ ကြိုဆိုစာမျက်နှာ** — Gwave ကို ဖွင့်တာနဲ့ ဒါ ရောက်တယ်။
 *
 * user: "/start ကို main welcome page အဖြစ်ထားပေးပါ —
 *        သွားချင်တဲ့နေရာကို သွားနိုင်သော menu များ စနစ်တကျ ရှိရမည်"
 *
 * အရင်က `/` က ရွေးထားတဲ့ နေရာကို **အတင်း** ပို့တယ်၊ `/start` က တစ်ခါပဲ
 * မေးတဲ့ တံခါးဝ ဖြစ်တယ် — မှတ်ပြီးရင် ဘယ်တော့မှ ပြန်မမြင်ရတော့ဘူး။
 * ကြိုဆိုစာမျက်နှာ ဆိုတာ **အမြဲ ပြန်လာလို့ ရမှ** ကြိုဆိုစာမျက်နှာ ဖြစ်တယ်။
 * ဒါကြောင့် အခု ဖွင့်တိုင်း ဒီကို ရောက်ပြီး၊ ဘယ်ကို သွားချင်လဲ ကိုယ်တိုင်
 * ရွေးတယ်။
 *
 * ═══ တည်ဆောက်ပုံ ═══
 *
 *   ① 🚀 အဓိက ၈ နေရာ — ကြီးကြီးမားမား card (Metaverse, Social, Shop …)
 *   ② 🧭 အပြည့်အစုံ directory — `NAV_SECTIONS` ကနေ တိုက်ရိုက်
 *
 * ★ ② က `NAV_SECTIONS` (sidebar/menu နဲ့ **တစ်ခုတည်းသော ရင်းမြစ်**) ကို
 *   သုံးတယ် — feature အသစ် တစ်ခု sidebar မှာ ထည့်လိုက်တာနဲ့ ဒီမှာပါ
 *   အလိုအလျောက် ပေါ်တယ်။ စာရင်း နှစ်ခု ကွဲပြီး တစ်ဖက်မှာ ကျန်နေတဲ့
 *   ပြဿနာ ဘယ်တော့မှ မဖြစ်နိုင်ဘူး။
 * ★ အသက်အရွယ် ကန့်သတ်ချက် — `visibleNav` က minor တွေဆီက ဖျောက်တယ်
 *   (တကယ့် အကာအကွယ်က route guard ပါ၊ ဒါက UI သာ)。
 */

/** Section တစ်ခုချင်း အရောင် — တစ်ချက်ကြည့်တာနဲ့ ကဏ္ဍ ခွဲသိရအောင် */
const SECTION_STYLE: Record<string, string> = {
  sectionSocial: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  sectionMetaverse: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  sectionGames: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300",
  sectionEntertainment: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  sectionLearn: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  sectionFarm: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  sectionBusiness: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  sectionTools: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
};

export async function WelcomeHub({
  name,
  isAdult,
}: {
  name: string;
  isAdult: boolean;
}) {
  const [tNav, tMenu] = await Promise.all([
    getTranslations("nav"),
    getTranslations("menu"),
  ]);

  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        {/* ── ခေါင်းစီး ─────────────────────────────────────────────── */}
        <header className="border-b pb-7">
          <p className="text-sm text-muted-foreground">
            မင်္ဂလာပါ {name} 👋
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            ဘယ်ကို သွားမလဲ?
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            အောက်က ကဏ္ဍတစ်ခုကို ရွေးပါ — ဒါမှမဟုတ် အောက်ဆုံးက အပြည့်အစုံ
            စာရင်းထဲက ဘယ်နေရာကိုမဆို တိုက်ရိုက် သွားလို့ရပါတယ်။
          </p>
        </header>

        {/* ── ① အဓိက ရွေးစရာများ ───────────────────────────────────── */}
        <nav aria-label="အဓိက ကဏ္ဍများ" className="mt-8">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HOME_CHOICES.map((c) => (
              <li key={c.key}>
                <Link
                  href={c.href}
                  className="flex h-full min-h-[108px] w-full items-start gap-4 rounded-2xl
                    border bg-card px-5 py-5 text-left transition
                    hover:border-primary hover:bg-muted active:scale-[.99]
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="text-4xl leading-none" aria-hidden>
                    {c.emoji}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-lg font-semibold">{c.title}</span>
                    <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">
                      {c.blurb}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* ── ② အပြည့်အစုံ — ကဏ္ဍအလိုက် ခွဲထားတယ် ────────────────── */}
        <section className="mt-14" aria-label="အင်္ဂါရပ် အားလုံး">
          <h2 className="text-xl font-bold tracking-tight">
            အင်္ဂါရပ် အားလုံး
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gwave ထဲက နေရာ အားလုံး — ကဏ္ဍအလိုက် စီထားပါတယ်။
          </p>

          <div className="mt-6 space-y-9">
            {NAV_SECTIONS.map((section) => {
              const icon =
                SECTION_STYLE[section.headingKey] ?? SECTION_STYLE.sectionSocial!;
              // ★ href တူတာ ထပ်နေရင် တစ်ခုပဲ ပြ (SOS က /map ကို ထပ်တယ်)
              const items = visibleNav(section.items, isAdult).filter(
                (item, i, arr) => arr.findIndex((x) => x.href === item.href) === i,
              );
              if (items.length === 0) return null;

              return (
                <div key={section.headingKey}>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    {tNav(section.headingKey)}
                  </h3>
                  <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <li key={`${section.headingKey}-${item.labelKey}`}>
                          <Link
                            href={item.href}
                            className="group flex h-full items-start gap-3 rounded-xl border
                              bg-card p-4 transition hover:border-primary hover:bg-muted"
                          >
                            <span
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${icon}`}
                            >
                              <Icon className="h-5 w-5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold">
                                {tNav(item.labelKey)}
                              </span>
                              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                                {tMenu(`desc.${item.labelKey}`)}
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
