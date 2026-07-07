"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { metricLabel } from "@/components/farm/metrics";
import { Button } from "@/components/ui/button";
import {
  acknowledgeAlert,
  deleteRule,
  setRuleEnabled,
} from "@/lib/actions/iot";
import type { AlertWithDevice, RuleWithDevices } from "@/lib/db/iot";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const COMPARATOR_SYMBOLS: Record<string, string> = {
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
};

export function RuleRow({ rule }: { rule: RuleWithDevices }) {
  const t = useTranslations("farm");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  const action =
    rule.action_device && Object.keys(rule.action).length > 0
      ? t("ruleActionSummary", {
          device: rule.action_device.name,
          command: String((rule.action as { power?: string }).power ?? "on"),
        })
      : t("alertOnly");

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{rule.name}</p>
        <p className="text-xs text-muted-foreground">
          {t("if").toUpperCase()} {rule.trigger_device?.name ?? "?"} ·{" "}
          {metricLabel(rule.metric)}{" "}
          {COMPARATOR_SYMBOLS[rule.comparator] ?? rule.comparator}{" "}
          {Number(rule.threshold)} → {action}
          {rule.time_start && rule.time_end
            ? ` · ${rule.time_start.slice(0, 5)}–${rule.time_end.slice(0, 5)}`
            : ""}
          {rule.last_triggered_at
            ? ` · ${t("lastTriggered", { time: timeAgo(rule.last_triggered_at) })}`
            : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <button
              type="button"
              role="switch"
              aria-checked={rule.enabled}
              aria-label={t("ruleEnabled")}
              onClick={() => run(() => setRuleEnabled(rule.id, !rule.enabled))}
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                rule.enabled ? "bg-primary" : "bg-muted-foreground/30",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                  rule.enabled ? "left-[22px]" : "left-0.5",
                )}
              />
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
              onClick={() => run(() => deleteRule(rule.id))}
              aria-label={t("delete")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

const SEVERITY_STYLES: Record<string, string> = {
  info: "bg-secondary text-primary",
  warning: "bg-amber-100 text-amber-800",
  critical: "bg-red-100 text-red-700",
};

export function AlertRow({ alert }: { alert: AlertWithDevice }) {
  const t = useTranslations("farm");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 py-3",
        alert.acknowledged && "opacity-60",
      )}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
              SEVERITY_STYLES[alert.severity],
            )}
          >
            {t(`severities.${alert.severity}`)}
          </span>
          <span className="truncate font-medium">{alert.message}</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {alert.device?.name ?? "—"} · {timeAgo(alert.created_at)}
        </p>
      </div>
      {!alert.acknowledged ? (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await acknowledgeAlert(alert.id);
              router.refresh();
            })
          }
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            t("acknowledge")
          )}
        </Button>
      ) : null}
    </div>
  );
}
