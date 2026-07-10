"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Loader2,
  LogOut,
  MapPin,
  Navigation,
  Plus,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { FamilyMap } from "@/components/family/family-map";
import type { MapMarker } from "@/components/family/family-map-inner";
import { UserAvatar } from "@/components/social/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createFamilyCircle,
  joinFamilyCircle,
  leaveFamilyCircle,
  setFamilySharing,
  updateMyLocation,
} from "@/lib/actions/family";
import type { CircleMember, CircleWithMine } from "@/lib/db/family";
import { displayName, timeAgo } from "@/lib/format";
import { getCurrentPosition } from "@/lib/geolocation";

/** Distance in metres between two lat/lng points (haversine). */
function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

const REFRESH_MS = 30_000;

export function FamilyClient({
  circles,
  activeCircle,
  members,
  myUserId,
  googleMapsKey,
}: {
  circles: CircleWithMine[];
  activeCircle: CircleWithMine | null;
  members: CircleMember[];
  myUserId: string;
  googleMapsKey: string;
}) {
  const t = useTranslations("family");
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const sharing = activeCircle?.sharing_enabled ?? false;

  // While sharing is on for the active circle, publish our position now and
  // every 30s so circle-mates see a live-ish location.
  React.useEffect(() => {
    if (!sharing) return;
    let cancelled = false;
    async function publish() {
      try {
        const pos = await getCurrentPosition();
        if (cancelled) return;
        await updateMyLocation(pos);
      } catch {
        /* permission denied or unavailable — the toggle stays on, no crash */
      }
    }
    void publish();
    const id = setInterval(() => void publish(), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [sharing, activeCircle?.id]);

  const myLocation =
    members.find((m) => m.profile.id === myUserId)?.location ?? null;

  const markers: MapMarker[] = members
    .filter((m) => m.location)
    .map((m) => ({
      latitude: m.location!.latitude,
      longitude: m.location!.longitude,
      label: displayName(m.profile),
      isMe: m.profile.id === myUserId,
    }));

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = new FormData(e.currentTarget).get("name");
    setPending(true);
    setError(null);
    const res = await createFamilyCircle(String(name ?? ""));
    setPending(false);
    if (!res.ok) return setError(res.error);
    router.push(`/family?c=${res.data.id}`);
  }

  async function onJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = new FormData(e.currentTarget).get("code");
    setPending(true);
    setError(null);
    const res = await joinFamilyCircle(String(code ?? ""));
    setPending(false);
    if (!res.ok) return setError(res.error);
    router.push(`/family?c=${res.data.id}`);
  }

  async function toggleSharing() {
    if (!activeCircle) return;
    setPending(true);
    await setFamilySharing({ circleId: activeCircle.id, enabled: !sharing });
    setPending(false);
    router.refresh();
  }

  async function leave() {
    if (!activeCircle || !window.confirm(t("leaveConfirm"))) return;
    setPending(true);
    await leaveFamilyCircle(activeCircle.id);
    setPending(false);
    router.push("/family");
  }

  async function copyCode() {
    if (!activeCircle) return;
    try {
      await navigator.clipboard.writeText(activeCircle.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-4">
      {/* Circle switcher */}
      {circles.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {circles.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => router.push(`/family?c=${c.id}`)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                activeCircle?.id === c.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "hover:bg-muted/50"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      ) : null}

      {activeCircle ? (
        <>
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 font-semibold">
                  <Users className="h-4 w-4 text-primary" /> {activeCircle.name}
                </p>
                <div className="flex items-center gap-1.5 text-xs">
                  {t("code")}:
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
                    {activeCircle.invite_code}
                  </code>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={copyCode}>
                    {copied ? (
                      <span className="text-[10px] text-primary">✓</span>
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* My sharing toggle */}
              <button
                type="button"
                onClick={toggleSharing}
                disabled={pending}
                className={`flex w-full items-center justify-between rounded-lg border p-3 text-sm transition-colors ${
                  sharing
                    ? "border-primary/40 bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Navigation
                    className={`h-4 w-4 ${sharing ? "text-primary" : "text-muted-foreground"}`}
                  />
                  {sharing ? t("sharingOn") : t("sharingOff")}
                </span>
                <span
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    sharing ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                      sharing ? "left-[1.15rem]" : "left-0.5"
                    }`}
                  />
                </span>
              </button>
              <p className="text-xs text-muted-foreground">{t("sharingHint")}</p>
            </CardContent>
          </Card>

          {/* Map */}
          <FamilyMap markers={markers} />

          {googleMapsKey && myLocation ? (
            <iframe
              title="Google Maps"
              className="h-72 w-full rounded-xl border"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps/embed/v1/view?key=${googleMapsKey}&center=${myLocation.latitude},${myLocation.longitude}&zoom=14`}
            />
          ) : null}

          {/* Members */}
          <div className="space-y-2">
            {members.map((m) => {
              const dist =
                myLocation && m.location && m.profile.id !== myUserId
                  ? distanceMeters(myLocation, m.location)
                  : null;
              return (
                <Card key={m.profile.id}>
                  <CardContent className="flex items-center gap-3 p-3">
                    <UserAvatar profile={m.profile} className="h-9 w-9" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {displayName(m.profile)}
                        {m.profile.id === myUserId ? ` (${t("you")})` : ""}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.location
                          ? t("updatedAgo", {
                              ago: timeAgo(m.location.updated_at),
                            })
                          : m.sharing_enabled
                            ? t("noLocationYet")
                            : t("notSharing")}
                        {dist != null ? ` · ${formatDistance(dist)}` : ""}
                      </p>
                    </div>
                    {m.location ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${m.location.latitude},${m.location.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <MapPin className="h-3.5 w-3.5" /> {t("openMaps")}
                      </a>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Button variant="ghost" size="sm" onClick={leave} disabled={pending} className="text-destructive hover:text-destructive">
            <LogOut className="mr-1 h-4 w-4" /> {t("leave")}
          </Button>
        </>
      ) : (
        /* No active circle: create or join */
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardContent className="space-y-2 p-4">
              <p className="flex items-center gap-1.5 font-semibold">
                <Plus className="h-4 w-4 text-primary" /> {t("createTitle")}
              </p>
              <form onSubmit={onCreate} className="space-y-2">
                <Input name="name" placeholder={t("namePlaceholder")} required maxLength={80} />
                <Button type="submit" disabled={pending} className="w-full">
                  {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                  {t("create")}
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-4">
              <p className="flex items-center gap-1.5 font-semibold">
                <Users className="h-4 w-4 text-primary" /> {t("joinTitle")}
              </p>
              <form onSubmit={onJoin} className="space-y-2">
                <Input name="code" placeholder={t("codePlaceholder")} required maxLength={16} />
                <Button type="submit" variant="outline" disabled={pending} className="w-full">
                  {t("join")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
