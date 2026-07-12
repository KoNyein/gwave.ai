import { Trophy } from "lucide-react";

import { UserAvatar } from "@/components/social/user-avatar";
import { displayName } from "@/lib/format";
import type { TopGifter } from "@/lib/db/live-gifts";

const MEDALS = ["🥇", "🥈", "🥉"];

/** Horizontal strip of a stream's top supporters (by G-Pay gifted). */
export function TopGifters({ gifters }: { gifters: TopGifter[] }) {
  if (gifters.length === 0) return null;
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <Trophy className="h-4 w-4 text-amber-500" /> ထိပ်တန်း ပံ့ပိုးသူများ
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {gifters.map((g, i) => {
          const profile = {
            id: g.sender_id,
            username: g.username,
            full_name: g.full_name,
            avatar_url: g.avatar_url,
          };
          return (
            <div key={g.sender_id} className="flex w-16 shrink-0 flex-col items-center gap-1">
              <div className="relative">
                <UserAvatar profile={profile} className="h-11 w-11" />
                <span className="absolute -right-1 -top-1 text-sm">{MEDALS[i] ?? ""}</span>
              </div>
              <p className="w-full truncate text-center text-[10px]">{displayName(profile)}</p>
              <p className="text-[10px] font-semibold text-primary">
                {Math.round(Number(g.total_mmk)).toLocaleString("en-US")}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
