"use client";
// components/economy/shared.tsx
// PointsBadge (G-Points coin chip) + ItemCard (rarity-glow card) + Toast

import { RARITY, CATEGORY_MY, type Rarity } from "@/lib/economy";
import { useEffect } from "react";

// ---------- G-Points coin badge (signature element) ----------
export function PointsBadge({ balance }: { balance: number | null }) {
  return (
    <div
      className="flex items-center gap-2 rounded-full px-4 py-1.5"
      style={{
        background: "linear-gradient(135deg,#231A08,#3A2B0D)",
        border: "1px solid #F5B43755",
        boxShadow: "0 0 12px rgba(245,180,55,.25)",
      }}
    >
      <span
        aria-hidden
        className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-black"
        style={{
          background: "radial-gradient(circle at 35% 30%,#FFE9A8,#F5B437 60%,#B37E12)",
          color: "#3A2B0D",
        }}
      >
        G
      </span>
      <span
        className="text-sm font-bold tabular-nums tracking-wide"
        style={{ color: "#F5B437" }}
      >
        {balance === null ? "···" : balance.toLocaleString()}
      </span>
    </div>
  );
}

// ---------- Rarity chip ----------
export function RarityChip({ rarity }: { rarity: Rarity }) {
  const r = RARITY[rarity];
  return (
    <span
      className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
      style={{ color: r.color, border: `1px solid ${r.color}55`, background: `${r.color}14` }}
    >
      {r.label}
    </span>
  );
}

// ---------- Item card ----------
export function ItemCard({
  rarity,
  thumbnailUrl,
  name,
  nameMy,
  category,
  footer,
  ribbon,
  dimmed,
}: {
  rarity: Rarity;
  thumbnailUrl: string | null;
  name: string;
  nameMy: string | null;
  category: string;
  footer: React.ReactNode;
  ribbon?: React.ReactNode; // e.g. equipped / serial / supply
  dimmed?: boolean;
}) {
  const r = RARITY[rarity];
  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl transition-transform duration-150 active:scale-[.98]"
      style={{
        background: "#141F19",
        border: `1px solid ${r.color}44`,
        boxShadow: r.glow,
        opacity: dimmed ? 0.55 : 1,
      }}
    >
      <div className="relative aspect-square w-full" style={{ background: "#0C1410" }}>
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt={nameMy ?? name} className="h-full w-full object-cover" />
        ) : (
          <div
            className="grid h-full w-full place-items-center text-3xl font-black"
            style={{ color: `${r.color}66` }}
          >
            {name.charAt(0)}
          </div>
        )}
        {/* rarity band */}
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: `linear-gradient(90deg,transparent,${r.color},transparent)` }}
        />
        {ribbon && <div className="absolute left-2 top-2">{ribbon}</div>}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold" style={{ color: "#E9EFE9" }}>
              {nameMy ?? name}
            </p>
            <p className="text-[11px]" style={{ color: "#7C8A82" }}>
              {CATEGORY_MY[category] ?? category}
            </p>
          </div>
          <RarityChip rarity={rarity} />
        </div>
        <div className="mt-auto pt-1">{footer}</div>
      </div>
    </div>
  );
}

// ---------- Tiny toast ----------
export function Toast({
  message,
  tone,
  onDone,
}: {
  message: string;
  tone: "ok" | "error";
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-sm rounded-xl px-4 py-3 text-center text-sm font-semibold"
      style={{
        background: tone === "ok" ? "#153524" : "#3A1418",
        color: tone === "ok" ? "#7BE3A4" : "#FF9AA2",
        border: `1px solid ${tone === "ok" ? "#2E7D4F" : "#8A2B33"}`,
        boxShadow: "0 8px 24px rgba(0,0,0,.45)",
      }}
    >
      {message}
    </div>
  );
}
