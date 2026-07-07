"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { closeShift, recordCashMovement } from "@/lib/actions/pos";
import { cn } from "@/lib/utils";
import type { Shift, Store } from "@/types/database";

export function ShiftManager({
  store,
  openShift: shift,
  cashSales,
  history,
}: {
  store: Store;
  openShift: Shift | null;
  cashSales: number;
  history: Shift[];
}) {
  const t = useTranslations("pos");
  const router = useRouter();
  const [cashDialog, setCashDialog] = React.useState<"in" | "out" | null>(null);
  const [closing, setClosing] = React.useState(false);

  const expected = shift
    ? Math.round(
        (Number(shift.float_amount) +
          cashSales +
          Number(shift.cash_in) -
          Number(shift.cash_out)) *
          100,
      ) / 100
    : 0;

  return (
    <div className="space-y-4">
      <h1 className="px-1 text-xl font-bold">{t("shiftsTitle")}</h1>

      {shift ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("currentShift")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
              <Stat label={t("floatAmount")} value={Number(shift.float_amount)} currency={store.currency} />
              <Stat label={t("cashSales")} value={cashSales} currency={store.currency} />
              <Stat label={t("cashIn")} value={Number(shift.cash_in)} currency={store.currency} />
              <Stat label={t("cashOut")} value={Number(shift.cash_out)} currency={store.currency} />
              <Stat label={t("expectedCash")} value={expected} currency={store.currency} bold />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setCashDialog("in")}>
                {t("addCashIn")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCashDialog("out")}>
                {t("addCashOut")}
              </Button>
              <Button
                size="sm"
                className="ml-auto"
                onClick={() => setClosing(true)}
              >
                {t("closeShift")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {t("noOpenShift")}
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("shiftHistory")}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y px-4 py-1">
          {history.filter((entry) => entry.closed_at).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("noShifts")}
            </p>
          ) : (
            history
              .filter((entry) => entry.closed_at)
              .map((entry) => {
                const difference =
                  entry.actual_cash !== null && entry.expected_cash !== null
                    ? Number(entry.actual_cash) - Number(entry.expected_cash)
                    : null;
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-3 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {new Date(entry.opened_at).toLocaleDateString()}{" "}
                        {new Date(entry.opened_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {" – "}
                        {entry.closed_at
                          ? new Date(entry.closed_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("expectedCash")}:{" "}
                        {Number(entry.expected_cash ?? 0).toFixed(2)} ·{" "}
                        {t("actualCash")}:{" "}
                        {Number(entry.actual_cash ?? 0).toFixed(2)}
                        {entry.note ? ` · ${entry.note}` : ""}
                      </p>
                    </div>
                    {difference !== null ? (
                      <span
                        className={cn(
                          "text-sm font-bold",
                          difference === 0
                            ? "text-primary"
                            : "text-destructive",
                        )}
                      >
                        {difference > 0 ? "+" : ""}
                        {difference.toFixed(2)}
                      </span>
                    ) : null}
                  </div>
                );
              })
          )}
        </CardContent>
      </Card>

      {cashDialog && shift ? (
        <CashDialog
          shiftId={shift.id}
          direction={cashDialog}
          onClose={() => {
            setCashDialog(null);
            router.refresh();
          }}
        />
      ) : null}
      {closing && shift ? (
        <CloseShiftDialog
          shiftId={shift.id}
          expected={expected}
          currency={store.currency}
          onClose={() => {
            setClosing(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  currency,
  bold,
}: {
  label: string;
  value: number;
  currency: string;
  bold?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-sm", bold ? "text-base font-bold" : "font-medium")}>
        {value.toFixed(2)} {currency}
      </p>
    </div>
  );
}

function CashDialog({
  shiftId,
  direction,
  onClose,
}: {
  shiftId: string;
  direction: "in" | "out";
  onClose: () => void;
}) {
  const t = useTranslations("pos");
  const [amount, setAmount] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function submit() {
    const value = Number.parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError(t("invalidAmount"));
      return;
    }
    startTransition(async () => {
      const result = await recordCashMovement(shiftId, value, direction);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>
            {direction === "in" ? t("addCashIn") : t("addCashOut")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cash-amount">{t("amount")}</Label>
            <Input
              id="cash-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-12 text-lg"
              autoFocus
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="w-full" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CloseShiftDialog({
  shiftId,
  expected,
  currency,
  onClose,
}: {
  shiftId: string;
  expected: number;
  currency: string;
  onClose: () => void;
}) {
  const t = useTranslations("pos");
  const [actual, setActual] = React.useState(expected.toFixed(2));
  const [note, setNote] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const actualValue = Number.parseFloat(actual) || 0;
  const difference = Math.round((actualValue - expected) * 100) / 100;

  function submit() {
    startTransition(async () => {
      const result = await closeShift(shiftId, actualValue, expected, note);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("closeShiftTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm">
            {t("expectedCash")}:{" "}
            <span className="font-bold">
              {expected.toFixed(2)} {currency}
            </span>
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="actual-cash">{t("actualCash")}</Label>
            <Input
              id="actual-cash"
              type="number"
              min="0"
              step="0.01"
              value={actual}
              onChange={(event) => setActual(event.target.value)}
              className="h-12 text-lg"
            />
          </div>
          <p
            className={cn(
              "text-sm font-semibold",
              difference === 0 ? "text-primary" : "text-destructive",
            )}
          >
            {t("difference")}: {difference > 0 ? "+" : ""}
            {difference.toFixed(2)} {currency}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="close-note">{t("note")}</Label>
            <Input
              id="close-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={300}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="w-full" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("closeShift")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
