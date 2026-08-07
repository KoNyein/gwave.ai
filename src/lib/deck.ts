/**
 * 🧭 Gwave Deck — system တစ်ခုလုံးရဲ့ **ပွတ်ဆွဲ လမ်းကြောင်း** သတ်မှတ်ချက်။
 *
 * user: "ဘေး ဝဲဖက်သို့ ပွတ်ဆွဲလျှင် metaverse, ယာဖက်သို့ ပွတ်ဆွဲလျှင်
 * News feed world, reel etc. အပေါ်အောက်ဆွဲလျှင် အခြားလိုအပ်သော နေရာများ"
 *
 * လက်ညှိုး ရွေ့တဲ့ ဘက် = သွားမယ့် နေရာ (destination direction):
 *   ← ဘယ်ဘက် ဆွဲ  → 🌍 Metaverse (လောက)
 *   → ညာဘက် ဆွဲ   → 📰 Content deck (Feed → Reels → Live → Games → …)
 *   ↑ အပေါ် ဆွဲ    → ⚡ Quick sheet (function အားလုံး)
 *   ↓ အောက် ဆွဲ    → sheet ပိတ်
 *
 * ဒီဖိုင်ဟာ web (SwipeDeck) ရော Flutter app ရော အတူတူ လိုက်နာဖို့
 * **တစ်နေရာတည်းက အမှန်တရား** — deck ကို ဒီမှာပဲ ပြင်ရမယ်။
 */

/** ညာဘက် ဆွဲတိုင်း ရှေ့တိုးသွားမယ့် content pane များ (စက်ဝိုင်း)。 */
export const CONTENT_DECK = [
  { href: "/feed", labelKey: "home" },
  { href: "/reels", labelKey: "reels" },
  { href: "/live", labelKey: "live" },
  { href: "/games", labelKey: "games" },
] as const;

/** ဘယ်ဘက် ဆွဲရင် အမြဲ ဒီကို — လောကက deck ရဲ့ အစွန်ဆုံး ဘယ်ဘက်။ */
export const WORLD_HREF = "/metaverse";

/** လက်ရှိ path က deck ရဲ့ ဘယ် pane လဲ (မဟုတ်ရင် -1)。 */
export function deckIndexOf(pathname: string): number {
  return CONTENT_DECK.findIndex(
    (p) => pathname === p.href || pathname.startsWith(`${p.href}/`),
  );
}

/** ညာဘက် ဆွဲရင် ရောက်မယ့် နေရာ။ */
export function nextContentHref(pathname: string): string {
  const i = deckIndexOf(pathname);
  // deck ထဲ မဟုတ်ရင် (tools, profile, settings …) ပထမ pane ကို ပြန်
  if (i < 0) return CONTENT_DECK[0]!.href;
  return CONTENT_DECK[(i + 1) % CONTENT_DECK.length]!.href;
}

/**
 * ဘယ်ဘက် ဆွဲရင် ရောက်မယ့် နေရာ — **ဘယ်ကနေမဆို လောက**。
 *
 * pager ပုံစံ (တစ်ဆင့်စီ နောက်ပြန်) မလုပ်ဘူး — user ရဲ့ စကားက "ဘေး ဝဲဖက်သို့
 * ပွတ်ဆွဲလျှင် metaverse"။ Reels မှာ ဘယ်ဘက်ဆွဲရင် Feed ပြန်ရောက်တာက
 * နားလည်ရ ခက်တယ်။ လောကက အမြဲ ဘယ်ဘက်၊ content က အမြဲ ညာဘက် —
 * စည်းမျဉ်း တစ်ခုတည်း၊ မှတ်ရ လွယ်တယ်။ (deck ထဲ နောက်ပြန်ချင်ရင်
 * အောက်က အစက်တွေ ဒါမှမဟုတ် browser back)
 */
export function prevHref(): string {
  return WORLD_HREF;
}
