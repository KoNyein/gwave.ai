"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { METRICS } from "@/components/farm/metrics";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRule } from "@/lib/actions/iot";
import type { Device } from "@/types/database";

export function RuleBuilder({ devices }: { devices: Device[] }) {
  const t = useTranslations("farm");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [triggerDeviceId, setTriggerDeviceId] = React.useState("");
  const [metric, setMetric] = React.useState("air_temp");
  const [comparator, setComparator] = React.useState<"gt" | "lt">("gt");
  const [threshold, setThreshold] = React.useState("32");
  const [actionDeviceId, setActionDeviceId] = React.useState("");
  const [actionCommand, setActionCommand] = React.useState<"on" | "off">("on");
  const [timeStart, setTimeStart] = React.useState("");
  const [timeEnd, setTimeEnd] = React.useState("");
  const [severity, setSeverity] = React.useState<
    "info" | "warning" | "critical"
  >("warning");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const sensors = devices.filter(
    (device) => device.type === "sensor" || device.type === "controller",
  );
  const switches = devices.filter((device) => device.type === "switch");

  async function handleSubmit() {
    const thresholdValue = Number.parseFloat(threshold);
    if (!triggerDeviceId || !Number.isFinite(thresholdValue)) {
      setError(t("ruleInvalid"));
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await createRule({
      name: name.trim() || `${METRICS[metric]?.label ?? metric} rule`,
      triggerDeviceId,
      metric,
      comparator,
      threshold: thresholdValue,
      actionDeviceId: actionDeviceId || null,
      actionCommand: actionDeviceId ? actionCommand : null,
      timeStart: timeStart || null,
      timeEnd: timeEnd || null,
      severity,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={sensors.length === 0}>
          <Plus className="mr-2 h-4 w-4" />
          {t("createRule")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("createRuleTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rule-name">{t("ruleName")}</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              placeholder={t("ruleNamePlaceholder")}
            />
          </div>

          {/* IF */}
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-xs font-bold uppercase text-primary">
              {t("if")}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={triggerDeviceId}
                onChange={(event) => setTriggerDeviceId(event.target.value)}
                className="h-10 rounded-md border bg-background px-2 text-sm"
                aria-label={t("triggerDevice")}
              >
                <option value="">{t("selectDevice")}</option>
                {sensors.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
              </select>
              <select
                value={metric}
                onChange={(event) => setMetric(event.target.value)}
                className="h-10 rounded-md border bg-background px-2 text-sm"
                aria-label={t("metric")}
              >
                {Object.entries(METRICS).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
              <select
                value={comparator}
                onChange={(event) =>
                  setComparator(event.target.value as "gt" | "lt")
                }
                className="h-10 rounded-md border bg-background px-2 text-sm"
                aria-label={t("comparator")}
              >
                <option value="gt">{t("isAbove")}</option>
                <option value="lt">{t("isBelow")}</option>
              </select>
              <Input
                type="number"
                step="any"
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
                aria-label={t("threshold")}
              />
            </div>
          </div>

          {/* THEN */}
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-xs font-bold uppercase text-primary">
              {t("then")}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={actionDeviceId}
                onChange={(event) => setActionDeviceId(event.target.value)}
                className="h-10 rounded-md border bg-background px-2 text-sm"
                aria-label={t("actionDevice")}
              >
                <option value="">{t("alertOnly")}</option>
                {switches.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
              </select>
              <select
                value={actionCommand}
                onChange={(event) =>
                  setActionCommand(event.target.value as "on" | "off")
                }
                disabled={!actionDeviceId}
                className="h-10 rounded-md border bg-background px-2 text-sm disabled:opacity-50"
                aria-label={t("actionCommand")}
              >
                <option value="on">{t("turnOn")}</option>
                <option value="off">{t("turnOff")}</option>
              </select>
            </div>
          </div>

          {/* Options */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="rule-start">{t("windowStart")}</Label>
              <Input
                id="rule-start"
                type="time"
                value={timeStart}
                onChange={(event) => setTimeStart(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-end">{t("windowEnd")}</Label>
              <Input
                id="rule-end"
                type="time"
                value={timeEnd}
                onChange={(event) => setTimeEnd(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-severity">{t("severity")}</Label>
              <select
                id="rule-severity"
                value={severity}
                onChange={(event) =>
                  setSeverity(
                    event.target.value as "info" | "warning" | "critical",
                  )
                }
                className="h-10 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="info">{t("severities.info")}</option>
                <option value="warning">{t("severities.warning")}</option>
                <option value="critical">{t("severities.critical")}</option>
              </select>
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t("createRule")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
