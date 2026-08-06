"use client";
// app/shop/page.tsx — GWAVE Item Shop (Burmese UI)

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  economyApi,
  errMy,
  CATEGORY_MY,
  type ShopItem,
} from "@/lib/economy";
import { ItemCard, PointsBadge, Toast } from "@/components/economy/shared";

export default function ShopPage() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [cat, setCat] = useState<string>("all");
  const [confirmItem, setConfirmItem] = useState<ShopItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ m: string; t: "ok" | "error" } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [shop, pts] = await Promise.all([
        economyApi.shopItems(),
        economyApi.points(),
      ]);
      setItems(shop);
      setBalance(pts.balance);
    } catch (e) {
      setToast({ m: errMy(String(e)), t: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cats = useMemo(
    () => ["all", ...Array.from(new Set(items.map((i) => i.category)))],
    [items],
  );
  const shown = cat === "all" ? items : items.filter((i) => i.category === cat);

  async function buy(item: ShopItem) {
    setBusy(true);
    try {
      await economyApi.buy(item.id);
      setToast({ m: `${item.name_my ?? item.name} ဝယ်ယူပြီးပါပြီ ✓`, t: "ok" });
      setConfirmItem(null);
      await load();
    } catch (e) {
      setToast({ m: errMy(String(e)), t: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function claimDaily() {
    try {
      const r = await economyApi.claim("daily_login");
      setBalance(r.balance);
      setToast({ m: "နေ့စဉ်ဆု +50 G ရရှိပါပြီ ✓", t: "ok" });
    } catch (e) {
      setToast({ m: errMy(String(e)), t: "error" });
    }
  }

  return (
    <main
      className="min-h-dvh pb-24"
      style={{ background: "#0E1613", color: "#E9EFE9" }}
    >
      {/* header */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-4 py-3"
        style={{
          background: "rgba(14,22,19,.92)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid #1E2B24",
        }}
      >
        <div>
          <h1 className="text-lg font-black tracking-wide">GWAVE ဆိုင်</h1>
          <p className="text-[11px]" style={{ color: "#7C8A82" }}>
            Skin, တံဆိပ်နဲ့ item များ
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={claimDaily}
            className="rounded-full px-3 py-1.5 text-xs font-bold"
            style={{ background: "#153524", color: "#7BE3A4", border: "1px solid #2E7D4F" }}
          >
            🎁 နေ့စဉ်ဆု
          </button>
          <Link
            href="/inventory"
            aria-label="ကျွန်ုပ်၏ ပစ္စည်းများ"
            className="rounded-full px-3 py-1.5 text-xs font-bold"
            style={{ background: "#141F19", color: "#9DB0A5", border: "1px solid #1E2B24" }}
          >
            🎒
          </Link>
          <PointsBadge balance={balance} />
        </div>
      </header>

      {/* category tabs */}
      <nav className="flex gap-2 overflow-x-auto px-4 py-3">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors"
            style={
              cat === c
                ? { background: "#E9EFE9", color: "#0E1613" }
                : { background: "#141F19", color: "#9DB0A5", border: "1px solid #1E2B24" }
            }
          >
            {c === "all" ? "အားလုံး" : CATEGORY_MY[c] ?? c}
          </button>
        ))}
      </nav>

      {/* grid */}
      {loading ? (
        <p className="px-4 py-10 text-center text-sm" style={{ color: "#7C8A82" }}>
          ဆိုင်ဖွင့်နေသည်…
        </p>
      ) : shown.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm" style={{ color: "#7C8A82" }}>
          ဒီအမျိုးအစားမှာ ပစ္စည်းမရှိသေးပါ
        </p>
      ) : (
        <section className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((item) => {
            const left =
              item.max_supply !== null ? item.max_supply - item.minted_count : null;
            const soldOut = left !== null && left <= 0;
            return (
              <ItemCard
                key={item.id}
                rarity={item.rarity}
                thumbnailUrl={item.thumbnail_url}
                name={item.name}
                nameMy={item.name_my}
                category={item.category}
                dimmed={soldOut}
                ribbon={
                  item.max_supply !== null ? (
                    <span
                      className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                      style={{ background: "rgba(0,0,0,.55)", color: "#F5B437" }}
                    >
                      {soldOut ? "ကုန်သွားပြီ" : `${left} ခုသာကျန်`}
                    </span>
                  ) : undefined
                }
                footer={
                  <button
                    disabled={soldOut}
                    onClick={() => setConfirmItem(item)}
                    className="w-full rounded-xl py-2 text-sm font-black disabled:opacity-40"
                    style={{
                      background: "linear-gradient(135deg,#F5B437,#D89B1F)",
                      color: "#231A08",
                    }}
                  >
                    G {item.price_points.toLocaleString()}
                  </button>
                }
              />
            );
          })}
        </section>
      )}

      {/* buy confirm modal */}
      {confirmItem && (
        <div
          className="fixed inset-0 z-50 grid place-items-end sm:place-items-center"
          style={{ background: "rgba(0,0,0,.6)" }}
          onClick={() => !busy && setConfirmItem(null)}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl p-5 sm:rounded-3xl"
            style={{ background: "#141F19", border: "1px solid #1E2B24" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-black">ဝယ်ယူမှု အတည်ပြုပါ</h2>
            <p className="mt-2 text-sm" style={{ color: "#9DB0A5" }}>
              {confirmItem.name_my ?? confirmItem.name} ကို{" "}
              <b style={{ color: "#F5B437" }}>
                G {confirmItem.price_points.toLocaleString()}
              </b>{" "}
              နဲ့ ဝယ်မှာ သေချာပါသလား?
            </p>
            <p className="mt-1 text-xs" style={{ color: "#7C8A82" }}>
              လက်ကျန်: G {balance?.toLocaleString() ?? "—"} → ဝယ်ပြီးရင် G{" "}
              {balance !== null
                ? (balance - confirmItem.price_points).toLocaleString()
                : "—"}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                disabled={busy}
                onClick={() => setConfirmItem(null)}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold"
                style={{ background: "#1E2B24", color: "#9DB0A5" }}
              >
                မဝယ်တော့ပါ
              </button>
              <button
                disabled={busy}
                onClick={() => buy(confirmItem)}
                className="flex-1 rounded-xl py-2.5 text-sm font-black disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg,#F5B437,#D89B1F)",
                  color: "#231A08",
                }}
              >
                {busy ? "ဝယ်နေသည်…" : "ဝယ်မည်"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.m} tone={toast.t} onDone={() => setToast(null)} />
      )}
    </main>
  );
}
