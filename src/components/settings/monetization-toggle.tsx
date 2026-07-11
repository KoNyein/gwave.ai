"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Coins, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { setMonetization } from "@/lib/actions/monetization";
import { cn } from "@/lib/utils";

export function MonetizationToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = React.useState(enabled);
  const [busy, setBusy] = React.useState(false);

  async function toggle() {
    setBusy(true);
    const res = await setMonetization(!on);
    setBusy(false);
    if (res.ok) {
      setOn(!on);
      router.refresh();
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        Monetization ဖွင့်ထားပါက သင်၏ တိုက်ရိုက် (Live) ပွဲစဉ်များနှင့် reel များကို
        ကြည့်ရှုသူတိုင်းအတွက် ဝင်ငွေ (play-money ကျပ်) ရရှိမည်။ ရရှိသည့်ငွေကို G-Pay သို့
        ထုတ်ယူနိုင်သည်။
      </p>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <span className="inline-flex items-center gap-2 font-medium">
          <Coins className="h-4 w-4 text-amber-600" />
          {on ? "Monetization ဖွင့်ထားသည်" : "Monetization ပိတ်ထားသည်"}
        </span>
        <Button
          size="sm"
          variant={on ? "outline" : "default"}
          onClick={() => void toggle()}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : on ? (
            "ပိတ်မည်"
          ) : (
            "ဖွင့်မည်"
          )}
        </Button>
      </div>
      <p
        className={cn(
          "text-xs",
          on ? "text-emerald-600" : "text-muted-foreground",
        )}
      >
        {on
          ? "✓ သင့်ပွဲစဉ်များကို ကြည့်ရှုသူများမှ ဝင်ငွေ တွက်ချက်ပေးနေသည်။"
          : "မိမိကိုယ်တိုင် ဖန်တီးထားသော မူပိုင် အကြောင်းအရာများသာ monetization ရရှိမည်။"}
      </p>
    </div>
  );
}
