"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Download, FileCode } from "lucide-react";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  isValidPromptPayTarget,
  promptPayPayload,
  vcardPayload,
  wifiPayload,
  type WifiSecurity,
} from "@/lib/tools/qr-payloads";

type ErrorLevel = "L" | "M" | "Q" | "H";

type Mode = "text" | "wifi" | "vcard" | "promptpay";

const MODES: { value: Mode; label: string }[] = [
  { value: "text", label: "Text / URL" },
  { value: "wifi", label: "Wi-Fi" },
  { value: "vcard", label: "Contact (vCard)" },
  { value: "promptpay", label: "PromptPay" },
];

const SIZES = [256, 512, 1024] as const;
const LEVELS: { value: ErrorLevel; label: string }[] = [
  { value: "L", label: "L — smallest" },
  { value: "M", label: "M — default" },
  { value: "Q", label: "Q — robust" },
  { value: "H", label: "H — max (logo-safe)" },
];

export function QrGenerator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("https://gwave.ai");
  // Wi-Fi fields
  const [ssid, setSsid] = useState("");
  const [wifiPass, setWifiPass] = useState("");
  const [security, setSecurity] = useState<WifiSecurity>("WPA");
  const [hidden, setHidden] = useState(false);
  // vCard fields
  const [vc, setVc] = useState({
    fullName: "",
    org: "",
    title: "",
    phone: "",
    email: "",
    website: "",
  });
  // PromptPay fields
  const [ppTarget, setPpTarget] = useState("");
  const [ppAmount, setPpAmount] = useState("");
  const [size, setSize] = useState<number>(512);
  const [level, setLevel] = useState<ErrorLevel>("M");
  const [dark, setDark] = useState("#173404");
  const [light, setLight] = useState("#ffffff");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payload = (() => {
    switch (mode) {
      case "wifi":
        return ssid.trim()
          ? wifiPayload({ ssid, password: wifiPass, security, hidden })
          : "";
      case "vcard":
        return vc.fullName.trim() ? vcardPayload(vc) : "";
      case "promptpay": {
        if (!isValidPromptPayTarget(ppTarget)) return "";
        const amount = parseFloat(ppAmount);
        try {
          return promptPayPayload(
            ppTarget,
            Number.isFinite(amount) ? amount : undefined,
          );
        } catch {
          return "";
        }
      }
      default:
        return text;
    }
  })();

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!payload.trim()) {
      canvas
        .getContext("2d")
        ?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    try {
      await QRCode.toCanvas(canvas, payload, {
        width: 288,
        margin: 2,
        errorCorrectionLevel: level,
        color: { dark, light },
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate QR code.");
    }
  }, [payload, level, dark, light]);

  useEffect(() => {
    void render();
  }, [render]);

  async function downloadPng() {
    if (!payload.trim()) return;
    const url = await QRCode.toDataURL(payload, {
      width: size,
      margin: 2,
      errorCorrectionLevel: level,
      color: { dark, light },
    });
    triggerDownload(url, `qr-${mode}.png`);
  }

  async function downloadSvg() {
    if (!payload.trim()) return;
    const svg = await QRCode.toString(payload, {
      type: "svg",
      margin: 2,
      errorCorrectionLevel: level,
      color: { dark, light },
    });
    const url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml" }),
    );
    triggerDownload(url, `qr-${mode}.svg`);
    URL.revokeObjectURL(url);
  }

  async function copyImage() {
    const canvas = canvasRef.current;
    if (!canvas || !payload.trim()) return;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) return;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Clipboard not available in this browser.");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Controls */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <div className="flex flex-wrap gap-2">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  className={`rounded-full px-3 py-1.5 text-sm ${
                    mode === m.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {mode === "text" && (
            <div className="space-y-1.5">
              <Label htmlFor="qr-text">Content</Label>
              <Textarea
                id="qr-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="https://example.com or any text…"
                rows={4}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                {text.length}/2000 characters
              </p>
            </div>
          )}

          {mode === "wifi" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="wifi-ssid">Network name (SSID)</Label>
                <Input
                  id="wifi-ssid"
                  value={ssid}
                  onChange={(e) => setSsid(e.target.value)}
                  maxLength={64}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Security</Label>
                <div className="flex gap-2">
                  {(
                    [
                      ["WPA", "WPA/WPA2"],
                      ["WEP", "WEP"],
                      ["nopass", "Open"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSecurity(value)}
                      className={`rounded-full px-3 py-1.5 text-sm ${
                        security === value
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {security !== "nopass" && (
                <div className="space-y-1.5">
                  <Label htmlFor="wifi-pass">Password</Label>
                  <Input
                    id="wifi-pass"
                    value={wifiPass}
                    onChange={(e) => setWifiPass(e.target.value)}
                    maxLength={64}
                  />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hidden}
                  onChange={(e) => setHidden(e.target.checked)}
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                />
                Hidden network
              </label>
            </div>
          )}

          {mode === "vcard" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="vc-name">Full name *</Label>
                <Input
                  id="vc-name"
                  value={vc.fullName}
                  onChange={(e) => setVc({ ...vc, fullName: e.target.value })}
                  maxLength={80}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vc-org">Company</Label>
                <Input
                  id="vc-org"
                  value={vc.org}
                  onChange={(e) => setVc({ ...vc, org: e.target.value })}
                  maxLength={80}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vc-title">Job title</Label>
                <Input
                  id="vc-title"
                  value={vc.title}
                  onChange={(e) => setVc({ ...vc, title: e.target.value })}
                  maxLength={80}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vc-phone">Phone</Label>
                <Input
                  id="vc-phone"
                  value={vc.phone}
                  onChange={(e) => setVc({ ...vc, phone: e.target.value })}
                  maxLength={30}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vc-email">Email</Label>
                <Input
                  id="vc-email"
                  type="email"
                  value={vc.email}
                  onChange={(e) => setVc({ ...vc, email: e.target.value })}
                  maxLength={100}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="vc-web">Website</Label>
                <Input
                  id="vc-web"
                  value={vc.website}
                  onChange={(e) => setVc({ ...vc, website: e.target.value })}
                  maxLength={200}
                />
              </div>
            </div>
          )}

          {mode === "promptpay" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="pp-target">
                  Phone number / National ID / e-Wallet ID
                </Label>
                <Input
                  id="pp-target"
                  value={ppTarget}
                  onChange={(e) => setPpTarget(e.target.value)}
                  placeholder="0812345678"
                  maxLength={20}
                />
                {ppTarget && !isValidPromptPayTarget(ppTarget) && (
                  <p className="text-xs text-destructive">
                    Enter a 10-digit phone, 13-digit ID or 15-digit wallet ID.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pp-amount">Amount (THB, optional)</Label>
                <Input
                  id="pp-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={ppAmount}
                  onChange={(e) => setPpAmount(e.target.value)}
                  placeholder="Leave empty for any amount"
                />
                <p className="text-xs text-muted-foreground">
                  With an amount the QR is fixed-price (dynamic); without it
                  the payer types the amount.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Error correction</Label>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setLevel(l.value)}
                  className={`rounded-full px-3 py-1.5 text-sm ${
                    level === l.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Download size (PNG)</Label>
            <div className="flex gap-2">
              {SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  className={`rounded-full px-3 py-1.5 text-sm ${
                    size === s
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {s}px
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="qr-dark">Foreground</Label>
              <input
                id="qr-dark"
                type="color"
                value={dark}
                onChange={(e) => setDark(e.target.value)}
                className="h-9 w-16 cursor-pointer rounded border bg-transparent"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qr-light">Background</Label>
              <input
                id="qr-light"
                type="color"
                value={light}
                onChange={(e) => setLight(e.target.value)}
                className="h-9 w-16 cursor-pointer rounded border bg-transparent"
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {/* Preview + actions */}
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-4">
          <div className="rounded-xl border bg-white p-3">
            <canvas ref={canvasRef} className="h-72 w-72" />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={downloadPng} disabled={!payload.trim()}>
              <Download className="mr-1 h-4 w-4" /> PNG
            </Button>
            <Button
              variant="secondary"
              onClick={downloadSvg}
              disabled={!payload.trim()}
            >
              <FileCode className="mr-1 h-4 w-4" /> SVG
            </Button>
            <Button
              variant="outline"
              onClick={copyImage}
              disabled={!payload.trim()}
            >
              {copied ? (
                <>
                  <Check className="mr-1 h-4 w-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-4 w-4" /> Copy
                </>
              )}
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Tip: use level H if you plan to overlay a logo in the middle.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}
