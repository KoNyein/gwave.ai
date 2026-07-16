"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Crosshair,
  Download,
  ExternalLink,
  Gauge,
  Layers,
  Loader2,
  Locate,
  Map,
  MapPin,
  MessageSquare,
  Mountain,
  Navigation,
  Radio,
  Share2,
  Users,
  WifiOff,
} from "lucide-react";

import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { createPost } from "@/lib/actions/posts";
import {
  compass,
  distanceMeters,
  formatDistance,
  getCurrentPosition,
  watchPosition,
  type GeoFix,
  type MapPerson,
} from "@/lib/geolocation";

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

export function GpsMap({
  apiKey,
  people = [],
}: {
  apiKey: string;
  people?: MapPerson[];
}) {
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
  const [showFamily, setShowFamily] = React.useState(true);
  const [address, setAddress] = React.useState<string | null>(null);
  const [offline, setOffline] = React.useState<null | "saving" | "done">(null);
  const stopRef = React.useRef<(() => void) | null>(null);

  // Pre-cache OpenStreetMap tiles around the current spot so the map works with
  // no signal (the service worker stores each fetched tile). Covers a few zoom
  // levels of the immediate area — enough to navigate on foot offline.
  const downloadOfflineArea = React.useCallback(async () => {
    if (!fix) return;
    setOffline("saving");
    const lon2tile = (lon: number, z: number) =>
      Math.floor(((lon + 180) / 360) * 2 ** z);
    const lat2tile = (lat: number, z: number) =>
      Math.floor(
        ((1 -
          Math.log(
            Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180),
          ) /
            Math.PI) /
          2) *
          2 ** z,
      );
    const urls: string[] = [];
    for (const z of [13, 14, 15, 16]) {
      const cx = lon2tile(fix.longitude, z);
      const cy = lat2tile(fix.latitude, z);
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          urls.push(
            `https://a.tile.openstreetmap.org/${z}/${cx + dx}/${cy + dy}.png`,
          );
        }
      }
    }
    // Fetch in small batches so the tile server isn't hammered; the SW caches
    // each successful response.
    for (let i = 0; i < urls.length; i += 8) {
      await Promise.all(
        urls.slice(i, i + 8).map((u) => fetch(u).catch(() => undefined)),
      );
    }
    setOffline("done");
    setTimeout(() => setOffline(null), 3000);
  }, [fix]);

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

  // Reverse-geocode the current fix to a human address (Google Geocoding API,
  // only when a key is configured and we're online). Debounced by the fix
  // reference; failures just leave the address blank.
  React.useEffect(() => {
    if (!fix || !apiKey || !online) {
      setAddress(null);
      return;
    }
    let cancelled = false;
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=` +
      `${fix.latitude},${fix.longitude}&key=${apiKey}`;
    fetch(url)
      .then((r) => r.json())
      .then((d: { results?: { formatted_address?: string }[] }) => {
        if (!cancelled) setAddress(d.results?.[0]?.formatted_address ?? null);
      })
      .catch(() => {
        if (!cancelled) setAddress(null);
      });
    return () => {
      cancelled = true;
    };
  }, [fix, apiKey, online]);

  // Family members with a live location, sorted by distance from me.
  const peopleWithDistance = React.useMemo(() => {
    return people
      .map((p) => ({
        person: p,
        meters: fix
          ? distanceMeters(fix.latitude, fix.longitude, p.latitude, p.longitude)
          : null,
      }))
      .sort((a, b) => (a.meters ?? Infinity) - (b.meters ?? Infinity));
  }, [people, fix]);

  const shownPeople = showFamily ? people : [];
  const speedKmh =
    fix?.speed != null && fix.speed >= 0 ? fix.speed * 3.6 : null;
  const heading = compass(fix?.heading);

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
          <MapGoogleInner
            fix={fix}
            recenter={recenter}
            apiKey={apiKey}
            people={shownPeople}
          />
        ) : (
          <MapInner fix={fix} recenter={recenter} people={shownPeople} />
        )}
        {!online ? (
          <span className="absolute left-2 top-2 z-[500] flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
            <WifiOff className="h-3 w-3" /> Offline · OpenStreetMap
          </span>
        ) : null}
        {people.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowFamily((v) => !v)}
            className={`absolute right-2 top-2 z-[500] inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow ${
              showFamily
                ? "bg-primary text-primary-foreground"
                : "bg-black/70 text-white"
            }`}
          >
            <Users className="h-3 w-3" /> မိသားစု {people.length}
          </button>
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
        {fix ? (
          <Button
            onClick={downloadOfflineArea}
            disabled={offline === "saving"}
            size="sm"
            variant="outline"
          >
            {offline === "saving" ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1 h-4 w-4" />
            )}
            {offline === "done" ? "Offline သိမ်းပြီး" : "Offline သိမ်း"}
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">❌ {error}</p> : null}

      {fix ? (
        <div className="space-y-2 rounded-xl border bg-card p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono">{coords}</p>
              {address ? (
                <p className="flex items-start gap-1 text-xs text-muted-foreground">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {address}
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

          {/* Live GPS metrics from the device sensors. */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            {fix.accuracy != null ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                <Crosshair className="h-3 w-3" /> ±{Math.round(fix.accuracy)} m
              </span>
            ) : null}
            {fix.altitude != null ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                <Mountain className="h-3 w-3" /> {Math.round(fix.altitude)} m
              </span>
            ) : null}
            {speedKmh != null ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                <Gauge className="h-3 w-3" /> {speedKmh.toFixed(1)} km/h
              </span>
            ) : null}
            {heading ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                <Navigation className="h-3 w-3" /> {heading}
              </span>
            ) : null}
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
            <Link
              href="/family"
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
            >
              <Users className="h-3.5 w-3.5" /> မိသားစုသို့ Live မျှဝေ
            </Link>
          </div>
        </div>
      ) : null}

      {/* Family members currently sharing, nearest first. */}
      {peopleWithDistance.length > 0 ? (
        <div className="space-y-2 rounded-xl border bg-card p-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-primary" /> မိသားစု တည်နေရာ (
            {peopleWithDistance.length})
          </p>
          <ul className="divide-y">
            {peopleWithDistance.map(({ person, meters }) => (
              <li
                key={person.id}
                className="flex items-center justify-between gap-2 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {person.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={person.avatarUrl}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {person.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{person.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {meters != null ? `${formatDistance(meters)} အကွာ` : "—"}
                      {person.updatedAt
                        ? ` · ${new Date(person.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${person.latitude},${person.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-muted/50"
                    aria-label="Map ပေါ်ကြည့်"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  {person.username ? (
                    <Link
                      href={`/u/${person.username}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-muted/50"
                      aria-label="Message"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
