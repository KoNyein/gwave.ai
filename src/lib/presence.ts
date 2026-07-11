import type { PresenceStatus } from "@/types/database";

/** Display config for each self-set presence status. */
export const PRESENCE: Record<
  PresenceStatus,
  { label: string; dot: string; emoji: string }
> = {
  available: { label: "အားရှိ", dot: "bg-emerald-500", emoji: "🟢" },
  busy: { label: "အလုပ်များနေ", dot: "bg-red-500", emoji: "⛔" },
  away: { label: "ခဏထွက်", dot: "bg-amber-500", emoji: "🌙" },
  sleep: { label: "အိပ်နေ", dot: "bg-indigo-500", emoji: "😴" },
  invisible: { label: "ဖျောက်ထား", dot: "bg-muted-foreground", emoji: "⚪" },
};

export const PRESENCE_ORDER: PresenceStatus[] = [
  "available",
  "busy",
  "away",
  "sleep",
  "invisible",
];
