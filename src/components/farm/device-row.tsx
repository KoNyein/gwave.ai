"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Cpu,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteDevice, updateDevice } from "@/lib/actions/iot";
import { timeAgo } from "@/lib/format";
import type { Device } from "@/types/database";

export function DeviceRow({ device }: { device: Device }) {
  const t = useTranslations("farm");
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(device.name);
  const [zone, setZone] = React.useState(device.zone);
  const [pending, startTransition] = React.useTransition();

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
          <Cpu className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            {device.name}
            {device.online ? (
              <Wifi className="h-4 w-4 text-primary" />
            ) : (
              <WifiOff className="h-4 w-4 text-muted-foreground" />
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {t(`types.${device.type}`)} · {device.zone} ·{" "}
            <span className="font-mono">{device.topic}</span>
            {device.last_seen
              ? ` · ${t("lastSeen", { time: timeAgo(device.last_seen) })}`
              : ""}
          </p>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            disabled={pending}
            aria-label={t("manageDevice")}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-5 w-5" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => run(() => deleteDevice(device.id))}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editDevice")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`edit-name-${device.id}`}>
                {t("deviceName")}
              </Label>
              <Input
                id={`edit-name-${device.id}`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`edit-zone-${device.id}`}>{t("zone")}</Label>
              <Input
                id={`edit-zone-${device.id}`}
                value={zone}
                onChange={(event) => setZone(event.target.value)}
                maxLength={40}
              />
            </div>
            <Button
              className="w-full"
              disabled={pending || name.trim().length === 0}
              onClick={() => run(() => updateDevice(device.id, { name, zone }))}
            >
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
