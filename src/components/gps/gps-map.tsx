"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Crosshair,
  ExternalLink,
  Layers,
  Loader2,
  Locate,
  Map,
  Radio,
  Share2,
  WifiOff,
} from "lucide-react";

import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { createPost } from "@/lib/actions/posts";
import { getCurrentPosition, watchPosition, type GeoFix } from "@/lib/geolocation";

const MapInner = dynamic(() => import("@/components/gps/gps-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
      Map ဖွင့်နေသည်…
    </div>
  ),
});

const MapGoogleInner = dynamic(
  () => import("@/components/gps/gps-map-google-inner"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
        Google Map ဖွင့်နေသည်…
      </div>
    ),
  },
);

const SOURCE_KEY = "gwave.gpsMapSource";

export function GpsMap({ apiKey }: { apiKey: string }) {
  // Online detection: Google Maps JS can't load offline, so fall back to the
  // OSM/Leaflet map (which shows cached tiles) when there's no connection. GPS
  // coordinates work offline either way.
  const [online, setOnline] = React.useState(true);
  React.useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Map source: the user can switch freely between Google (satellite + detail)
  // and OpenStreetMap (free + works offline from cached tiles). Default to
  // Google when a key is configured; remember the choice across visits.
  const [source, setSource] = React.useState<"google" | "osm">(
    apiKey ? "google" : "osm",
  );
  React.useEffect(() => {
    const saved = window.localStorage.getItem(SOURCE_KEY);
    if (saved === "google" || saved === "osm") setSource(saved);
  }, []);
  const chooseSource = React.useCallback((s: "google" | "osm") => {
    setSource(s);
    window.localStorage.setItem(SOURCE_KEY, s);
  }, []);

  // Google only actually renders when a key exists, the user picked it, and
  // there's a connection; otherwise OSM/Leaflet is used (and shows offline).
  const useGoogle = Boolean(apiKey) && source === "google" && online;
  const router = useRouter();
  const [fix, setFix] = React.useState<GeoFix | null>(null);
  const [recenter, setRecenter] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [follow, setFollow] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [shared, setShared] = React.useState(false);
  const stopRef = React.useRef<(() => void) | null>(null);

  const locate = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const pos = await getCurrentPosition();
      setFix(pos);
      setRecenter((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't get your location.");
    } finally {
      setBusy(false);
    }
  }, []);

  // Fetch a first fix on mount.
  React.useEffect(() => {
    void locate();
  }, [locate]);

  // Live-follow toggles a continuous watch.
  React.useEffect(() => {
    if (!follow) {
      stopRef.current?.();
      stopRef.current = null;
      return;
    }
    stopRef.current = watchPosition(
      (pos) => {
        setFix(pos);
        setRecenter((n) => n + 1);
      },
      (msg) => setError(msg),
    );
    return () => {
      stopRef.current?.();
      stopRef.current = null;
    };
  }, [follow]);

  const coords = fix
    ? `${fix.latitude.toFixed(6)}, ${fix.longitude.toFixed(6)}`
    : null;
  const gmaps = fix
    ? `https://www.google.com/maps/search/?api=1&query=${fix.latitude},${fix.longitude}`
    : null;

  async function copyCoords() {
    if (!coords) return;
    await navigator.clipboard?.writeText(coords);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function shareLocation() {
    if (!fix || busy) return;
    setBusy(true);
    const res = await createPost({
      content: "📍 ကျွန်တော့် တည်နေရာ",
      visibility: "friends",
      media: [],
      latitude: fix.latitude,
      longitude: fix.longitude,
      locationName: null,
    });
    setBusy(false);
    if (res.ok) {
      setShared(true);
      setTimeout(() => setShared(false), 2500);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="space-y-3">
      {apiKey ? (
        <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => chooseSource("google")}
            disabled={!online}
            className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 transition-colors disabled:opacity-40 ${
              source === "google"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Map className="h-3.5 w-3.5" /> Google
          </button>
          <button
            type="button"
            onClick={() => chooseSource("osm")}
            className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 transition-colors ${
              source === "osm"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-3.5 w-3.5" /> OpenStreetMap
          </button>
        </div>
      ) : null}

      <div className="relative h-[60vh] min-h-[320px] w-full overflow-hidden rounded-xl border">
        {useGoogle ? (
          <MapGoogleInner fix={fix} recenter={recenter} apiKey={apiKey} />
        ) : (
          <MapInner fix={fix} recenter={recenter} />
        )}
        {!online ? (
          <span className="absolute left-2 top-2 z-[500] flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
            <WifiOff className="h-3 w-3" /> Offline · OpenStreetMap
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={locate} disabled={busy} size="sm">
          {busy ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Locate className="mr-1 h-4 w-4" />
          )}
          တည်နေရာ ရှာရန်
        </Button>
        <Button
          onClick={() => setFollow((v) => !v)}
          size="sm"
          variant={follow ? "default" : "outline"}
        >
          <Radio className="mr-1 h-4 w-4" />
          {follow ? "Live · ရပ်ရန်" : "Live လိုက်ကြည့်"}
        </Button>
        {fix ? (
          <Button
            onClick={() => setRecenter((n) => n + 1)}
            size="sm"
            variant="outline"
          >
            <Crosshair className="mr-1 h-4 w-4" /> ဗဟိုပြန်
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">❌ {error}</p> : null}

      {fix ? (
        <div className="space-y-2 rounded-xl border bg-card p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-mono">{coords}</p>
              {fix.accuracy != null ? (
                <p className="text-xs text-muted-foreground">
                  တိကျမှု ≈ {Math.round(fix.accuracy)} မီတာ
                </p>
              ) : null}
            </div>
            <Button onClick={copyCoords} size="sm" variant="ghost" className="h-8 px-2">
              {copied ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {gmaps ? (
              <a
                href={gmaps}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Google Maps
              </a>
            ) : null}
            <button
              type="button"
              onClick={shareLocation}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
            >
              {shared ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Share2 className="h-3.5 w-3.5" />
              )}
              {shared ? "မျှဝေပြီး" : "Post အဖြစ် မျှဝေ"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
