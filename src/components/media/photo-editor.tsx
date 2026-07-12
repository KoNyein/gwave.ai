"use client";

import * as React from "react";
import { Loader2, RotateCw, Wand2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A named look = base slider values + extra effects, all optional. */
interface Preset {
  key: string;
  label: string;
  brightness?: number;
  contrast?: number;
  saturate?: number;
  sepia?: number;
  grayscale?: number;
  hue?: number;
}

const PRESETS: Preset[] = [
  { key: "original", label: "မူရင်း" },
  { key: "vivid", label: "ရဲရင့်", brightness: 1.05, contrast: 1.2, saturate: 1.5 },
  { key: "warm", label: "နွေးထွေး", brightness: 1.05, saturate: 1.2, sepia: 0.25, hue: -8 },
  { key: "cool", label: "အေးမြ", contrast: 1.05, saturate: 1.1, hue: 12 },
  { key: "bw", label: "အဖြူအမည်း", grayscale: 1, contrast: 1.1 },
  { key: "sepia", label: "ရှေးဆန်", sepia: 0.7, brightness: 1.05 },
  { key: "vintage", label: "ဟိုးရှေး", sepia: 0.4, contrast: 0.9, saturate: 0.8, brightness: 1.05 },
];

interface Adjust {
  brightness: number;
  contrast: number;
  saturate: number;
  sepia: number;
  grayscale: number;
  hue: number;
}

const NEUTRAL: Adjust = {
  brightness: 1,
  contrast: 1,
  saturate: 1,
  sepia: 0,
  grayscale: 0,
  hue: 0,
};

function filterString(a: Adjust): string {
  return [
    `brightness(${a.brightness})`,
    `contrast(${a.contrast})`,
    `saturate(${a.saturate})`,
    `sepia(${a.sepia})`,
    `grayscale(${a.grayscale})`,
    `hue-rotate(${a.hue}deg)`,
  ].join(" ");
}

/**
 * Pre-upload photo editor: pick a filter/look, fine-tune brightness / contrast
 * / warmth, and rotate — then the edits are baked into a new JPEG that replaces
 * the original before it is uploaded. Runs entirely on-device (canvas), so
 * nothing leaves the phone until the member posts.
 */
export function PhotoEditor({
  file,
  onDone,
  onCancel,
}: {
  file: File;
  onDone: (edited: File) => void;
  onCancel: () => void;
}) {
  const [src, setSrc] = React.useState<string | null>(null);
  const [adjust, setAdjust] = React.useState<Adjust>(NEUTRAL);
  const [activePreset, setActivePreset] = React.useState("original");
  const [rotation, setRotation] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  React.useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function applyPreset(p: Preset) {
    setActivePreset(p.key);
    setAdjust({
      brightness: p.brightness ?? 1,
      contrast: p.contrast ?? 1,
      saturate: p.saturate ?? 1,
      sepia: p.sepia ?? 0,
      grayscale: p.grayscale ?? 0,
      hue: p.hue ?? 0,
    });
  }

  function setField(key: keyof Adjust, value: number) {
    setAdjust((prev) => ({ ...prev, [key]: value }));
  }

  async function apply() {
    const img = imgRef.current;
    if (!img || saving) return;
    setSaving(true);
    try {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const rotated = rotation % 180 !== 0;
      const canvas = document.createElement("canvas");
      canvas.width = rotated ? h : w;
      canvas.height = rotated ? w : h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas unsupported");
      ctx.filter = filterString(adjust);
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/jpeg", 0.9),
      );
      if (!blob) throw new Error("export failed");
      const name = file.name.replace(/\.[^.]+$/, "") + "-edited.jpg";
      onDone(new File([blob], name, { type: "image/jpeg" }));
    } catch {
      // On any failure fall back to the original, unedited file.
      onDone(file);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/90">
      <div className="flex items-center justify-between p-3 text-white">
        <button type="button" onClick={onCancel} aria-label="ပိတ်">
          <X className="h-6 w-6" />
        </button>
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Wand2 className="h-4 w-4" /> ဓာတ်ပုံ တည်းဖြတ်
        </span>
        <Button size="sm" onClick={apply} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "ပြီး"}
        </Button>
      </div>

      {/* Live preview */}
      <div className="flex flex-1 items-center justify-center overflow-hidden p-3">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={src}
            alt="edit preview"
            className="max-h-full max-w-full object-contain transition-[filter,transform]"
            style={{
              filter: filterString(adjust),
              transform: `rotate(${rotation}deg)`,
            }}
          />
        ) : null}
      </div>

      {/* Controls */}
      <div className="space-y-3 bg-card p-3">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
                  activePreset === p.key
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="shrink-0 rounded-full border p-2 hover:bg-muted"
            aria-label="လှည့်ရန်"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>

        <Slider label="အလင်း" min={0.5} max={1.5} value={adjust.brightness}
          onChange={(v) => setField("brightness", v)} />
        <Slider label="ကွာခြား" min={0.5} max={1.5} value={adjust.contrast}
          onChange={(v) => setField("contrast", v)} />
        <Slider label="အရောင်ရင့်" min={0} max={2} value={adjust.saturate}
          onChange={(v) => setField("saturate", v)} />
      </div>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-xs">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 flex-1 accent-primary"
      />
    </label>
  );
}
