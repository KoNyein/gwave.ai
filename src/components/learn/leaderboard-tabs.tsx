import Link from "next/link";

import { cn } from "@/lib/utils";

/** All-time / this-month toggle for the learn leaderboard. */
export function LeaderboardTabs({ period }: { period: "all" | "month" }) {
  const tabs = [
    { key: "all", label: "စုစုပေါင်း", href: "/learn/leaderboard" },
    { key: "month", label: "ဒီလ", href: "/learn/leaderboard?period=month" },
  ] as const;
  return (
    <div className="flex gap-1.5">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium",
            period === t.key
              ? "border-primary bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
