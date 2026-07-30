import { createAdminClient } from "@/lib/data/admin";

/**
 * Admin-only reads over the crowdsourced WiFi data.
 *
 * wifi_scans is RLS-sealed with zero policies (invisible to PostgREST), so
 * every read here goes through the service-role admin client. The callers are
 * admin pages behind requireAdmin — that role check IS the gate; this module
 * must never be imported from a public route.
 *
 * Aggregation happens in code rather than SQL views: PostgREST has no GROUP BY,
 * and a stale schema cache 500s embeds, so we pull flat rows and fold them.
 */

export interface WifiScanRow {
  id: number;
  user_id: string | null;
  bssid: string;
  ssid: string | null;
  security: string | null;
  signal: number | null;
  latitude: number;
  longitude: number;
  scanned_at: string;
}

export interface WifiContributor {
  userId: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  scans: number;
  uniqueAps: number;
  lastScanAt: string;
  strongest: number | null;
  /** Where this user last scanned — the admin can jump the map there. */
  lastLat: number;
  lastLng: number;
}

export interface WifiOverview {
  totalNetworks: number;
  totalScans: number;
  contributors: number;
  openNetworks: number;
  scansToday: number;
  scans7d: number;
  /** Scans per day, oldest first — the activity bar chart. */
  byDay: { day: string; count: number }[];
  /** Access points by security type — the security bar chart. */
  bySecurity: { label: string; count: number }[];
  /** Access points by signal band — the strength distribution chart. */
  bySignal: { label: string; count: number }[];
  /** Top contributing users. */
  topContributors: WifiContributor[];
}

/** How many days of scan history the charts cover. */
const DAYS = 30;

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Bucket an RSSI into the same near/mid/far language the app uses. */
function signalBand(rssi: number | null): string {
  if (rssi == null) return "unknown";
  if (rssi >= -55) return "Excellent (≥ −55)";
  if (rssi >= -70) return "Good (−56…−70)";
  if (rssi >= -85) return "Fair (−71…−85)";
  return "Weak (< −85)";
}

export async function getWifiOverview(): Promise<WifiOverview> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();

  // Networks (deduped APs) — small enough to fold in code at our scale.
  const { data: nets } = await admin
    .from("wifi_networks")
    .select("bssid, security, best_signal, observations")
    .limit(20_000)
    .returns<
      {
        bssid: string;
        security: string | null;
        best_signal: number | null;
        observations: number;
      }[]
    >();
  const networks = nets ?? [];

  // Raw scan log. Missing table (migration not yet applied) is not an error —
  // the page then shows networks only, with a hint.
  const { data: scanRows } = await admin
    .from("wifi_scans")
    .select("user_id, bssid, signal, latitude, longitude, scanned_at")
    .gte("scanned_at", since)
    .order("scanned_at", { ascending: false })
    .limit(50_000)
    .returns<
      {
        user_id: string | null;
        bssid: string;
        signal: number | null;
        latitude: number;
        longitude: number;
        scanned_at: string;
      }[]
    >();
  const scans = scanRows ?? [];

  // --- Per-day activity, zero-filled so the chart has no gaps.
  const dayCounts = new Map<string, number>();
  for (let i = DAYS - 1; i >= 0; i--) {
    dayCounts.set(
      new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10),
      0,
    );
  }
  for (const s of scans) {
    const k = dayKey(s.scanned_at);
    if (dayCounts.has(k)) dayCounts.set(k, (dayCounts.get(k) ?? 0) + 1);
  }

  // --- Security + signal distributions over the deduped APs.
  const sec = new Map<string, number>();
  for (const n of networks) {
    const label = (n.security || "UNKNOWN").toUpperCase();
    sec.set(label, (sec.get(label) ?? 0) + 1);
  }
  const sig = new Map<string, number>();
  for (const n of networks) {
    const label = signalBand(n.best_signal);
    sig.set(label, (sig.get(label) ?? 0) + 1);
  }

  // --- Per-user contribution.
  const byUser = new Map<
    string,
    {
      scans: number;
      aps: Set<string>;
      last: string;
      strongest: number | null;
      lat: number;
      lng: number;
    }
  >();
  for (const s of scans) {
    if (!s.user_id) continue;
    const cur = byUser.get(s.user_id);
    if (!cur) {
      // Rows arrive newest-first, so the first sighting IS the latest.
      byUser.set(s.user_id, {
        scans: 1,
        aps: new Set([s.bssid]),
        last: s.scanned_at,
        strongest: s.signal,
        lat: s.latitude,
        lng: s.longitude,
      });
      continue;
    }
    cur.scans += 1;
    cur.aps.add(s.bssid);
    if (s.signal != null && (cur.strongest == null || s.signal > cur.strongest)) {
      cur.strongest = s.signal;
    }
  }

  const ids = [...byUser.keys()];
  const profiles = ids.length
    ? (
        await admin
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", ids)
          .returns<
            {
              id: string;
              username: string | null;
              full_name: string | null;
              avatar_url: string | null;
            }[]
          >()
      ).data ?? []
    : [];
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const contributors: WifiContributor[] = ids
    .map((id) => {
      const v = byUser.get(id)!;
      const p = profileById.get(id);
      return {
        userId: id,
        username: p?.username ?? null,
        fullName: p?.full_name ?? null,
        avatarUrl: p?.avatar_url ?? null,
        scans: v.scans,
        uniqueAps: v.aps.size,
        lastScanAt: v.last,
        strongest: v.strongest,
        lastLat: v.lat,
        lastLng: v.lng,
      };
    })
    .sort((a, b) => b.scans - a.scans);

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  return {
    totalNetworks: networks.length,
    totalScans: scans.length,
    contributors: contributors.length,
    openNetworks: networks.filter(
      (n) => (n.security || "").toUpperCase() === "OPEN",
    ).length,
    scansToday: scans.filter((s) => dayKey(s.scanned_at) === today).length,
    scans7d: scans.filter((s) => s.scanned_at >= weekAgo).length,
    byDay: [...dayCounts.entries()].map(([day, count]) => ({ day, count })),
    bySecurity: [...sec.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    bySignal: ["Excellent (≥ −55)", "Good (−56…−70)", "Fair (−71…−85)", "Weak (< −85)", "unknown"]
      .map((label) => ({ label, count: sig.get(label) ?? 0 }))
      .filter((r) => r.count > 0),
    topContributors: contributors.slice(0, 50),
  };
}

/** Every access point on record, for the admin table + map. */
export async function getWifiNetworks(limit = 2000): Promise<
  {
    bssid: string;
    ssid: string | null;
    security: string | null;
    bestSignal: number | null;
    latitude: number;
    longitude: number;
    observations: number;
    lastSeenAt: string;
  }[]
> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("wifi_networks")
    .select(
      "bssid, ssid, security, best_signal, latitude, longitude, observations, last_seen_at",
    )
    .order("observations", { ascending: false })
    .limit(limit)
    .returns<
      {
        bssid: string;
        ssid: string | null;
        security: string | null;
        best_signal: number | null;
        latitude: number;
        longitude: number;
        observations: number;
        last_seen_at: string;
      }[]
    >();
  return (data ?? []).map((r) => ({
    bssid: r.bssid,
    ssid: r.ssid,
    security: r.security,
    bestSignal: r.best_signal,
    latitude: r.latitude,
    longitude: r.longitude,
    observations: r.observations,
    lastSeenAt: r.last_seen_at,
  }));
}

/** One user's full scan history — the per-user drill-down. */
export async function getUserWifiScans(
  userId: string,
  limit = 500,
): Promise<WifiScanRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("wifi_scans")
    .select(
      "id, user_id, bssid, ssid, security, signal, latitude, longitude, scanned_at",
    )
    .eq("user_id", userId)
    .order("scanned_at", { ascending: false })
    .limit(limit)
    .returns<WifiScanRow[]>();
  return data ?? [];
}
