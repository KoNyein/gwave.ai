import { redirect } from "next/navigation";
import Link from "next/link";
import { Map as MapIcon, Users } from "lucide-react";

import { GpsMap } from "@/components/gps/gps-map";
import { getCurrentProfile } from "@/lib/auth";
import { getFamilyPeopleForMap } from "@/lib/db/family";
import type { MapPerson } from "@/lib/geolocation";

export const metadata = { title: "Map" };
export const dynamic = "force-dynamic";

export default async function MapPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const family = await getFamilyPeopleForMap(profile.id);
  const people: MapPerson[] = family.map((p) => ({
    id: p.profile.id,
    name: p.profile.full_name || p.profile.username || "Member",
    username: p.profile.username,
    latitude: p.location.latitude,
    longitude: p.location.longitude,
    avatarUrl: p.profile.avatar_url,
    updatedAt: p.location.updated_at,
  }));

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

      <GpsMap
        apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""}
        people={people}
      />
    </div>
  );
}
