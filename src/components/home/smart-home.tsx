"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Loader2,
  Play,
  Plus,
  Power,
  Trash2,
  Wand2,
  WifiOff,
} from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createScene,
  createSchedule,
  deleteScene,
  deleteSchedule,
  runScene,
  sendDeviceCommand,
} from "@/lib/actions/iot";
import type { SceneWithSchedules } from "@/lib/db/iot";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Device } from "@/types/database";

const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function isOn(device: Device): boolean {
  return (device.state as { power?: string }).power === "on";
}

export function SmartHome({
  initialSwitches,
  scenes,
  userId,
}: {
  initialSwitches: Device[];
  scenes: SceneWithSchedules[];
  userId: string;
}) {
  const t = useTranslations("home");
  const [switches, setSwitches] = React.useState(initialSwitches);
  // Devices with an optimistic (unconfirmed) toggle in flight.
  const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set());

  // Confirm optimistic toggles when the device echoes its state.
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`home:${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "devices" },
        (payload) => {
          const updated = payload.new as Device;
          setSwitches((previous) =>
            previous.map((device) =>
              device.id === updated.id ? { ...device, ...updated } : device,
            ),
          );
          setPendingIds((previous) => {
            if (!previous.has(updated.id)) return previous;
            const next = new Set(previous);
            next.delete(updated.id);
            return next;
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  async function toggle(device: Device) {
    const next = isOn(device) ? "off" : "on";
    // Optimistic flip; realtime state echo confirms (or corrects) it.
    setSwitches((previous) =>
      previous.map((entry) =>
        entry.id === device.id
          ? { ...entry, state: { ...entry.state, power: next } }
          : entry,
      ),
    );
    setPendingIds((previous) => new Set(previous).add(device.id));
    const result = await sendDeviceCommand(device.id, { power: next });
    if (!result.ok) {
      setSwitches((previous) =>
        previous.map((entry) =>
          entry.id === device.id ? device : entry,
        ),
      );
      setPendingIds((previous) => {
        const nextSet = new Set(previous);
        nextSet.delete(device.id);
        return nextSet;
      });
    }
  }

  const zones = [...new Set(switches.map((device) => device.zone))];

  return (
    <div className="space-y-6">
      {/* Switches */}
      {switches.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t("noSwitches")}
          </CardContent>
        </Card>
      ) : (
        zones.map((zone) => (
          <section key={zone}>
            <h2 className="mb-2 px-1 text-sm font-semibold uppercase text-muted-foreground">
              {zone}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {switches
                .filter((device) => device.zone === zone)
                .map((device) => {
                  const on = isOn(device);
                  const pending = pendingIds.has(device.id);
                  return (
                    <button
                      key={device.id}
                      type="button"
                      onClick={() => void toggle(device)}
                      disabled={pending}
                      className={cn(
                        "flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all",
                        on
                          ? "border-primary bg-secondary shadow-sm"
                          : "bg-background hover:bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-full",
                          on
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {pending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Power className="h-5 w-5" />
                        )}
                      </span>
                      <span>
                        <span className="flex items-center gap-1.5 text-sm font-semibold">
                          {device.name}
                          {!device.online ? (
                            <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : null}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {pending
                            ? t("waiting")
                            : on
                              ? t("on")
                              : t("off")}
                        </span>
                      </span>
                    </button>
                  );
                })}
            </div>
          </section>
        ))
      )}

      {/* Scenes */}
      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            {t("scenes")}
          </h2>
          <CreateSceneDialog switches={switches} />
        </div>
        {scenes.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              {t("noScenes")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {scenes.map((scene) => (
              <SceneCard key={scene.id} scene={scene} switches={switches} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SceneCard({
  scene,
  switches,
}: {
  scene: SceneWithSchedules;
  switches: Device[];
}) {
  const t = useTranslations("home");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [ran, setRan] = React.useState(false);

  function run(action: () => Promise<unknown>, markRan = false) {
    startTransition(async () => {
      await action();
      if (markRan) {
        setRan(true);
        setTimeout(() => setRan(false), 2000);
      } else {
        router.refresh();
      }
    });
  }

  const summary = scene.actions
    .map((action) => {
      const device = switches.find((entry) => entry.id === action.device_id);
      const power = (action.command as { power?: string }).power ?? "on";
      return device ? `${device.name} ${power}` : null;
    })
    .filter(Boolean)
    .join(" · ");

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wand2 className="h-4 w-4 text-primary" />
          {scene.name}
        </CardTitle>
        <div className="flex gap-1">
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => runScene(scene.id), true)}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : ran ? (
              t("ran")
            ) : (
              <>
                <Play className="mr-1 h-4 w-4" />
                {t("run")}
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
            disabled={pending}
            onClick={() => run(() => deleteScene(scene.id))}
            aria-label={t("deleteScene")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">{summary}</p>
        {scene.schedules.map((schedule) => (
          <div
            key={schedule.id}
            className="flex items-center justify-between rounded-lg bg-muted px-3 py-1.5 text-xs"
          >
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              {schedule.run_at.slice(0, 5)} ·{" "}
              {schedule.days_of_week
                .map((day) => DAY_LABELS[day - 1])
                .join(" ")}
            </span>
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => run(() => deleteSchedule(schedule.id))}
              aria-label={t("deleteSchedule")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <ScheduleDialog sceneId={scene.id} />
      </CardContent>
    </Card>
  );
}

function CreateSceneDialog({ switches }: { switches: Device[] }) {
  const t = useTranslations("home");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [selection, setSelection] = React.useState<
    Record<string, "on" | "off" | undefined>
  >({});
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function cycle(deviceId: string) {
    setSelection((previous) => {
      const current = previous[deviceId];
      const next =
        current === undefined ? "on" : current === "on" ? "off" : undefined;
      return { ...previous, [deviceId]: next };
    });
  }

  function submit() {
    const actions = Object.entries(selection)
      .filter(
        (entry): entry is [string, "on" | "off"] => entry[1] !== undefined,
      )
      .map(([deviceId, power]) => ({ deviceId, power }));
    if (actions.length === 0 || name.trim().length === 0) {
      setError(t("sceneInvalid"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createScene({ name, actions });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setName("");
      setSelection({});
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={switches.length === 0}>
          <Plus className="mr-1 h-4 w-4" />
          {t("createScene")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("createSceneTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="scene-name">{t("sceneName")}</Label>
            <Input
              id="scene-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              placeholder={t("sceneNamePlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("sceneDevices")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("sceneDevicesHint")}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {switches.map((device) => {
                const state = selection[device.id];
                return (
                  <button
                    key={device.id}
                    type="button"
                    onClick={() => cycle(device.id)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      state === "on" &&
                        "border-primary bg-secondary font-semibold text-primary",
                      state === "off" &&
                        "border-destructive/40 bg-destructive/10 font-semibold",
                      state === undefined && "hover:bg-muted",
                    )}
                  >
                    {device.name}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {state === undefined
                        ? t("notIncluded")
                        : state === "on"
                          ? t("on")
                          : t("off")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="w-full" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("createScene")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDialog({ sceneId }: { sceneId: string }) {
  const t = useTranslations("home");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [runAt, setRunAt] = React.useState("18:00");
  const [days, setDays] = React.useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function toggleDay(day: number) {
    setDays((previous) =>
      previous.includes(day)
        ? previous.filter((entry) => entry !== day)
        : [...previous, day].sort(),
    );
  }

  function submit() {
    if (days.length === 0) {
      setError(t("scheduleInvalid"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createSchedule({
        sceneId,
        runAt,
        daysOfWeek: days,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs">
          <Clock className="mr-1 h-3.5 w-3.5" />
          {t("addSchedule")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("addScheduleTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`schedule-time-${sceneId}`}>{t("runAt")}</Label>
            <Input
              id={`schedule-time-${sceneId}`}
              type="time"
              value={runAt}
              onChange={(event) => setRunAt(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("daysOfWeek")}</Label>
            <div className="flex gap-1">
              {DAY_LABELS.map((label, index) => {
                const day = index + 1;
                const active = days.includes(day);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={cn(
                      "h-9 flex-1 rounded-md border text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-secondary text-primary"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
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
