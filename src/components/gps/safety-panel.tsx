"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, ShieldQuestion } from "lucide-react";

import { safetyCheckIn } from "@/lib/actions/safety";
import { getCurrentPosition } from "@/lib/geolocation";
import type { FamilySafety } from "@/lib/db/safety";

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "ယခုလေးတင်";
  if (mins < 60) return `${mins} မိနစ်က`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} နာရီက`;
  return `${Math.round(h / 24)} ရက်က`;
}

export function SafetyPanel({
  family,
  myUserId,
}: {
  family: FamilySafety[];
  myUserId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<null | "safe" | "need_help">(null);

  const mine = family.find((f) => f.profile.id === myUserId)?.checkin ?? null;
  const others = family.filter((f) => f.profile.id !== myUserId);
  const safeCount = others.filter((f) => f.checkin?.status === "safe").length;

  async function checkIn(status: "safe" | "need_help") {
    setBusy(status);
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const p = await getCurrentPosition();
      lat = p.latitude;
      lng = p.longitude;
    } catch {
      /* location optional */
    }
    await safetyCheckIn({ status, latitude: lat, longitude: lng });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-emerald-600" /> ဘေးကင်းကြောင်း
          အသိပေးရန်
        </p>
        {mine ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              mine.status === "safe"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {mine.status === "safe" ? "✅ ဘေးကင်း" : "⚠️ အကူအညီလို"} ·{" "}
            {timeAgo(mine.created_at)}
          </span>
        ) : null}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => checkIn("safe")}
          disabled={busy !== null}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy === "safe" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          ✅ ဘေးကင်းတယ်
        </button>
        <button
          type="button"
          onClick={() => checkIn("need_help")}
          disabled={busy !== null}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-60"
        >
          {busy === "need_help" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldQuestion className="h-4 w-4" />
          )}
          ⚠️ အကူအညီလို
        </button>
      </div>

      {others.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            မိသားစု အခြေအနေ — ✅ {safeCount}/{others.length} ဘေးကင်း
          </p>
          <ul className="divide-y">
            {others.map((f) => (
              <li
                key={f.profile.id}
                className="flex items-center justify-between gap-2 py-1.5 text-sm"
              >
                <span className="truncate">
                  {f.profile.full_name || f.profile.username || "Member"}
                </span>
                <span className="shrink-0 text-xs">
                  {f.checkin ? (
                    f.checkin.status === "safe" ? (
                      <span className="text-emerald-600">
                        ✅ ဘေးကင်း · {timeAgo(f.checkin.created_at)}
                      </span>
                    ) : (
                      <span className="text-destructive">
                        ⚠️ အကူအညီလို · {timeAgo(f.checkin.created_at)}
                      </span>
                    )
                  ) : (
                    <span className="text-muted-foreground">— အသိမပေးရသေး</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
