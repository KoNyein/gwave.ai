import { redirect } from "next/navigation";
import Link from "next/link";
import { Map as MapIcon, Users } from "lucide-react";

import { GpsMap } from "@/components/gps/gps-map";
import { SafetyPanel } from "@/components/gps/safety-panel";
import { SosPanel } from "@/components/gps/sos-panel";
import { getCurrentProfile } from "@/lib/auth";
import { getFamilyPeopleForMap } from "@/lib/db/family";
import { getFamilySafety } from "@/lib/db/safety";
import { getActiveSosAlerts, getMyActiveSos } from "@/lib/db/sos";
import type { MapPerson } from "@/lib/geolocation";

export const metadata = { title: "Map" };
export const dynamic = "force-dynamic";

export default async function MapPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [family, sosAlerts, myAlert, familySafety] = await Promise.all([
    getFamilyPeopleForMap(profile.id),
    getActiveSosAlerts(),
    getMyActiveSos(profile.id),
    getFamilySafety(profile.id),
  ]);

  const familyPeople: MapPerson[] = family.map((p) => ({
    id: p.profile.id,
    name: p.profile.full_name || p.profile.username || "Member",
    username: p.profile.username,
    latitude: p.location.latitude,
    longitude: p.location.longitude,
    avatarUrl: p.profile.avatar_url,
    updatedAt: p.location.updated_at,
    kind: "family",
  }));
  // SOS alerts also plot on the map, as red emergency pins.
  const sosPeople: MapPerson[] = sosAlerts.map((a) => ({
    id: `sos-${a.id}`,
    name: `🆘 ${a.person.full_name || a.person.username || "SOS"}`,
    latitude: a.latitude,
    longitude: a.longitude,
    kind: "sos",
  }));
  const people = [...familyPeople, ...sosPeople];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MapIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold">🗺️ GPS Map</h1>
            <p className="text-sm text-muted-foreground">
              သင့် တည်နေရာကို မြေပုံပေါ်တွင် တိုက်ရိုက် ကြည့်ရန်
            </p>
          </div>
        </div>
        <Link
          href="/family"
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted/50"
        >
          <Users className="h-4 w-4" /> မိသားစု
        </Link>
      </div>

      <SosPanel myAlert={myAlert} alerts={sosAlerts} myUserId={profile.id} />

      {familySafety.length > 0 ? (
        <SafetyPanel family={familySafety} myUserId={profile.id} />
      ) : null}

      <GpsMap
        apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""}
        people={people}
      />
    </div>
  );
}
