"use client";
// app/inventory/page.tsx — ကျွန်ုပ်၏ပစ္စည်းများ (Inventory)

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  economyApi,
  errMy,
  CATEGORY_MY,
  type InventoryItem,
} from "@/lib/economy";
import { ItemCard, PointsBadge, Toast } from "@/components/economy/shared";

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [cat, setCat] = useState<string>("all");
  const [sellItem, setSellItem] = useState<InventoryItem | null>(null);
  const [sellPrice, setSellPrice] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ m: string; t: "ok" | "error" } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [inv, pts] = await Promise.all([
        economyApi.inventory(),
        economyApi.points(),
      ]);
      setItems(inv);
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

  async function equip(item: InventoryItem) {
    setBusy(true);
    try {
      await economyApi.equip(item.id);
      setToast({ m: `${item.name_my ?? item.name} တပ်ဆင်ပြီးပါပြီ ✓`, t: "ok" });
      await load();
    } catch (e) {
      setToast({ m: errMy(String(e)), t: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function sell() {
    if (!sellItem) return;
    const price = Number(sellPrice);
    if (!Number.isInteger(price) || price <= 0) {
      setToast({ m: "စျေးနှုန်းကို ဂဏန်းအပြည့်ဖြင့် ထည့်ပါ", t: "error" });
      return;
    }
    setBusy(true);
    try {
      await economyApi.listForSale(sellItem.id, price);
      setToast({ m: "ရောင်းစာရင်း တင်ပြီးပါပြီ ✓ (fee 5%)", t: "ok" });
      setSellItem(null);
      setSellPrice("");
      await load();
    } catch (e) {
      setToast({ m: errMy(String(e)), t: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="min-h-dvh pb-24"
      style={{ background: "#0E1613", color: "#E9EFE9" }}
    >
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-4 py-3"
        style={{
          background: "rgba(14,22,19,.92)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid #1E2B24",
        }}
      >
        <div>
          <h1 className="text-lg font-black tracking-wide">ကျွန်ုပ်၏ ပစ္စည်းများ</h1>
          <p className="text-[11px]" style={{ color: "#7C8A82" }}>
            {items.length} ခု ပိုင်ဆိုင်ထားသည်
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/items"
            aria-label="Item ဆိုင်"
            className="rounded-full px-3 py-1.5 text-xs font-bold"
            style={{ background: "#141F19", color: "#9DB0A5", border: "1px solid #1E2B24" }}
          >
            🛍
          </Link>
          <PointsBadge balance={balance} />
        </div>
      </header>

      <nav className="flex gap-2 overflow-x-auto px-4 py-3">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold"
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

      {loading ? (
        <p className="px-4 py-10 text-center text-sm" style={{ color: "#7C8A82" }}>
          ပစ္စည်းများ ရှာနေသည်…
        </p>
      ) : shown.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <p className="text-sm font-semibold">ပစ္စည်းမရှိသေးပါ</p>
          <p className="mt-1 text-xs" style={{ color: "#7C8A82" }}>
            ဆိုင်ကနေ ဝယ်လို့ရသလို နေ့စဉ်ဆုကနေလည်း ရနိုင်ပါတယ်
          </p>
          <Link
            href="/items"
            className="mt-4 inline-block rounded-xl px-5 py-2.5 text-sm font-black"
            style={{
              background: "linear-gradient(135deg,#F5B437,#D89B1F)",
              color: "#231A08",
            }}
          >
            ဆိုင်သို့သွားမည်
          </Link>
        </div>
      ) : (
        <section className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((item) => (
            <ItemCard
              key={item.id}
              rarity={item.rarity}
              thumbnailUrl={item.thumbnail_url}
              name={item.name}
              nameMy={item.name_my}
              category={item.category}
              dimmed={item.locked}
              ribbon={
                item.equipped ? (
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                    style={{ background: "#153524", color: "#7BE3A4" }}
                  >
                    ✓ တပ်ဆင်ထား
                  </span>
                ) : item.locked ? (
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                    style={{ background: "rgba(0,0,0,.55)", color: "#F5B437" }}
                  >
                    🔒 ရောင်းစာရင်းတင်ထား
                  </span>
                ) : item.serial_no !== null ? (
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                    style={{ background: "rgba(0,0,0,.55)", color: "#9DB0A5" }}
                  >
                    #{item.serial_no}
                  </span>
                ) : undefined
              }
              footer={
                item.locked ? (
                  <p className="text-center text-xs" style={{ color: "#7C8A82" }}>
                    ရောင်းစာရင်းထဲမှာ ရှိနေသည်
                  </p>
                ) : (
                  <div className="flex gap-1.5">
                    <button
                      disabled={busy || item.equipped}
                      onClick={() => equip(item)}
                      className="flex-1 rounded-xl py-2 text-xs font-black disabled:opacity-40"
                      style={{ background: "#153524", color: "#7BE3A4", border: "1px solid #2E7D4F" }}
                    >
                      {item.equipped ? "တပ်ဆင်ပြီး" : "တပ်ဆင်မည်"}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setSellItem(item);
                        setSellPrice("");
                      }}
                      className="flex-1 rounded-xl py-2 text-xs font-black"
                      style={{ background: "#1E2B24", color: "#F5B437" }}
                    >
                      ရောင်းမည်
                    </button>
                  </div>
                )
              }
            />
          ))}
        </section>
      )}

      {/* sell modal */}
      {sellItem && (
        <div
          className="fixed inset-0 z-50 grid place-items-end sm:place-items-center"
          style={{ background: "rgba(0,0,0,.6)" }}
          onClick={() => !busy && setSellItem(null)}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl p-5 sm:rounded-3xl"
            style={{ background: "#141F19", border: "1px solid #1E2B24" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-black">ရောင်းစာရင်းတင်မည်</h2>
            <p className="mt-1 text-sm" style={{ color: "#9DB0A5" }}>
              {sellItem.name_my ?? sellItem.name}
              {sellItem.serial_no !== null && ` (#${sellItem.serial_no})`}
            </p>
            <label className="mt-4 block text-xs font-semibold" style={{ color: "#9DB0A5" }}>
              ရောင်းစျေး (G-Points)
              <input
                inputMode="numeric"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value.replace(/\D/g, ""))}
                placeholder="ဥပမာ — 2000"
                className="mt-1.5 w-full rounded-xl px-3 py-2.5 text-base font-bold outline-none"
                style={{
                  background: "#0C1410",
                  color: "#F5B437",
                  border: "1px solid #1E2B24",
                }}
              />
            </label>
            {Number(sellPrice) > 0 && (
              <p className="mt-1.5 text-xs" style={{ color: "#7C8A82" }}>
                Platform fee 5% နုတ်ပြီး လက်ခံရမည့်ပမာဏ — G{" "}
                {Math.floor(Number(sellPrice) * 0.95).toLocaleString()}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                disabled={busy}
                onClick={() => setSellItem(null)}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold"
                style={{ background: "#1E2B24", color: "#9DB0A5" }}
              >
                မရောင်းတော့ပါ
              </button>
              <button
                disabled={busy || !sellPrice}
                onClick={sell}
                className="flex-1 rounded-xl py-2.5 text-sm font-black disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg,#F5B437,#D89B1F)",
                  color: "#231A08",
                }}
              >
                {busy ? "တင်နေသည်…" : "စာရင်းတင်မည်"}
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
