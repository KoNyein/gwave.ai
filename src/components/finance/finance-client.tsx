"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Repeat, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createExpense,
  deleteExpense,
  toggleExpensePaid,
} from "@/lib/actions/finance";
import type { MonthlyTotals } from "@/lib/db/finance";
import type { BusinessExpense, ExpenseCategory } from "@/types/database";

const CATEGORIES: ExpenseCategory[] = [
  "salary",
  "rent",
  "utility",
  "tax",
  "other",
];

const CATEGORY_EMOJI: Record<ExpenseCategory, string> = {
  salary: "👷",
  rent: "🏬",
  utility: "💡",
  tax: "🧾",
  other: "📦",
};

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
}

export function FinanceClient({
  expenses,
  totals,
}: {
  expenses: BusinessExpense[];
  totals: MonthlyTotals;
}) {
  const t = useTranslations("finance");
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const res = await createExpense({
      category: String(fd.get("category")) as ExpenseCategory,
      title: String(fd.get("title") ?? ""),
      amount: Number(fd.get("amount")),
      dueDate: String(fd.get("dueDate") ?? ""),
      recurring: fd.get("recurring") === "on",
      note: String(fd.get("note") ?? ""),
    });
    setPending(false);
    if (!res.ok) return setError(res.error);
    setShowForm(false);
    router.refresh();
  }

  async function togglePaid(exp: BusinessExpense) {
    setBusyId(exp.id);
    await toggleExpensePaid({ id: exp.id, isPaid: !exp.is_paid });
    setBusyId(null);
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    setBusyId(id);
    await deleteExpense(id);
    setBusyId(null);
    router.refresh();
  }

  const unpaid = expenses.filter((e) => !e.is_paid);
  const paid = expenses.filter((e) => e.is_paid);

  return (
    <div className="space-y-5">
      {/* This month summary */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-semibold">{t("thisMonth")}</p>
          <p className="mt-1 text-2xl font-bold">
            {fmt(totals.total)}{" "}
            <span className="text-base font-medium text-muted-foreground">
              MMK
            </span>
          </p>
          {totals.unpaidTotal > 0 ? (
            <p className="text-xs text-destructive">
              {t("unpaidTotal", { amount: fmt(totals.unpaidTotal) })}
            </p>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {CATEGORIES.map((c) => (
              <div key={c} className="rounded-lg border p-2 text-center">
                <div className="text-lg" aria-hidden>
                  {CATEGORY_EMOJI[c]}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t(`cat_${c}`)}
                </p>
                <p className="text-sm font-semibold">
                  {fmt(totals.byCategory[c])}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add expense */}
      {showForm ? (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={onAdd} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="category">{t("category")}</Label>
                <select
                  id="category"
                  name="category"
                  defaultValue="other"
                  className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_EMOJI[c]} {t(`cat_${c}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="title">{t("titleLabel")}</Label>
                <Input id="title" name="title" required maxLength={160} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="amount">{t("amount")} (MMK)</Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dueDate">{t("dueDate")}</Label>
                  <Input id="dueDate" name="dueDate" type="date" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="recurring" className="h-4 w-4" />
                <Repeat className="h-4 w-4 text-muted-foreground" />
                {t("recurring")}
              </label>
              <Input name="note" placeholder={t("noteOptional")} maxLength={500} />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex gap-2">
                <Button type="submit" disabled={pending} className="flex-1">
                  {pending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : null}
                  {t("save")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowForm(false)}
                >
                  {t("cancel")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setShowForm(true)} className="w-full">
          <Plus className="mr-1 h-4 w-4" /> {t("addExpense")}
        </Button>
      )}

      {/* Unpaid */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {t("unpaid")} ({unpaid.length})
        </h2>
        {unpaid.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("allPaid")}</p>
        ) : (
          unpaid.map((e) => (
            <ExpenseRow
              key={e.id}
              exp={e}
              busy={busyId === e.id}
              label={t(`cat_${e.category}`)}
              emoji={CATEGORY_EMOJI[e.category]}
              onToggle={() => togglePaid(e)}
              onDelete={() => remove(e.id)}
              paidLabel={t("markPaid")}
            />
          ))
        )}
      </section>

      {/* Paid */}
      {paid.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t("paid")} ({paid.length})
          </h2>
          {paid.map((e) => (
            <ExpenseRow
              key={e.id}
              exp={e}
              busy={busyId === e.id}
              label={t(`cat_${e.category}`)}
              emoji={CATEGORY_EMOJI[e.category]}
              onToggle={() => togglePaid(e)}
              onDelete={() => remove(e.id)}
              paidLabel={t("markUnpaid")}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function ExpenseRow({
  exp,
  busy,
  label,
  emoji,
  onToggle,
  onDelete,
  paidLabel,
}: {
  exp: BusinessExpense;
  busy: boolean;
  label: string;
  emoji: string;
  onToggle: () => void;
  onDelete: () => void;
  paidLabel: string;
}) {
  return (
    <Card className={exp.is_paid ? "opacity-70" : undefined}>
      <CardContent className="flex items-center gap-3 p-3">
        <span className="text-xl" aria-hidden>
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {exp.title}
            {exp.recurring ? (
              <Repeat className="ml-1 inline h-3 w-3 text-muted-foreground" />
            ) : null}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {label}
            {exp.due_date ? ` · ${new Date(exp.due_date).toLocaleDateString()}` : ""}
            {exp.note ? ` · ${exp.note}` : ""}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold">{fmt(exp.amount)}</span>
        <Button
          size="icon"
          variant={exp.is_paid ? "ghost" : "outline"}
          className="h-8 w-8"
          onClick={onToggle}
          disabled={busy}
          title={paidLabel}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className={`h-4 w-4 ${exp.is_paid ? "text-primary" : ""}`} />
          )}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={onDelete}
          disabled={busy}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
