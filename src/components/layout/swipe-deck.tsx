"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Earth, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { NAV_SECTIONS, visibleNav } from "@/components/layout/nav-items";
import {
  CONTENT_DECK,
  deckIndexOf,
  nextContentHref,
  prevHref,
  WORLD_HREF,
} from "@/lib/deck";
import { cn } from "@/lib/utils";

/// ပွတ်ဆွဲမှ တကယ် "ဆွဲတယ်" လို့ ရေတွက်မယ့် အကွာအဝေး (px)
const DIST = 72;
/// ထောင်လိုက် ရွေ့မှုက ဒီအဆကျော်ရင် အလျားလိုက် လို့ မယူဆတော့ဘူး
const RATIO = 1.7;
/// ဒီထက် ကြာရင် "ဆွဲတာ" မဟုတ်တော့ဘူး — ဖြည်းဖြည်း ရွေ့တာ scroll ဖြစ်နိုင်
const MAX_MS = 700;
/// ကုန်းဘောင် ကိုက် — အနားနားက touch တွေက browser ရဲ့ back gesture နဲ့ တိုက်
const EDGE_DEAD = 24;

/** Gesture ကို လက်လွှတ်ရမယ့် element လား (scroll/ဖြည့်စွက်/3D စတာ) */
function blocksSwipe(start: EventTarget | null): boolean {
  let el = start instanceof Element ? start : null;
  while (el && el !== document.body) {
    const tag = el.tagName;
    if (
      tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
      tag === "CANVAS" || tag === "IFRAME" || tag === "VIDEO"
    ) return true;
    if (el.getAttribute("data-no-swipe") !== null) return true;
    if (el instanceof HTMLElement && el.isContentEditable) return true;
    // အလျားလိုက် scroll လုပ်နေတဲ့ အတန်း (chip row, carousel …) က ကိုယ့်
    // gesture ကို ကိုယ်သုံးတယ် — ဝင်မယူဘူး။
    const ox = getComputedStyle(el).overflowX;
    if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 4) {
      return true;
    }
    el = el.parentElement;
  }
  return false;
}

/**
 * 🧭 System တစ်ခုလုံးရဲ့ ပွတ်ဆွဲ လမ်းညွှန် (mobile-first)。
 *
 *   ← ဘယ်ဘက် ဆွဲ → 🌍 Metaverse
 *   → ညာဘက် ဆွဲ  → 📰 Feed → Reels → Live → Games (စက်ဝိုင်း)
 *   ↑ အပေါ် ဆွဲ   → ⚡ Function အားလုံး sheet
 *   ↓ အောက် ဆွဲ   → sheet ပိတ်
 *
 * ★ Route push ပဲ လုပ်တယ် — page နှစ်ခုကို တစ်ပြိုင်နက် mount မထားဘူး။
 *   (pager စစ်စစ်လုပ်ရင် metaverse ရဲ့ 3D က feed ဖတ်နေချိန်မှာပါ
 *   နောက်ကွယ်က ပြေးနေမယ် — ဖုန်း ပူတဲ့ ပြဿနာ ပြန်ဖြစ်မယ်)。
 * ★ Desktop မှာ ဘာမှ မလုပ်ဘူး — mouse မှာ ပွတ်ဆွဲ မရှိဘူး။
 */
export function SwipeDeck() {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [sheet, setSheet] = React.useState(false);
  const [flash, setFlash] = React.useState<"left" | "right" | null>(null);
  const [coach, setCoach] = React.useState(false);

  const pathRef = React.useRef(pathname);
  pathRef.current = pathname;
  const sheetRef = React.useRef(sheet);
  sheetRef.current = sheet;

  // Route ပြောင်းတိုင်း sheet ပိတ်
  React.useEffect(() => setSheet(false), [pathname]);

  // ပထမဆုံး အကြိမ်မှာ တစ်ခါ သင်ပြတယ် — ပြီးရင် ဘယ်တော့မှ ထပ်မပြဘူး
  React.useEffect(() => {
    if (!("ontouchstart" in window)) return;
    try {
      if (localStorage.getItem("gw-swipe-coach") === "1") return;
      localStorage.setItem("gw-swipe-coach", "1");
    } catch {
      return;
    }
    setCoach(true);
    const id = setTimeout(() => setCoach(false), 5200);
    return () => clearTimeout(id);
  }, []);

  React.useEffect(() => {
    if (!("ontouchstart" in window)) return;
    let sx = 0, sy = 0, at = 0, live = false;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { live = false; return; }
      const t0 = e.touches[0]!;
      if (t0.clientX < EDGE_DEAD || t0.clientX > window.innerWidth - EDGE_DEAD) {
        live = false;
        return;
      }
      if (blocksSwipe(e.target)) { live = false; return; }
      sx = t0.clientX; sy = t0.clientY; at = Date.now(); live = true;
    };

    const onEnd = (e: TouchEvent) => {
      if (!live) return;
      live = false;
      const t0 = e.changedTouches[0];
      if (!t0) return;
      if (Date.now() - at > MAX_MS) return;
      const dx = t0.clientX - sx, dy = t0.clientY - sy;
      const ax = Math.abs(dx), ay = Math.abs(dy);

      if (ax >= DIST && ax > ay * RATIO) {
        // ── အလျားလိုက် ─────────────────────────────────────────────────
        if (sheetRef.current) return;
        const to = dx < 0 ? prevHref() : nextContentHref(pathRef.current);
        if (to === pathRef.current) return;
        setFlash(dx < 0 ? "left" : "right");
        setTimeout(() => setFlash(null), 420);
        router.push(to);
      } else if (ay >= DIST && ay > ax * RATIO) {
        // ── ထောင်လိုက် ─────────────────────────────────────────────────
        if (dy < 0) setSheet(true);
        else setSheet(false);
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", () => { live = false; }, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
    };
  }, [router]);

  const deckPos = deckIndexOf(pathname);
  const inWorld = pathname.startsWith(WORLD_HREF);

  return (
    <>
      {/* ဆွဲလိုက်တဲ့ ဘက်ကို အလင်းတန်း တစ်ချက် — "အလုပ်လုပ်တယ်" ဆိုတာ သိရ */}
      {flash ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none fixed inset-y-0 z-[60] w-24 animate-pulse lg:hidden",
            flash === "left"
              ? "left-0 bg-gradient-to-r from-primary/35 to-transparent"
              : "right-0 bg-gradient-to-l from-primary/35 to-transparent",
          )}
        />
      ) : null}

      {/* deck ရဲ့ ဘယ်နေရာမှာ ရှိလဲ — အစက်လေးတွေ (feed/reels/live/games) */}
      {deckPos >= 0 && !sheet ? (
        <div
          aria-hidden
          className="pointer-events-none fixed bottom-[4.2rem] left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1.5 shadow-sm backdrop-blur lg:hidden"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          <Earth className="h-3 w-3 text-muted-foreground/60" />
          {CONTENT_DECK.map((p, i) => (
            <span
              key={p.href}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === deckPos ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/35",
              )}
            />
          ))}
        </div>
      ) : null}

      {/* ပထမဆုံး ဝင်တဲ့အခါ တစ်ခါ သင်ပြ */}
      {coach ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 lg:hidden">
          <div className="rounded-2xl bg-foreground/90 px-4 py-3 text-center text-xs leading-relaxed text-background shadow-lg">
            ← ဘယ်ဘက်ဆွဲ — 🌍 Metaverse · ညာဘက်ဆွဲ — 📰 Feed / Reels →
            <br />↑ အပေါ်ဆွဲ — function အားလုံး
          </div>
        </div>
      ) : null}

      {/* ⚡ အပေါ်ဆွဲရင် ပွင့်တဲ့ function sheet */}
      {sheet ? (
        <QuickSheet
          onClose={() => setSheet(false)}
          t={t}
          inWorld={inWorld}
        />
      ) : null}
    </>
  );
}

function QuickSheet({
  onClose,
  t,
  inWorld,
}: {
  onClose: () => void;
  t: ReturnType<typeof useTranslations<"nav">>;
  inWorld: boolean;
}) {
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] lg:hidden" data-no-swipe>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto overscroll-contain rounded-t-2xl bg-background shadow-2xl"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="sticky top-0 flex items-center gap-2 border-b bg-background px-4 py-3">
          <span className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/30" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!inWorld ? (
          <Link
            href={WORLD_HREF}
            onClick={onClose}
            className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-primary/10 px-3 py-3 text-primary"
          >
            <Earth className="h-6 w-6" />
            <span className="font-semibold">{t("metaverse")}</span>
            <span className="ml-auto text-xs text-muted-foreground">← ဆွဲ</span>
          </Link>
        ) : null}

        <div className="p-3">
          {NAV_SECTIONS.map((section) => {
            // adult gate က drawer မှာ ရှိပြီးသား — ဒီမှာ profile မသိလို့
            // အားလုံး ပြပြီး route ကိုယ်တိုင်က requireAdult() နဲ့ ကာတယ်။
            const items = visibleNav(section.items, true);
            if (items.length === 0) return null;
            return (
              <div key={section.headingKey} className="mb-2">
                <p className="px-1 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(section.headingKey)}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border bg-card px-1 py-2 text-center active:bg-muted"
                      >
                        <Icon className="h-5 w-5 text-primary" />
                        <span className="line-clamp-2 text-[11px] leading-tight">
                          {t(item.labelKey)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
