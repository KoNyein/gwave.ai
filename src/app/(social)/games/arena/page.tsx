import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import ArenaGame from "@/components/games/arena/arena-game";

export const metadata = { title: "ဝှက်တမ်း — Gwave Arena" };
export const dynamic = "force-dynamic";

/**
 * Hide and seek — the first Arena mode.
 *
 * ★ No age gate, deliberately. Assassin is 18+ because it is a shooter; this
 *   mode has no weapons and no damage at all — the server refuses combat
 *   messages in it by room type, not by convention. Gating it anyway would
 *   shut out most of the audience for no protection.
 * ★ `ArenaGame` is a client component and only touches WebGL inside an
 *   effect, so it renders on the server as an empty canvas and comes alive
 *   in the browser. `next/dynamic` with `ssr: false` is not usable here —
 *   that option is rejected inside a Server Component.
 */

export default function ArenaPage() {
  return (
    <div className="space-y-4 pb-8">
      <Link
        href="/games"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> ဂိမ်းများသို့
      </Link>
      <div>
        <h1 className="text-xl font-bold">🙈 ဝှက်တမ်း</h1>
        <p className="text-sm text-muted-foreground">
          ရှာဖွေသူ ၁ ယောက်၊ ကျန်တာ ပုန်းသူများ။ ဖမ်းမိရင် ဖမ်းမိသူက
          ရှာဖွေသူ ဖြစ်သွားတယ် — ၅ မိနစ် အဆုံးမှာ မဖမ်းမိသေးသူ အနိုင်ရမယ်။
        </p>
      </div>
      <ArenaGame room="hide-1" />
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        ကစားနည်း — ဘယ်ဘက် ဖန်သားပြင်ကို ဆွဲပြီး ရွေ့ပါ၊ ညာဘက်ကို ဆွဲပြီး
        လှည့်ကြည့်ပါ။ ကွန်ပျူတာမှာ WASD နဲ့ ရွေ့၊ မြှားခလုတ်နဲ့ လှည့်၊ Shift
        နဲ့ ပြေးပါ။ ရှာဖွေသူ ဖြစ်နေပြီး တစ်ယောက်ယောက်နဲ့ ကပ်နေရင် ဖမ်းခလုတ်
        ပေါ်လာမယ် (ကွန်ပျူတာမှာ E)。 ဤဂိမ်းတွင် လက်နက်နှင့် ထိခိုက်မှု
        လုံးဝ မပါဝင်ပါ။
      </p>
    </div>
  );
}
