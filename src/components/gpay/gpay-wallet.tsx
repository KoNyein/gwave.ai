"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plus,
  QrCode,
  Receipt,
  ScanLine,
  Send,
  ShieldCheck,
  ShoppingBag,
  Store,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createGpayTopupCheckout,
  setGpayPin,
  transferGpay,
} from "@/lib/actions/gpay";
import {
  CurrencySwitcher,
  useDisplayCurrency,
} from "@/components/gpay/currency-switcher";
import type { CurrencyMeta } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { GpayAccount, GpayTransaction } from "@/types/database";

function fmt(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

type Panel = null | "send" | "topup" | "receive" | "pin";

/**
 * KPay-style G-Pay wallet: a gradient balance header with a hide toggle, four
 * primary actions (scan / send / top-up / history), a service grid, a monthly
 * in/out summary and a styled transaction list.
 *
 * For now money moves two ways only: **user-to-user transfer** and **Stripe
 * card top-up** (cash-in). No agent/bank rails.
 */
export function GpayWallet({
  account,
  transactions,
  hasPin,
  currencies,
}: {
  account: GpayAccount;
  transactions: GpayTransaction[];
  hasPin: boolean;
  currencies: CurrencyMeta[];
}) {
  const t = useTranslations("gpay");
  const [panel, setPanel] = React.useState<Panel>(null);
  const [hidden, setHidden] = React.useState(false);
  // Balance is USD-pegged; the viewer can display it in any currency.
  const disp = useDisplayCurrency(currencies);

  const now = new Date();
  const monthly = transactions.reduce(
    (acc, tx) => {
      const d = new Date(tx.created_at);
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())
        return acc;
      if (tx.to_account === account.id) acc.in += Number(tx.amount);
      else acc.out += Number(tx.amount);
      return acc;
    },
    { in: 0, out: 0 },
  );

  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  return (
    <div className="space-y-4">
      {/* Balance header */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-5 text-primary-foreground shadow-lg">
        <div className="flex items-center justify-center gap-2 text-sm opacity-90">
          e-Wallet {t("balance")}
          <CurrencySwitcher
            currencies={currencies}
            value={disp.code}
            onChange={disp.choose}
          />
          <button type="button" onClick={() => setHidden((h) => !h)} aria-label="toggle">
            {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-1 text-center text-4xl font-bold tabular-nums">
          {hidden ? "••••••" : disp.format(account.balance)}
        </p>
        {disp.code !== "USD" ? (
          <p className="mt-0.5 text-center text-xs opacity-80">
            ${fmt(account.balance)} USD
          </p>
        ) : null}
        <p className="mt-1 text-center text-xs opacity-90">
          {t("myNumber")}: <span className="font-mono">{account.phone}</span>
        </p>

        <div className="mt-5 grid grid-cols-4 gap-1">
          <ActionTile icon={ScanLine} label="Scan" href="/tools/qr" />
          <ActionTile icon={Send} label={t("sendMoney")} onClick={() => toggle("send")} active={panel === "send"} />
          <ActionTile icon={Plus} label={t("topupTitle")} onClick={() => toggle("topup")} active={panel === "topup"} />
          <ActionTile icon={Receipt} label={t("history")} href="#history" />
        </div>
      </div>

      {panel === "send" ? <SendPanel hasPin={hasPin} onClose={() => setPanel(null)} /> : null}
      {panel === "topup" ? <TopupPanel onClose={() => setPanel(null)} /> : null}
      {panel === "receive" ? <ReceivePanel phone={account.phone} onClose={() => setPanel(null)} /> : null}
      {panel === "pin" ? <PinManager hasPin={hasPin} onClose={() => setPanel(null)} /> : null}

      {/* Service grid */}
      <Card>
        <CardContent className="grid grid-cols-4 gap-y-4 p-4">
          <Service icon={QrCode} label={t("receiveMoney")} onClick={() => toggle("receive")} />
          <Service icon={Plus} label={t("topupTitle")} onClick={() => toggle("topup")} />
          <Service icon={ShoppingBag} label="Shop" href="/shop" />
          <Service icon={Store} label="Live Sale" href="/live" />
          <Service icon={Banknote} label={t("currency")} href="/tools/currency" />
          <Service icon={Receipt} label={t("history")} href="#history" />
          <Service icon={Send} label={t("sendMoney")} onClick={() => toggle("send")} />
          <Service
            icon={ShieldCheck}
            label={t("pinTitle")}
            onClick={() => toggle("pin")}
            badge={hasPin ? undefined : "!"}
          />
        </CardContent>
      </Card>

      {/* Monthly summary */}
      <Card className="bg-secondary/40">
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-[11px] text-muted-foreground">
              {t("received")} ({now.toLocaleDateString("en-US", { month: "short" })})
            </p>
            <p className="font-bold text-primary">+{disp.format(monthly.in)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">{t("sent")}</p>
            <p className="font-bold text-destructive">−{disp.format(monthly.out)}</p>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card id="history">
        <CardContent className="p-4">
          <p className="mb-2 font-semibold">{t("history")}</p>
          {transactions.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("noTransactions")}</p>
          ) : (
            <ul className="divide-y">
              {transactions.map((txn) => {
                const incoming = txn.to_account === account.id;
                return (
                  <li key={txn.id} className="flex items-center gap-3 py-2.5">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        incoming ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {incoming ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {txn.kind === "topup" ? t("kindTopup") : incoming ? t("received") : t("sent")}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {new Date(txn.created_at).toLocaleString()}
                        {txn.note ? ` · ${txn.note}` : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-semibold tabular-nums",
                        incoming ? "text-primary" : "text-destructive",
                      )}
                    >
                      {incoming ? "+" : "−"}
                      {disp.format(Number(txn.amount))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ActionTile({
  icon: Icon,
  label,
  onClick,
  href,
  active,
}: {
  icon: typeof ScanLine;
  label: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
}) {
  const inner = (
    <span className="flex flex-col items-center gap-1.5">
      <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-white/15", active && "bg-white/30")}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-center text-[11px] leading-tight">{label}</span>
    </span>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return (
    <button type="button" onClick={onClick} className="focus:outline-none">
      {inner}
    </button>
  );
}

function Service({
  icon: Icon,
  label,
  onClick,
  href,
  badge,
}: {
  icon: typeof QrCode;
  label: string;
  onClick?: () => void;
  href?: string;
  badge?: string;
}) {
  const inner = (
    <span className="flex flex-col items-center gap-1.5">
      <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
        {badge ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="text-center text-[11px] leading-tight">{label}</span>
    </span>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return (
    <button type="button" onClick={onClick} className="focus:outline-none">
      {inner}
    </button>
  );
}

function PanelShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold">{title}</p>
          <button type="button" onClick={onClose} aria-label="close" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/** Send money — user-to-user, with an optional PIN and idempotency key. */
function SendPanel({ hasPin, onClose }: { hasPin: boolean; onClose: () => void }) {
  const t = useTranslations("gpay");
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);
  const [clientRef, setClientRef] = React.useState(() => crypto.randomUUID());

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setOk(false);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const amount = Number(fd.get("amount"));
    const res = await transferGpay({
      toPhone: String(fd.get("toPhone") ?? ""),
      amount: Number.isFinite(amount) ? amount : 0,
      note: String(fd.get("note") ?? "") || undefined,
      pin: String(fd.get("pin") ?? "") || undefined,
      clientRef,
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOk(true);
    setClientRef(crypto.randomUUID());
    form.reset();
    router.refresh();
  }

  return (
    <PanelShell title={t("sendMoney")} onClose={onClose}>
      <form onSubmit={send} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="toPhone">{t("recipientNumber")}</Label>
          <Input id="toPhone" name="toPhone" required placeholder="09xxxxxxxxx" inputMode="tel" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="amount">{t("amount")}</Label>
          <Input id="amount" name="amount" type="number" min="1" step="0.01" required inputMode="decimal" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="note">{t("noteOptional")}</Label>
          <Input id="note" name="note" maxLength={200} />
        </div>
        {hasPin ? (
          <div className="space-y-1">
            <Label htmlFor="pin">{t("pinLabel")}</Label>
            <Input id="pin" name="pin" type="password" inputMode="numeric" autoComplete="off" required maxLength={6} placeholder="••••" />
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {ok ? <p className="text-sm text-primary">{t("sentOk")}</p> : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
          {t("send")}
        </Button>
      </form>
    </PanelShell>
  );
}

/** Cash-in via Stripe — enter an amount, redirect to Stripe Checkout. */
function TopupPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("gpay");
  // G-Pay is USD-pegged, so top-up amounts are in USD.
  const [amount, setAmount] = React.useState("10");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function pay() {
    setError(null);
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 1) {
      setError(t("topupMin"));
      return;
    }
    setPending(true);
    const res = await createGpayTopupCheckout(value);
    if (!res.ok) {
      setPending(false);
      setError(res.error);
      return;
    }
    // Redirect to Stripe Checkout.
    window.location.href = res.data.url;
  }

  return (
    <PanelShell title={t("topupTitle")} onClose={onClose}>
      <div className="space-y-1">
        <Label htmlFor="topup-amount">{t("topupAmount")}</Label>
        <Input
          id="topup-amount"
          type="number"
          min="1"
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[5, 10, 50, 100].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setAmount(String(v))}
            className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted"
          >
            ${v}
          </button>
        ))}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">{t("topupHint")}</p>
      <Button onClick={pay} disabled={pending} className="w-full">
        {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
        {t("topupPay")}
      </Button>
    </PanelShell>
  );
}

/** Receive — the member's G-Pay number as a QR to be paid. */
function ReceivePanel({ phone, onClose }: { phone: string; onClose: () => void }) {
  const t = useTranslations("gpay");
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    QRCode.toDataURL(`gpay:${phone}`, { width: 320, margin: 1 })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [phone]);
  return (
    <PanelShell title={t("receiveMoney")} onClose={onClose}>
      <div className="flex flex-col items-center gap-2 py-2">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="G-Pay QR" className="h-48 w-48 rounded-lg" />
        ) : (
          <div className="h-48 w-48 animate-pulse rounded-lg bg-muted" />
        )}
        <p className="font-mono text-lg font-semibold">{phone}</p>
        <p className="text-center text-xs text-muted-foreground">{t("receiveHint")}</p>
      </div>
    </PanelShell>
  );
}

/** Set or change the transaction PIN that guards outgoing transfers. */
function PinManager({ hasPin, onClose }: { hasPin: boolean; onClose: () => void }) {
  const t = useTranslations("gpay");
  const router = useRouter();
  const [pin, setPin] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setError(null);
    if (!/^[0-9]{4,6}$/.test(pin)) {
      setError(t("pinRule"));
      return;
    }
    if (pin !== confirm) {
      setError(t("pinMismatch"));
      return;
    }
    setPending(true);
    const res = await setGpayPin(pin);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <PanelShell title={t("pinTitle")} onClose={onClose}>
      <p className="text-xs text-muted-foreground">{t("pinHint")}</p>
      <div className="space-y-2">
        <div className="space-y-1">
          <Label htmlFor="new-pin">{t("pinNew")}</Label>
          <Input id="new-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="confirm-pin">{t("pinConfirm")}</Label>
          <Input id="confirm-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))} placeholder="••••" />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <KeyRound className="mr-1.5 h-4 w-4" />}
          {hasPin ? t("pinChange") : t("pinSet")}
        </Button>
      </div>
    </PanelShell>
  );
}
