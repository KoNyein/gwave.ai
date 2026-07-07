"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

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
import {
  registerDevice,
  type DeviceCredentials,
} from "@/lib/actions/iot";
import { cn } from "@/lib/utils";
import type { DeviceType } from "@/types/database";

const TYPES: DeviceType[] = ["sensor", "switch", "controller", "camera"];

export function RegisterDeviceDialog() {
  const t = useTranslations("farm");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<DeviceType>("sensor");
  const [zone, setZone] = React.useState("default");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [credentials, setCredentials] =
    React.useState<DeviceCredentials | null>(null);
  const [copied, setCopied] = React.useState(false);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setName("");
      setType("sensor");
      setZone("default");
      setError(null);
      setCredentials(null);
      setCopied(false);
      router.refresh();
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const result = await registerDevice({ name, type, zone });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCredentials(result.data);
  }

  async function copyCredentials() {
    if (!credentials) return;
    await navigator.clipboard.writeText(
      JSON.stringify(
        {
          id: credentials.deviceId,
          topic: credentials.topic,
          secret: credentials.secret,
        },
        null,
        2,
      ),
    );
    setCopied(true);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t("registerDevice")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {credentials ? t("credentialsTitle") : t("registerTitle")}
          </DialogTitle>
        </DialogHeader>

        {credentials ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("credentialsHint")}
            </p>
            <div className="space-y-2 rounded-lg bg-muted p-4 font-mono text-xs">
              <p>
                <span className="text-muted-foreground">device_id: </span>
                {credentials.deviceId}
              </p>
              <p>
                <span className="text-muted-foreground">topic: </span>
                {credentials.topic}
              </p>
              <p className="break-all">
                <span className="text-muted-foreground">secret: </span>
                {credentials.secret}
              </p>
            </div>
            <p className="rounded-lg bg-secondary p-3 text-xs text-primary">
              {t("credentialsTopics", { topic: credentials.topic })}
            </p>
            <Button className="w-full" variant="outline" onClick={copyCredentials}>
              {copied ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {copied ? t("copied") : t("copyCredentials")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="device-name">{t("deviceName")}</Label>
              <Input
                id="device-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                placeholder={t("deviceNamePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("deviceType")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {TYPES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setType(option)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm capitalize transition-colors",
                      type === option
                        ? "border-primary bg-secondary font-semibold text-primary"
                        : "hover:bg-muted",
                    )}
                  >
                    {t(`types.${option}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="device-zone">{t("zone")}</Label>
              <Input
                id="device-zone"
                value={zone}
                onChange={(event) => setZone(event.target.value)}
                maxLength={40}
                placeholder="greenhouse-1"
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={submitting || name.trim().length === 0}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("register")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
