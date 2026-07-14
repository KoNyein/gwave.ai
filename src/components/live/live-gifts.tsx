"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gift, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendLiveGift } from "@/lib/actions/live-gifts";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { LiveGift } from "@/types/database";

interface Floater {
  id: number;
  emoji: string;
  label: string;
}

/**
 * TikTok-style live gifts. A viewer picks a gift; its G-Pay value moves to the
 * host and a big emoji floats up for everyone. Gift events are broadcast over a
 * per-stream realtime channel so all viewers see the animation instantly.
 */
export function LiveGifts({
  streamId,
  gifts,
  hasPin,
  canGift,
}: {
  streamId: string;
  gifts: LiveGift[];
  hasPin: boolean;
  canGift: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<LiveGift | null>(null);
  const [qty, setQty] = React.useState(1);
  const [pin, setPin] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [floaters, setFloaters] = React.useState<Floater[]>([]);
  const chanRef = React.useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  const pushFloater = React.useCallback((emoji: string, label: string) => {
    const id = Date.now() + Math.random();
    setFloaters((f) => [...f.slice(-8), { id, emoji, label }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 3500);
  }, []);

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`live-gifts:${streamId}`, {
      config: { broadcast: { self: true } },
    });
    channel
      .on("broadcast", { event: "gift" }, (p) => {
        const d = (p.payload ?? {}) as { emoji?: string; label?: string };
        if (d.emoji) pushFloater(d.emoji, d.label ?? "");
      })
      .subscribe();
    chanRef.current = channel;
    return () => {
      chanRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [streamId, pushFloater]);

  async function send() {
    if (!selected) return;
    setError(null);
    setPending(true);
    const res = await sendLiveGift({
      streamId,
      giftId: selected.id,
      quantity: qty,
      pin: hasPin ? pin : undefined,
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    void chanRef.current?.send({
      type: "broadcast",
      event: "gift",
      payload: { emoji: selected.emoji, label: `${selected.name} x${qty}` },
    });
    setOpen(false);
    setSelected(null);
    setQty(1);
    setPin("");
    router.refresh();
  }

  return (
    <>
      {/* Floating gift animations */}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[55] flex flex-col items-center gap-1">
        {floaters.map((f) => (
          <div key={f.id} className="animate-in fade-in slide-in-from-bottom-8 duration-500">
            <span className="text-5xl drop-shadow-lg">{f.emoji}</span>
            {f.label ? (
              <p className="text-center text-xs font-semibold text-white drop-shadow">{f.label}</p>
            ) : null}
          </div>
        ))}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        onClick={() => setOpen(true)}
        aria-label="Send gift"
      >
        <Gift className="h-5 w-5 text-pink-500" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/50" onClick={() => setOpen(false)}>
          <div
            className="w-full rounded-t-2xl bg-card p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold">🎁 လက်ဆောင် ပို့ရန်</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="close">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {!canGift ? (
              <div className="rounded-lg border p-4 text-center text-sm text-muted-foreground">
                လက်ဆောင်ပို့ရန် G-Pay account (active) လိုအပ်ပါသည်။{" "}
                <Link href="/gpay" className="font-medium text-primary hover:underline">
                  G-Pay ဖွင့်ရန်
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {gifts.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelected(g)}
                      className={cn(
                        "flex flex-col items-center gap-0.5 rounded-xl border p-2 transition-colors",
                        selected?.id === g.id ? "border-primary bg-primary/10" : "hover:bg-muted",
                      )}
                    >
                      <span className="text-2xl">{g.emoji}</span>
                      <span className="text-[10px] font-medium">
                        ${Number(g.price_mmk).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                      </span>
                    </button>
                  ))}
                </div>

                {selected ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">
                        {selected.emoji} {selected.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-7 w-7 rounded-full border">−</button>
                        <span className="w-8 text-center text-sm font-semibold">{qty}</span>
                        <button type="button" onClick={() => setQty((q) => Math.min(999, q + 1))} className="h-7 w-7 rounded-full border">+</button>
                      </div>
                    </div>
                    {hasPin ? (
                      <Input
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="G-Pay PIN"
                      />
                    ) : null}
                    {error ? <p className="text-sm text-destructive">{error}</p> : null}
                    <Button onClick={send} disabled={pending} className="w-full">
                      {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Gift className="mr-1.5 h-4 w-4" />}
                      ${(Number(selected.price_mmk) * qty).toLocaleString("en-US", { maximumFractionDigits: 2 })} — ပို့မည်
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
