"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Store, Tag, Trophy } from "lucide-react";

import { Stars } from "@/components/reviews/stars";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/types/database";

const MEDALS = ["🥇", "🥈", "🥉"];

function List({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        အမှတ်ပေးမှု မရှိသေးပါ။
      </p>
    );
  }
  return (
    <ol className="space-y-2">
      {entries.map((e, i) => (
        <li key={e.subjectId}>
          <Link
            href={e.href}
            className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:bg-muted/50"
          >
            <span className="w-7 shrink-0 text-center text-lg font-bold tabular-nums">
              {MEDALS[i] ?? i + 1}
            </span>
            {e.image ? (
              <Image
                src={e.image}
                alt=""
                width={44}
                height={44}
                className="h-11 w-11 shrink-0 rounded-lg object-cover"
                unoptimized
              />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Store className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{e.title}</p>
              <div className="flex items-center gap-1.5">
                <Stars value={e.ratingAvg} size={13} />
                <span className="text-xs text-muted-foreground">
                  {e.ratingAvg.toFixed(1)} · {e.ratingCount} ကြိမ်
                </span>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function LeaderboardView({
  pages,
  products,
}: {
  pages: LeaderboardEntry[];
  products: LeaderboardEntry[];
}) {
  const [tab, setTab] = React.useState<"page" | "shop_product">("page");
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/15 text-amber-500">
          <Trophy className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold">🏆 အဆင့်သတ်မှတ်ချက်</h1>
          <p className="text-sm text-muted-foreground">
            အသုံးပြုသူများ အမှတ်ပေးထားသည့် အကောင်းဆုံးများ
          </p>
        </div>
      </div>

      <div className="flex rounded-lg border p-0.5 text-sm">
        {(
          [
            { k: "page", label: "Pages / Shops", icon: Store },
            { k: "shop_product", label: "ပစ္စည်းများ", icon: Tag },
          ] as const
        ).map(({ k, label, icon: Icon }) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 font-medium",
              tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <List entries={tab === "page" ? pages : products} />
    </div>
  );
}
