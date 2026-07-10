"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Send,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { transferGpay } from "@/lib/actions/gpay";
import type { GpayAccount, GpayTransaction } from "@/types/database";

function formatMMK(amount: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    amount,
  );
}

export function GpayWallet({
  account,
  transactions,
}: {
  account: GpayAccount;
  transactions: GpayTransaction[];
}) {
  const t = useTranslations("gpay");
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);

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
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOk(true);
    form.reset();
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Balance */}
      <Card className="overflow-hidden border-primary/40 bg-gradient-to-br from-primary/15 to-primary/5">
        <CardContent className="p-5">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Wallet className="h-4 w-4" /> {t("balance")}
          </p>
          <p className="mt-1 text-3xl font-bold">
            {formatMMK(account.balance)}{" "}
            <span className="text-lg font-medium text-muted-foreground">
              {t("currency")}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("myNumber")}: <span className="font-mono">{account.phone}</span>
          </p>
        </CardContent>
      </Card>

      {/* Send money */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="flex items-center gap-1.5 font-semibold">
            <Send className="h-4 w-4 text-primary" /> {t("sendMoney")}
          </p>
          <form onSubmit={send} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="toPhone">{t("recipientNumber")}</Label>
              <Input
                id="toPhone"
                name="toPhone"
                required
                placeholder="09xxxxxxxxx"
                inputMode="tel"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="amount">{t("amount")}</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                min="1"
                step="0.01"
                required
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="note">{t("noteOptional")}</Label>
              <Input id="note" name="note" maxLength={200} />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {ok ? <p className="text-sm text-primary">{t("sentOk")}</p> : null}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-4 w-4" />
              )}
              {t("send")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardContent className="p-4">
          <p className="mb-2 font-semibold">{t("history")}</p>
          {transactions.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("noTransactions")}
            </p>
          ) : (
            <ul className="divide-y">
              {transactions.map((txn) => {
                const incoming = txn.to_account === account.id;
                return (
                  <li key={txn.id} className="flex items-center gap-3 py-2.5">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        incoming
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {incoming ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {txn.kind === "topup"
                          ? t("kindTopup")
                          : incoming
                            ? t("received")
                            : t("sent")}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {new Date(txn.created_at).toLocaleString()}
                        {txn.note ? ` · ${txn.note}` : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-sm font-semibold ${
                        incoming ? "text-primary" : ""
                      }`}
                    >
                      {incoming ? "+" : "−"}
                      {formatMMK(txn.amount)}
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
