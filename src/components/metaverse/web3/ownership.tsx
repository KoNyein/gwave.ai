"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import {
  WalletError,
  shortAddress,
  txBusy,
  txCopy,
  type TxState,
} from "./tx-state";
import {
  linkWallet,
  smartWalletSupported,
  unlinkWallet,
  walletAvailable,
  type Connector,
} from "./wallet";

/// Phase W8 — ပိုင်ဆိုင်မှု UI。
///
/// ★ **စကားလုံး စည်းမျဉ်း** — "wallet", "sign", "gas", "mint" ဆိုတဲ့
///   စကားလုံးတွေ ဒီ file ရဲ့ **user မြင်ရတဲ့ စာသား** ထဲမှာ တစ်ခုမှ မပါဘူး။
///   Gwave ရဲ့ user တွေက crypto မသိတဲ့သူတွေ — အဲဒီစကားလုံးတွေက
///   ရှင်းပြစရာ မဟုတ်ဘဲ ကြောက်စရာ ဖြစ်တယ်။ အားလုံးကို **"ပိုင်ဆိုင်မှု"**
///   နဲ့ အစားထိုးထားတယ်။
/// ★ **မချိတ်ဘဲ ဆက်သုံးလို့ရကြောင်း အမြဲပြရမယ်** — sheet တိုင်းမှာ
///   "ကျော်မည်" ရှိတယ်၊ chip က မချိတ်ရသေးချိန်မှာ သတိပေးအရောင် မသုံးဘူး။
///   မချိတ်တာက ပုံမှန်ဖြစ်တယ်၊ ချွတ်ယွင်းချက် မဟုတ်ဘူး။
/// ★ **Bottom sheet — modal အပြည့် မဟုတ်ဘူး** — အောက်ခြေကနေ တက်လာပြီး
///   3D လောကကို ဆက်မြင်ရတယ်။ ဖုန်းမှာ လက်ချောင်း ရောက်တဲ့နေရာလည်း
///   အောက်ခြေပဲ။

// ── Focus trap ─────────────────────────────────────────────────────────────
/// ★ Modal ဖွင့်ထားချိန် Tab က နောက်က ခလုတ်တွေဆီ ထွက်မသွားရ — keyboard
///   ဒါမှမဟုတ် screen reader သုံးသူက sheet ကနေ ဘယ်လိုမှ ထွက်လို့မရတဲ့
///   အခြေအနေ ဖြစ်သွားမယ်။ Esc နဲ့လည်း ပိတ်လို့ရရမယ်။
function useDialogKeys(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const node = ref.current;
    const previous = document.activeElement as HTMLElement | null;

    const focusable = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    focusable()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, [open, onClose]);

  return ref;
}

// ── (၁) WalletChip ─────────────────────────────────────────────────────────
export function OwnershipChip({
  wallet,
  onOpen,
}: {
  wallet: string | null;
  onOpen: () => void;
}) {
  return (
    <button
      data-hud="1"
      onClick={onOpen}
      // ★ မချိတ်ရသေးချိန်မှာ **သတိပေးအရောင် မသုံးရ** — မချိတ်တာက
      //   ပုံမှန်ဖြစ်တယ်။ အနီ/အဝါ ပြရင် တစ်ခုခု မှားနေတယ်လို့ ထင်မယ်။
      className="w3 w3-chip w3-tap flex items-center gap-1.5 px-2.5 py-1 text-[11px]"
      aria-label={wallet ? "ပိုင်ဆိုင်မှု အသေးစိတ်" : "ပိုင်ဆိုင်မှု ချိတ်ဆက်ရန်"}
    >
      {wallet ? (
        <>
          <span aria-hidden style={{ color: "var(--w3-accent)" }}>
            ◈
          </span>
          <span className="w3-mono">{shortAddress(wallet)}</span>
          <span aria-hidden className="opacity-60">
            ▾
          </span>
        </>
      ) : (
        <>
          <span aria-hidden>◇</span>
          <span>ပိုင်ဆိုင်မှု ချိတ်ရန်</span>
        </>
      )}
    </button>
  );
}

// ── (၆) Error state ────────────────────────────────────────────────────────
/// ★ အမှားတိုင်းမှာ **လုပ်စရာ** ပါရမယ်။ "မအောင်မြင်ပါ" ချည်း ပြပြီး
///   ဘာလုပ်ရမှန်း မပြောရင် user က ခလုတ်ကို ထပ်ခါထပ်ခါ နှိပ်တယ်။
export function OwnershipError({
  text,
  retryable,
  onRetry,
  onSkip,
}: {
  text: string;
  retryable: boolean;
  onRetry: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="w3-card p-3" role="alert">
      <div className="flex items-start gap-2">
        {/* ★ icon + အရောင် နှစ်ခုလုံး — အရောင်တစ်ခုတည်းနဲ့ အဓိပ္ပာယ်
            မဖော်ပြရ (W8.6)。 */}
        <span aria-hidden style={{ color: "var(--st-error)" }}>
          !
        </span>
        <p className="text-[13px] leading-relaxed">{text}</p>
      </div>
      <div className="mt-3 flex gap-2">
        {retryable && (
          <button onClick={onRetry} className="w3-btn-primary w3-tap flex-1 px-3 text-[13px]">
            ပြန်ကြိုးစားမည်
          </button>
        )}
        <button onClick={onSkip} className="w3-btn-ghost w3-tap flex-1 px-3 text-[13px]">
          ကျော်မည်
        </button>
      </div>
    </div>
  );
}

// ── (၃) SignaturePrompt ────────────────────────────────────────────────────
/// ★ အစိမ်းရောင် ✓ နှစ်ကြောင်းက ဒီ file ရဲ့ **အရေးအကြီးဆုံး element**。
///   User အများစုက အတည်ပြုခိုင်းတာကို "ငွေထုတ်တာ" လို့ ထင်ပြီး
///   ပယ်ဖျက်ကြတယ်။ ကြိုပြောထားမှ ဆက်လုပ်ကြတယ်။
function SignaturePrompt({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="px-4 pb-5 pt-2 text-center">
      <div className="w3-pulse mx-auto mb-3 text-4xl" aria-hidden>
        📱
      </div>
      <h2 className="text-[18px] font-semibold">ဖုန်းမှာ အတည်ပြုပါ</h2>
      <p className="mt-1 text-[13px]" style={{ color: "var(--w3-muted)" }}>
        သင့်ဖုန်းတွင် ပေါ်လာသော အတည်ပြုချက်ကို နှိပ်ပါ။
      </p>
      <ul
        className="mx-auto mt-3 max-w-xs space-y-1 text-left text-[11px]"
        style={{ color: "var(--st-success)" }}
      >
        <li>✓ ငွေကုန်ကျမှု မရှိပါ</li>
        <li>✓ ငွေလွှဲပြောင်းခြင်း မဟုတ်ပါ</li>
      </ul>
      <button
        onClick={onCancel}
        className="w3-btn-ghost w3-tap mt-4 w-full px-3 text-[13px]"
      >
        ပယ်ဖျက်မည်
      </button>
    </div>
  );
}

// ── (၄) TxProgress ─────────────────────────────────────────────────────────
/// ★ ဆင့်ကဲ progress — "စောင့်ပါ" တစ်ကြောင်းတည်း ပြပြီး ဘာမှ မပြောင်းရင်
///   user က ပျက်နေတယ်လို့ ထင်တယ်။ အဆင့် ၃ ဆင့်နဲ့ ခန့်မှန်းအချိန်ကို
///   ပြတယ်။
export function TxProgress({
  state,
  explorerBase = "https://basescan.org/tx/",
  onDismiss,
}: {
  state: TxState;
  explorerBase?: string;
  onDismiss?: () => void;
}) {
  const copy = txCopy(state);
  const hash =
    state.s === "submitted" || state.s === "confirming" || state.s === "success"
      ? state.hash
      : null;

  const step =
    state.s === "submitted" ? 1 : state.s === "confirming" ? 2 : state.s === "success" ? 3 : 0;

  // Success ကို ၄ စက္ကန့် ပြပြီးမှ ဖျောက်တယ် — ၁ စက္ကန့်ဆို မှတ်တမ်း
  // လင့်ကို နှိပ်လိုက်တောင် မမီဘူး။
  useEffect(() => {
    if (state.s !== "success" || !onDismiss) return;
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [state.s, onDismiss]);

  if (state.s === "idle") return null;

  return (
    <div
      className="w3 w3-card p-3"
      // ★ အခြေအနေ ပြောင်းတိုင်း screen reader ကြားရမယ် — မမြင်ရသူက
      //   progress bar ကို မမြင်ဘူး။
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-center gap-2 text-[13px]">
        <span aria-hidden>
          {state.s === "success" ? "✓" : state.s === "failed" ? "!" : "⏳"}
        </span>
        <span>{copy.title}</span>
      </div>

      {step > 0 && (
        <div className="mt-2">
          <div className="flex items-center gap-1" aria-hidden>
            {[1, 2, 3].map((i) => (
              <span key={i} className="flex flex-1 items-center gap-1">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: i <= step ? "var(--w3-accent)" : "var(--w3-border)",
                  }}
                />
                {i < 3 && (
                  <span
                    className="h-[2px] flex-1 rounded"
                    style={{
                      background: i < step ? "var(--w3-accent)" : "var(--w3-border)",
                      transition: "background 400ms ease-out",
                    }}
                  />
                )}
              </span>
            ))}
          </div>
          <div
            className="mt-1 flex justify-between text-[10px]"
            style={{ color: "var(--w3-muted)" }}
          >
            <span>ပို့ပြီး</span>
            <span>မှတ်တမ်း</span>
            <span>အတည်ပြု</span>
          </div>
        </div>
      )}

      {copy.hint && (
        <p className="mt-2 text-[11px]" style={{ color: "var(--w3-muted)" }}>
          {copy.hint}
        </p>
      )}

      {hash && (
        <a
          href={`${explorerBase}${hash}`}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 inline-block text-[11px] underline"
          style={{ color: "var(--st-info)" }}
        >
          မှတ်တမ်းကြည့်ရန် ↗
        </a>
      )}
    </div>
  );
}

// ── (၂) ConnectSheet + orchestration ───────────────────────────────────────
type SheetView = "choose" | "signing" | "error" | "linked";

/// ချိတ်ဆက်မှု စီမံခန့်ခွဲမှု တစ်ခုလုံး — chip နှိပ်ရင် sheet တက်တယ်။
export function OwnershipControl({
  wallet,
  onChange,
}: {
  wallet: string | null;
  onChange: (wallet: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<SheetView>("choose");
  const [error, setError] = useState<{ text: string; retryable: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const lastConnector = useRef<Connector>("smart");
  const titleId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setView("choose");
    setError(null);
  }, []);

  const dialogRef = useDialogKeys(open, close);

  const connect = useCallback(
    async (connector: Connector) => {
      lastConnector.current = connector;
      setBusy(true);
      setError(null);
      setView("signing");
      try {
        const res = await linkWallet(connector);
        onChange(res.wallet);
        setView("linked");
      } catch (err) {
        const we = err instanceof WalletError ? err : new WalletError("network");
        setError({ text: we.display, retryable: we.retryable });
        setView("error");
      } finally {
        setBusy(false);
      }
    },
    [onChange],
  );

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      await unlinkWallet();
      onChange(null);
      close();
    } catch {
      setError({ text: "ဖြုတ်၍ မရပါ — ပြန်ကြိုးစားပါ", retryable: true });
      setView("error");
    } finally {
      setBusy(false);
    }
  }, [close, onChange]);

  // ★ Passkey မရတဲ့ device အဟောင်းတွေမှာ ခလုတ်ကို **ဖျောက်မထားဘူး** —
  //   ပိတ်ထားပြီး ဘာလို့လဲ ပြောပြတယ်။ ဖျောက်လိုက်ရင် "ငါ့ဖုန်းမှာ
  //   ဘာလို့ မပေါ်တာလဲ" ဆိုတဲ့ မေးခွန်း ဖြေစရာ မရှိတော့ဘူး။
  const [canSmart, setCanSmart] = useState(true);
  const [canExternal, setCanExternal] = useState(true);
  useEffect(() => {
    setCanSmart(smartWalletSupported());
    setCanExternal(walletAvailable());
  }, []);

  return (
    <>
      <OwnershipChip wallet={wallet} onOpen={() => setOpen(true)} />

      {open && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-2 pb-2">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w3 w3-sheet w-full max-w-md"
          >
            <div
              aria-hidden
              className="mx-auto mt-2 h-1 w-10 rounded-full"
              style={{ background: "var(--w3-border)" }}
            />

            {view === "choose" && !wallet && (
              <div className="px-4 pb-5 pt-3">
                <h2 id={titleId} className="text-[18px] font-semibold">
                  ပိုင်ဆိုင်မှု အတည်ပြုခြင်း
                </h2>
                <p className="mt-1 text-[13px]" style={{ color: "var(--w3-muted)" }}>
                  မြေကွက်၊ အထူးပစ္စည်းများကို သင်ပိုင်ဆိုင်ကြောင်း အတည်ပြုနိုင်ပါသည်။
                </p>

                <button
                  onClick={() => void connect("smart")}
                  disabled={!canSmart || busy}
                  className="w3-btn-primary mt-4 w-full px-3 py-3 text-left disabled:opacity-50"
                >
                  <span className="block text-[15px]">👆 ဖုန်းဖြင့် အမြန်ဆောက်မည်</span>
                  <span className="block text-[11px] opacity-80">
                    {canSmart
                      ? "လျှို့ဝှက်စကားလုံး မလိုပါ"
                      : "ဤဖုန်းက ဤနည်းလမ်းကို မထောက်ပံ့ပါ"}
                  </span>
                </button>

                <button
                  onClick={() => void connect("external")}
                  disabled={!canExternal || busy}
                  className="w3-btn-ghost w3-tap mt-2 w-full px-3 py-3 text-left text-[14px] disabled:opacity-50"
                >
                  🦊 ရှိပြီးသား app ဖြင့် ချိတ်မည်
                  {!canExternal && (
                    <span
                      className="block text-[11px]"
                      style={{ color: "var(--w3-muted)" }}
                    >
                      ဤ browser တွင် မတွေ့ပါ
                    </span>
                  )}
                </button>

                {/* ★ ဒါက အမြဲ ပါရမယ် — Web3 က ရွေးချယ်စရာဖြစ်ကြောင်း
                    ထင်ရှားစေရမယ် (W8.0 စည်းမျဉ်း ၄)。 */}
                <p
                  className="mt-4 text-[12px] leading-relaxed"
                  style={{ color: "var(--w3-muted)" }}
                >
                  မလိုအပ်ပါက ကျော်သွားနိုင်သည် — Metaverse အားလုံး ပုံမှန်အတိုင်း
                  သုံးလို့ရပါသည်။
                </p>
                <button
                  onClick={close}
                  className="w3-btn-ghost w3-tap mt-2 w-full px-3 text-[13px]"
                >
                  ကျော်မည်
                </button>
              </div>
            )}

            {view === "choose" && wallet && (
              <div className="px-4 pb-5 pt-3">
                <h2 id={titleId} className="text-[18px] font-semibold">
                  ချိတ်ဆက်ပြီးပါပြီ
                </h2>
                <p className="w3-mono mt-2 text-[13px]">{wallet}</p>
                <p className="mt-2 text-[12px]" style={{ color: "var(--w3-muted)" }}>
                  ဖြုတ်လိုက်လည်း ဝယ်ထားသော ပစ္စည်းများ မပျောက်ပါ — ၎င်းတို့ကို
                  သင့်အကောင့်တွင် သိမ်းထားပါသည်။
                </p>
                <button
                  onClick={() => void disconnect()}
                  disabled={busy}
                  className="w3-btn-ghost w3-tap mt-4 w-full px-3 text-[13px] disabled:opacity-50"
                >
                  ဖြုတ်မည်
                </button>
                <button
                  onClick={close}
                  className="w3-btn-ghost w3-tap mt-2 w-full px-3 text-[13px]"
                >
                  ပိတ်မည်
                </button>
              </div>
            )}

            {view === "signing" && (
              <>
                <h2 id={titleId} className="sr-only">
                  အတည်ပြုချက် စောင့်နေသည်
                </h2>
                <SignaturePrompt onCancel={close} />
              </>
            )}

            {view === "error" && error && (
              <div className="px-4 pb-5 pt-3">
                <h2 id={titleId} className="mb-2 text-[16px] font-semibold">
                  ချိတ်ဆက်၍ မရပါ
                </h2>
                <OwnershipError
                  text={error.text}
                  retryable={error.retryable}
                  onRetry={() => void connect(lastConnector.current)}
                  onSkip={close}
                />
              </div>
            )}

            {view === "linked" && (
              <div className="px-4 pb-5 pt-3 text-center">
                <div className="text-3xl" aria-hidden style={{ color: "var(--st-success)" }}>
                  ✓
                </div>
                <h2 id={titleId} className="mt-1 text-[18px] font-semibold">
                  ပြီးပါပြီ
                </h2>
                <p className="w3-mono mt-2 text-[13px]">
                  {wallet ? shortAddress(wallet) : ""}
                </p>
                <button
                  onClick={close}
                  className="w3-btn-primary w3-tap mt-4 w-full px-3 text-[13px]"
                >
                  ဆက်သွားမည်
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── (၅) PlotPanel ──────────────────────────────────────────────────────────
export type PlotInfo = {
  id: number;
  gridX: number;
  gridZ: number;
  zone: string;
  rarity: string;
  waterAccess: boolean;
  roadAccess: boolean;
  size: number;
  owned: boolean;
};

export function PlotPanel({
  plot,
  onBuild,
  onRename,
}: {
  plot: PlotInfo;
  onBuild?: () => void;
  onRename?: () => void;
}) {
  const rows: [string, string][] = [
    ["ဇုန်", plot.zone],
    ["ရှားပါးမှု", plot.rarity],
    ["အရွယ်", `${plot.size} × ${plot.size}`],
    ["ရေလမ်း", plot.waterAccess ? "ရှိသည်" : "မရှိပါ"],
    ["လမ်းမ", plot.roadAccess ? "ရှိသည်" : "မရှိပါ"],
  ];

  return (
    <div className="w3 w3-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold">
          မြေကွက် ({plot.gridX}, {plot.gridZ})
        </h3>
        {plot.owned && (
          <span
            className="w3-chip px-2 py-0.5 text-[11px]"
            style={{ color: "var(--w3-accent)" }}
          >
            ◈ ပိုင်ဆိုင်
          </span>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt style={{ color: "var(--w3-muted)" }}>{label}</dt>
            <dd className="text-right">{value}</dd>
          </div>
        ))}
      </dl>

      {plot.owned && (onBuild || onRename) && (
        <div className="mt-3 flex gap-2">
          {onBuild && (
            <button onClick={onBuild} className="w3-btn-primary w3-tap flex-1 px-3 text-[13px]">
              ဆောက်လုပ်မည်
            </button>
          )}
          {onRename && (
            <button onClick={onRename} className="w3-btn-ghost w3-tap flex-1 px-3 text-[13px]">
              နာမည်ပြောင်း
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Loading / empty ────────────────────────────────────────────────────────
/// ★ Spinner မဟုတ်ဘဲ skeleton — ဘာလာမလဲ ကြိုမြင်ရတယ်၊ စောင့်ရတာ
///   တိုသလို ခံစားရတယ်။
export function PlotSkeleton() {
  return (
    <div className="w3 w3-card space-y-2 p-3" aria-hidden>
      <div className="w3-skeleton h-4 w-2/3" />
      <div className="w3-skeleton h-3 w-1/2" />
      <div className="w3-skeleton h-3 w-1/3" />
    </div>
  );
}

/// ★ ဗလာ မပြရဘူး — လုပ်စရာတစ်ခု ပေးရမယ်။
export function NoPlots({ onExplore }: { onExplore: () => void }) {
  return (
    <div className="w3 w3-card p-4 text-center">
      <div className="text-2xl" aria-hidden style={{ color: "var(--w3-accent-dim)" }}>
        ◈
      </div>
      <p className="mt-1 text-[13px]">မြေကွက် မရှိသေးပါ</p>
      <button
        onClick={onExplore}
        className="w3-btn-ghost w3-tap mt-3 w-full px-3 text-[13px]"
      >
        မြို့ကို လှည့်ကြည့်ရန်
      </button>
    </div>
  );
}

export { txBusy };
