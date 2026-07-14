"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Bluetooth,
  Loader2,
  MapPin,
  Nfc,
  Plus,
  Radio,
  Tag,
  Trash2,
  Wifi,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createTracker,
  deleteTracker,
  updateTrackerLocation,
} from "@/lib/actions/trackers";
import type { Tracker, TrackerType } from "@/lib/db/trackers";

// Minimal shapes for the Web Bluetooth / Web NFC APIs (not in the DOM lib).
interface BluetoothLike {
  requestDevice(options: {
    acceptAllDevices?: boolean;
    optionalServices?: string[];
  }): Promise<{ name?: string; id?: string }>;
}
interface NdefReaderLike {
  scan(): Promise<void>;
  addEventListener(
    type: "reading",
    cb: (event: { serialNumber?: string }) => void,
  ): void;
}
type NdefCtor = new () => NdefReaderLike;

const TYPES: {
  value: TrackerType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "bluetooth", label: "Bluetooth GPS", icon: Bluetooth },
  { value: "wifi", label: "Wi-Fi GPS", icon: Wifi },
  { value: "nfc", label: "NFC tag", icon: Nfc },
  { value: "airtag", label: "AirTag", icon: Tag },
  { value: "other", label: "အခြား", icon: Radio },
];

function iconFor(type: TrackerType) {
  return TYPES.find((t) => t.value === type)?.icon ?? Radio;
}

export function TrackersManager({ trackers }: { trackers: Tracker[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<TrackerType>("bluetooth");
  const [identifier, setIdentifier] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [hint, setHint] = React.useState<string | null>(null);

  // Attach via Web Bluetooth — pick a nearby BLE device and prefill it.
  async function scanBluetooth() {
    setError(null);
    const bt = (navigator as unknown as { bluetooth?: BluetoothLike }).bluetooth;
    if (!bt) {
      setError("ဒီ browser မှာ Bluetooth မရနိုင်ပါ (Android Chrome သုံးပါ)။");
      return;
    }
    try {
      const device = await bt.requestDevice({ acceptAllDevices: true });
      setType("bluetooth");
      if (device.name && !name) setName(device.name);
      if (device.id) setIdentifier(device.id);
      setHint("Bluetooth device တွေ့ပြီ — အမည်ပေးပြီး သိမ်းပါ။");
    } catch {
      /* user cancelled the chooser */
    }
  }

  // Attach via Web NFC — tap a tag to read its serial.
  async function scanNfc() {
    setError(null);
    const Ctor = (window as unknown as { NDEFReader?: NdefCtor }).NDEFReader;
    if (!Ctor) {
      setError("ဒီ browser မှာ NFC မရနိုင်ပါ (Android Chrome သုံးပါ)။");
      return;
    }
    try {
      const reader = new Ctor();
      await reader.scan();
      setHint("NFC tag ကို ဖုန်းနဲ့ ထိပါ…");
      reader.addEventListener("reading", (event) => {
        setType("nfc");
        if (event.serialNumber) setIdentifier(event.serialNumber);
        setHint("NFC tag ဖတ်ပြီး — အမည်ပေးပြီး သိမ်းပါ။");
      });
    } catch {
      setError("NFC scan မအောင်မြင်ပါ။");
    }
  }

  async function save() {
    setError(null);
    setBusy("save");
    const res = await createTracker({ name, type, identifier: identifier || undefined });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setName("");
    setIdentifier("");
    setHint(null);
    setOpen(false);
    router.refresh();
  }

  // "Locate here" — stamp the tracker with the phone's current position.
  function locate(tracker: Tracker) {
    setBusy(tracker.id);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await updateTrackerLocation({
          id: tracker.id,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setBusy(null);
        router.refresh();
      },
      () => {
        setBusy(null);
        setError("တည်နေရာ မရနိုင်ပါ (location ခွင့်ပြုချက် စစ်ပါ)။");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function remove(id: string) {
    setBusy(id);
    await deleteTracker(id);
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Trackers ({trackers.length})
        </h2>
        {!open ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Tracker ထည့်
          </Button>
        ) : null}
      </div>

      {open ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {TYPES.map((tp) => (
                <button
                  key={tp.value}
                  type="button"
                  onClick={() => setType(tp.value)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-xs transition-colors ${
                    type === tp.value
                      ? "border-primary bg-primary/5 font-medium text-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  <tp.icon className="h-4 w-4" />
                  {tp.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void scanBluetooth()}>
                <Bluetooth className="mr-1 h-4 w-4" /> Bluetooth ရှာ
              </Button>
              <Button size="sm" variant="outline" onClick={() => void scanNfc()}>
                <Nfc className="mr-1 h-4 w-4" /> NFC ဖတ်
              </Button>
            </div>

            <div className="space-y-1">
              <Label htmlFor="tr-name">အမည်</Label>
              <Input
                id="tr-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ဥပမာ — ကား key, ခွေး, အိတ်"
                maxLength={80}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tr-id">Identifier (optional)</Label>
              <Input
                id="tr-id"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="BLE id / NFC serial / AirTag label"
                maxLength={200}
              />
            </div>

            {hint ? <p className="text-xs text-primary">{hint}</p> : null}
            {error ? <p className="text-xs text-destructive">{error}</p> : null}

            <div className="flex gap-2">
              <Button size="sm" onClick={() => void save()} disabled={busy === "save" || !name.trim()}>
                {busy === "save" ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1 h-4 w-4" />
                )}
                သိမ်း
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                ပယ်ဖျက်
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {trackers.length === 0 && !open ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Tracker မရှိသေးပါ။ Bluetooth GPS / Wi-Fi / NFC / AirTag တစ်ခု ထည့်ကြည့်ပါ။
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {trackers.map((tracker) => {
            const Icon = iconFor(tracker.type);
            const hasLoc = tracker.latitude != null && tracker.longitude != null;
            return (
              <Card key={tracker.id}>
                <CardContent className="flex items-start gap-3 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{tracker.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {tracker.type}
                      {tracker.battery != null ? ` · 🔋 ${tracker.battery}%` : ""}
                      {tracker.last_seen
                        ? ` · ${new Date(tracker.last_seen).toLocaleString()}`
                        : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => locate(tracker)}
                        disabled={busy === tracker.id}
                      >
                        {busy === tracker.id ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <MapPin className="mr-1 h-3.5 w-3.5" />
                        )}
                        ဒီနေရာ မှတ်
                      </Button>
                      {hasLoc ? (
                        <a
                          href={`https://www.google.com/maps?q=${tracker.latitude},${tracker.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted"
                        >
                          မြေပုံ
                        </a>
                      ) : null}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => void remove(tracker.id)}
                        disabled={busy === tracker.id}
                        aria-label="delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
