import "server-only";

import { createAdminClient } from "@/lib/data/admin";
import { distanceMeters, formatDistance } from "@/lib/geolocation";
import { sendPushToUser } from "@/lib/push";
import type { SosCategory } from "@/types/database";

/** How far around an SOS to alert people, and how fresh their location must be. */
const RADIUS_KM = 5;
const FRESH_HOURS = 24;

const CATEGORY_LABEL: Record<SosCategory, string> = {
  medical: "🚑 ဆေးကုသ",
  disaster: "🌊 သဘာဝဘေး",
  conflict: "⚠️ စစ်ဘေး",
  fire: "🔥 မီးလောင်",
  trapped: "🆘 ပိတ်မိ",
  other: "❗ အရေးပေါ်",
};

/**
 * Alert people near an SOS. Finds users who are sharing a recent location within
 * RADIUS_KM of the alert and pushes them a notification so nearby help can
 * respond fast. Server-only, service-role (so it can see all recent locations),
 * best-effort — never throws into the SOS action.
 *
 * A bounding-box pre-filter keeps the query cheap (no PostGIS needed); the exact
 * circle is applied in memory with the Haversine helper.
 */
export async function notifyNearbySos(opts: {
  raiserId: string;
  raiserName: string;
  category: SosCategory;
  latitude: number;
  longitude: number;
}): Promise<void> {
  try {
    const { latitude: lat, longitude: lng } = opts;
    const dLat = RADIUS_KM / 111.32;
    const dLng = RADIUS_KM / (111.32 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
    const freshSince = new Date(
      Date.now() - FRESH_HOURS * 3600 * 1000,
    ).toISOString();

    const admin = createAdminClient();
    const { data: rows } = await admin
      .from("member_locations")
      .select("user_id, latitude, longitude, updated_at")
      .gte("latitude", lat - dLat)
      .lte("latitude", lat + dLat)
      .gte("longitude", lng - dLng)
      .lte("longitude", lng + dLng)
      .gte("updated_at", freshSince)
      .returns<
        {
          user_id: string;
          latitude: number;
          longitude: number;
          updated_at: string;
        }[]
      >();

    const seen = new Set<string>();
    const targets: { userId: string; meters: number }[] = [];
    for (const r of rows ?? []) {
      if (r.user_id === opts.raiserId || seen.has(r.user_id)) continue;
      const meters = distanceMeters(lat, lng, r.latitude, r.longitude);
      if (meters <= RADIUS_KM * 1000) {
        seen.add(r.user_id);
        targets.push({ userId: r.user_id, meters });
      }
    }
    if (targets.length === 0) return;

    const label = CATEGORY_LABEL[opts.category];
    await Promise.all(
      targets.map(({ userId, meters }) =>
        sendPushToUser(userId, {
          title: "🆘 အနီးနားတွင် အကူအညီ လိုအပ်နေသည်",
          body: `${opts.raiserName} · ${label} · ${formatDistance(meters)} အကွာ`,
          url: "/map",
          tag: "sos",
        }),
      ),
    );
  } catch {
    /* best-effort: a notification failure must never block the SOS itself */
  }
}
