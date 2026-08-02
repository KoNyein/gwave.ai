import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AssassinGame } from "@/components/games/assassin/assassin-game";
import { requireAdult } from "@/lib/auth";

export const metadata = { title: "Gwave Assassin" };
export const dynamic = "force-dynamic";

/**
 * Gwave Assassin — 18+ multiplayer mini-game.
 *
 * ★ Two gates, and both are needed. This one keeps the page itself away from
 *   minors, and the metaverse server refuses the WebSocket without an adult
 *   claim in the ticket (server/metaverse/server.js). The page gate alone
 *   protects nothing: the socket URL can be typed by hand.
 * ★ Rewards are cosmetic. The prototype's paid skins granted up to 42% damage
 *   reduction; the stats are gone and only the colours remain.
 */
export default async function AssassinPage() {
  await requireAdult();

  return (
    <div className="space-y-4 pb-8">
      <Link
        href="/games"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> ဂိမ်းများသို့
      </Link>
      <div>
        <h1 className="text-xl font-bold">🎯 Gwave Assassin</h1>
        <p className="text-sm text-muted-foreground">
          လျှို့ဝှက်ပစ်မှတ် ရှာဖွေရေး ပွဲ — ၁၈ နှစ်အထက်သာ။
        </p>
      </div>
      <AssassinGame room="assassin-1" />
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        ဒါက ကာတွန်းပုံစံ ပြိုင်ဆိုင်မှု ဂိမ်းတစ်ခုသာ ဖြစ်ပါတယ်။ ဝင်ကြေး မယူပါ၊
        ဆုလာဘ်တွေက အသွင်အပြင် (skin) သာ ဖြစ်ပြီး ကစားမှုအပေါ် သက်ရောက်မှု
        မရှိပါ။ မသင့်တော်တဲ့ အပြုအမူ တွေ့ရင် profile ကနေ Report / Block
        လုပ်နိုင်ပါတယ်။
      </p>
    </div>
  );
}
