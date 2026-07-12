"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Ban, Receipt, ScanFace } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { setGpayStatus, topupGpay } from "@/lib/actions/gpay";
import type { GpayAccount, GpayStatus } from "@/types/database";

const STATUS_STYLE: Record<GpayStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600",
  active: "bg-primary/10 text-primary",
  suspended: "bg-muted text-muted-foreground",
  rejected: "bg-destructive/10 text-destructive",
};

/** Admin review queue: approve/suspend/reject accounts and top them up. */
export function GpayAdminPanel({
  accounts,
  slipUrls,
  faceUrls,
}: {
  accounts: GpayAccount[];
  slipUrls: Record<string, string>;
  faceUrls: Record<string, string>;
}) {
  const t = useTranslations("gpay");
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function changeStatus(id: string, status: GpayStatus) {
    setBusyId(id);
    await setGpayStatus({ accountId: id, status });
    setBusyId(null);
    router.refresh();
  }

  async function topup(id: string, amount: number) {
    if (!amount || amount <= 0) return;
    setBusyId(id);
    await topupGpay({ accountId: id, amount });
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">
        {t("adminTitle")} ({accounts.length})
      </h2>
      {accounts.map((a) => (
        <Card key={a.id}>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{a.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t("nrc")}: {a.nrc_number}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {t("kpayNo")}: <span className="font-mono">{a.phone}</span> ·{" "}
                  {a.email}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.telegram ? `TG ${a.telegram}` : ""}
                  {a.telegram && a.viber ? " · " : ""}
                  {a.viber ? `Viber ${a.viber}` : ""}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  {slipUrls[a.id] ? (
                    <a
                      href={slipUrls[a.id]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Receipt className="h-3.5 w-3.5" /> {t("viewSlip")}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {t("noSlip")}
                    </span>
                  )}
                  {faceUrls[a.id] ? (
                    <a
                      href={faceUrls[a.id]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ScanFace className="h-3.5 w-3.5" /> {t("viewFace")}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {t("noFace")}
                    </span>
                  )}
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[a.status]}`}
              >
                {t(`status_${a.status}`)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t pt-2">
              {a.status !== "active" ? (
                <Button
                  size="sm"
                  disabled={busyId === a.id}
                  onClick={() => changeStatus(a.id, "active")}
                >
                  {busyId === a.id ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="mr-1 h-3.5 w-3.5" />
                  )}
                  {t("approve")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === a.id}
                  onClick={() => changeStatus(a.id, "suspended")}
                  className="text-destructive hover:text-destructive"
                >
                  <Ban className="mr-1 h-3.5 w-3.5" /> {t("suspend")}
                </Button>
              )}

              <TopupInline
                disabled={busyId === a.id}
                onTopup={(amt) => topup(a.id, amt)}
                label={t("topup")}
                balanceLabel={`${t("balance")}: ${a.balance}`}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TopupInline({
  disabled,
  onTopup,
  label,
  balanceLabel,
}: {
  disabled: boolean;
  onTopup: (amount: number) => void;
  label: string;
  balanceLabel: string;
}) {
  const [amount, setAmount] = React.useState("");
  return (
    <div className="ml-auto flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{balanceLabel}</span>
      <Input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        type="number"
        min="1"
        placeholder="0"
        className="h-8 w-24"
      />
      <Button
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          onTopup(Number(amount));
          setAmount("");
        }}
      >
        <Plus className="mr-1 h-3.5 w-3.5" /> {label}
      </Button>
    </div>
  );
}
