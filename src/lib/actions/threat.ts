"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { distanceMeters, formatDistance } from "@/lib/geolocation";
import { sendPushToUser } from "@/lib/push";
import { createAdminClient } from "@/lib/data/admin";
import { createClient } from "@/lib/data/server";
import { getCurrentUser } from "@/lib/auth";
import { THREAT_META, bearingLabelMy } from "@/lib/threat";
import type { ThreatKind } from "@/types/database";

const schema = z.object({
  kind: z.enum(["airstrike", "artillery", "drone", "ground", "disaster", "other"]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).nullable().optional(),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

/**
 * Report an incoming threat and instantly warn everyone within its radius. This
 * is a human spotter relay — the value is speed: a jet sighting must reach
 * people downrange in seconds. Notification is best-effort and never blocks the
 * report itself.
 */
export async function reportThreat(
  input: z.infer<typeof schema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid report." };

  const db = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await db
    .from("threat_alerts")
    .insert({
      reporter_id: user.id,
      kind: parsed.data.kind,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      heading: parsed.data.heading ?? null,
      note: parsed.data.note || null,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not report." };
  }

  void warnNearby({
    kind: parsed.data.kind,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    heading: parsed.data.heading ?? null,
    reporterId: user.id,
  });

  revalidatePath("/map");
  return { ok: true, data: { id: data.id } };
}

async function warnNearby(opts: {
  kind: ThreatKind;
  latitude: number;
  longitude: number;
  heading: number | null;
  reporterId: string;
}): Promise<void> {
  try {
    const meta = THREAT_META[opts.kind];
    const radiusKm = meta.radiusKm;
    const { latitude: lat, longitude: lng } = opts;
    const dLat = radiusKm / 111.32;
    const dLng =
      radiusKm / (111.32 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
    // Only warn people with a very recent location (they're active now).
    const freshSince = new Date(Date.now() - 6 * 3600 * 1000).toISOString();

    const admin = createAdminClient();
    const { data: rows } = await admin
      .from("member_locations")
      .select("user_id, latitude, longitude")
      .gte("latitude", lat - dLat)
      .lte("latitude", lat + dLat)
      .gte("longitude", lng - dLng)
      .lte("longitude", lng + dLng)
      .gte("updated_at", freshSince)
      .returns<{ user_id: string; latitude: number; longitude: number }[]>();

    const dir = bearingLabelMy(opts.heading);
    const seen = new Set<string>();
    const targets: { userId: string; meters: number }[] = [];
    for (const r of rows ?? []) {
      if (r.user_id === opts.reporterId || seen.has(r.user_id)) continue;
      const meters = distanceMeters(lat, lng, r.latitude, r.longitude);
      if (meters <= radiusKm * 1000) {
        seen.add(r.user_id);
        targets.push({ userId: r.user_id, meters });
      }
    }
    if (targets.length === 0) return;

    await Promise.all(
      targets.map(({ userId, meters }) =>
        sendPushToUser(userId, {
          title: `⚠️ ${meta.emoji} ${meta.label} — သတိပေးချက်`,
          body: `${formatDistance(meters)} အကွာ${dir ? ` · ${dir}မှ` : ""} · ချက်ချင်း ကာကွယ်ပါ`,
          url: "/map",
          tag: "threat",
        }),
      ),
    );
  } catch {
    /* best-effort */
  }
}
