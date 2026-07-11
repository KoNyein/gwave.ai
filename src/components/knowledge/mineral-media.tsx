"use client";

import * as React from "react";
import { Play, Volume2, VolumeX, Youtube } from "lucide-react";
import { useLocale } from "next-intl";

import { isTtsSupported, speak } from "@/lib/learn/speech";

/**
 * HTML5 / CSS / JavaScript media panel for a mineral or metal:
 *  • a Canvas-drawn faceted specimen coloured from the mineral's own data
 *    (or its real photo when one is on file),
 *  • an interactive Mohs hardness scale,
 *  • a Web-Speech "read aloud" button (localized to the site language), and
 *  • a click-to-load embedded YouTube player (privacy-enhanced domain).
 *
 * Everything renders from the data already on the mineral record — no
 * per-mineral asset files needed — so all ~100 minerals get rich media.
 */

const LANG: Record<string, string> = {
  my: "my-MM",
  en: "en-US",
  th: "th-TH",
  zh: "zh-CN",
};

// Common colour words (English + a few Burmese) → hex, for the Canvas gem.
const COLOR_WORDS: [RegExp, string][] = [
  [/gold|golden|အဝါရောင်ရွှေ/, "#f5b301"],
  [/yellow|ဝါ/, "#facc15"],
  [/red|ruby|crimson|နီ/, "#dc2626"],
  [/pink|rose|ပန်း/, "#ec4899"],
  [/orange|လိမ္မော်/, "#f97316"],
  [/green|emerald|စိမ်း/, "#16a34a"],
  [/blue|sapphire|azure|ပြာ/, "#2563eb"],
  [/violet|purple|amethyst|ခရမ်း/, "#7c3aed"],
  [/brown|bronze|ညို/, "#92400e"],
  [/black|dark|မည်း/, "#1f2937"],
  [/white|colourless|colorless|clear|ဖြူ/, "#e5e7eb"],
  [/grey|gray|silver|မီးခိုး|ငွေ/, "#9ca3af"],
  [/copper/, "#b45309"],
];

const CATEGORY_COLOR: Record<string, string> = {
  metal: "#9ca3af",
  "native element": "#cbd5e1",
  oxide: "#b45309",
  silicate: "#0ea5e9",
  carbonate: "#14b8a6",
  sulfide: "#eab308",
  sulfate: "#a3e635",
  halide: "#c084fc",
  "gemstone": "#e11d48",
};

function pickColor(colorText: string | undefined, category: string): string {
  const hay = (colorText ?? "").toLowerCase();
  for (const [re, hex] of COLOR_WORDS) if (re.test(hay)) return hex;
  const cat = category.toLowerCase();
  for (const key of Object.keys(CATEGORY_COLOR)) {
    if (cat.includes(key)) return CATEGORY_COLOR[key]!;
  }
  return "#64748b";
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp(((n >> 16) & 0xff) + amount);
  const g = clamp(((n >> 8) & 0xff) + amount);
  const b = clamp((n & 0xff) + amount);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Reference points on the Mohs scale (1–10) for context. */
const MOHS_REF = [
  { h: 1, label: "Talc" },
  { h: 3, label: "Calcite" },
  { h: 5, label: "Apatite" },
  { h: 7, label: "Quartz" },
  { h: 10, label: "Diamond" },
];

interface Props {
  name: string;
  category: string;
  description: string | null;
  hardnessMohs: number | null;
  colorText?: string;
  imageUrl: string | null;
  youtubeQuery: string | null;
}

export function MineralMedia({
  name,
  category,
  description,
  hardnessMohs,
  colorText,
  imageUrl,
  youtubeQuery,
}: Props) {
  const locale = useLocale();
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [speaking, setSpeaking] = React.useState(false);
  const [videoLoaded, setVideoLoaded] = React.useState(false);
  const base = React.useMemo(
    () => pickColor(colorText, category),
    [colorText, category],
  );

  // Draw a faceted gem specimen on the canvas from the mineral's colour.
  React.useEffect(() => {
    if (imageUrl) return; // real photo takes over — skip the generated one
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2 + 6;
    const r = Math.min(w, h) * 0.32;

    // Table (flat top) + crown facets of a cut gem.
    const top = cy - r;
    const tableHalf = r * 0.5;
    const girdleY = cy - r * 0.25;
    const bottom = cy + r * 1.05;

    const facets: [number, number][][] = [
      [[cx - tableHalf, top], [cx + tableHalf, top], [cx + r, girdleY], [cx - r, girdleY]],
      [[cx - tableHalf, top], [cx - r, girdleY], [cx, cy], [cx, top]],
      [[cx + tableHalf, top], [cx + r, girdleY], [cx, cy], [cx, top]],
      [[cx - r, girdleY], [cx, cy], [cx, bottom]],
      [[cx + r, girdleY], [cx, cy], [cx, bottom]],
    ];
    const shades = [40, 10, 55, -30, -5];

    facets.forEach((pts, i) => {
      ctx.beginPath();
      const first = pts[0]!;
      ctx.moveTo(first[0], first[1]);
      for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
      ctx.closePath();
      ctx.fillStyle = shade(base, shades[i] ?? 0);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Sparkle highlight.
    ctx.beginPath();
    ctx.arc(cx - tableHalf * 0.4, top + r * 0.28, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fill();
  }, [base, imageUrl, name]);

  function toggleSpeak() {
    if (!isTtsSupported()) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const lang = LANG[locale] ?? "en-US";
    const parts = [name, category, description ?? ""].filter(Boolean);
    speak(parts.join(". "), lang);
    setSpeaking(true);
    // Speech has no reliable end event across browsers; poll to reset.
    const timer = window.setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        setSpeaking(false);
        window.clearInterval(timer);
      }
    }, 400);
  }

  React.useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const embedSrc = youtubeQuery
    ? `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(
        `${name} ${youtubeQuery}`,
      )}`
    : null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {/* Photo / generated specimen + audio */}
      <div className="flex flex-col gap-2 rounded-xl border p-3">
        <p className="text-sm font-medium text-muted-foreground">📸 ရုပ်ပုံ</p>
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-b from-muted/60 to-muted">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={name}
              className="h-40 w-full object-cover"
              loading="lazy"
            />
          ) : (
            <canvas
              ref={canvasRef}
              className="h-40 w-full"
              role="img"
              aria-label={`${name} — generated specimen`}
            />
          )}
        </div>
        <button
          type="button"
          onClick={toggleSpeak}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted"
        >
          {speaking ? (
            <>
              <VolumeX className="h-4 w-4" /> ရပ်မည်
            </>
          ) : (
            <>
              <Volume2 className="h-4 w-4" /> 🔊 အသံဖြင့် နားထောင်ရန်
            </>
          )}
        </button>
      </div>

      {/* Hardness scale + video */}
      <div className="flex flex-col gap-3 rounded-xl border p-3">
        {hardnessMohs != null ? (
          <div>
            <p className="mb-1.5 text-sm font-medium text-muted-foreground">
              ⛏ Mohs မာကျော်မှု — <span className="text-foreground">{hardnessMohs}</span>/10
            </p>
            <div className="relative h-3 w-full rounded-full bg-gradient-to-r from-emerald-300 via-amber-300 to-rose-400">
              <div
                className="absolute top-1/2 h-5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow"
                style={{ left: `${(Math.min(Math.max(hardnessMohs, 1), 10) / 10) * 100}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              {MOHS_REF.map((m) => (
                <span key={m.h}>{m.h}</span>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              1 = {MOHS_REF[0]!.label} (ပျော့) · 7 = Quartz · 10 = Diamond (မာဆုံး)
            </p>
          </div>
        ) : null}

        {embedSrc ? (
          <div className="mt-auto">
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Youtube className="h-4 w-4 text-red-600" /> ဗီဒီယို
            </p>
            <div className="aspect-video w-full overflow-hidden rounded-lg border bg-black">
              {videoLoaded ? (
                <iframe
                  src={embedSrc}
                  title={`${name} video`}
                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setVideoLoaded(true)}
                  className="group flex h-full w-full flex-col items-center justify-center gap-2 text-white/90 transition-colors hover:bg-black/80"
                  aria-label={`${name} ဗီဒီယို ဖွင့်ရန်`}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 transition-transform group-hover:scale-110">
                    <Play className="h-6 w-6 translate-x-0.5" fill="currentColor" />
                  </span>
                  <span className="text-xs">ဗီဒီယို ကြည့်ရန် နှိပ်ပါ</span>
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
