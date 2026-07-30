import { createAdminClient } from "@/lib/data/admin";
import { clientOf, encryptionOf, hasWps, vendorForMac } from "@/lib/oui";

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
  /** Access points by 2.4/5/6 GHz band. */
  byBand: { label: string; count: number }[];
  /** The busiest channels — the congestion picture. */
  byChannel: { label: string; count: number }[];
  /** Hardware makers, from the BSSID's OUI. */
  byVendor: { label: string; count: number }[];
  /** Encryption family, parsed from the raw capability string. */
  byEncryption: { label: string; count: number }[];
  /** Which browser did the scanning (web clients). */
  byBrowser: { label: string; count: number }[];
  /** Which OS. */
  byOs: { label: string; count: number }[];
  /** Which app build / platform. */
  byApp: { label: string; count: number }[];
  /** How many APs carry WPS, which is a known weakness. */
  wpsCount: number;
  hiddenCount: number;
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
    .select(
      "bssid, ssid, security, capabilities, band, channel, best_signal, observations",
    )
    .limit(20_000)
    .returns<
      {
        bssid: string;
        ssid: string | null;
        security: string | null;
        capabilities: string | null;
        band: string | null;
        channel: number | null;
        best_signal: number | null;
        observations: number;
      }[]
    >();
  const networks = nets ?? [];

  // Raw scan log. Missing table (migration not yet applied) is not an error —
  // the page then shows networks only, with a hint.
  const { data: scanRows } = await admin
    .from("wifi_scans")
    .select(
      "user_id, bssid, signal, latitude, longitude, scanned_at, user_agent, platform, os_version, device_model, app_build",
    )
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
        user_agent: string | null;
        platform: string | null;
        os_version: string | null;
        device_model: string | null;
        app_build: string | null;
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

  // --- Radio picture: band, channel, vendor, encryption.
  const bands = new Map<string, number>();
  const channels = new Map<string, number>();
  const vendors = new Map<string, number>();
  const encryption = new Map<string, number>();
  let wpsCount = 0;
  let hiddenCount = 0;
  for (const n of networks) {
    bands.set(n.band ?? "unknown", (bands.get(n.band ?? "unknown") ?? 0) + 1);
    if (n.channel != null) {
      const key = `${n.band ?? "?"} ch ${n.channel}`;
      channels.set(key, (channels.get(key) ?? 0) + 1);
    }
    const vendor = vendorForMac(n.bssid) ?? "unknown";
    vendors.set(vendor, (vendors.get(vendor) ?? 0) + 1);
    const enc = encryptionOf(n.capabilities, n.security);
    encryption.set(enc, (encryption.get(enc) ?? 0) + 1);
    if (hasWps(n.capabilities)) wpsCount += 1;
    if (!n.ssid || n.ssid.trim() === "") hiddenCount += 1;
  }

  // --- Which clients are scanning: browser, OS, app build.
  const browsers = new Map<string, number>();
  const oses = new Map<string, number>();
  const apps = new Map<string, number>();
  for (const r of scans) {
    const { browser, os } = clientOf(r.user_agent);
    // The app tells us its platform directly; trust that over the UA.
    const osLabel = r.os_version || (r.platform ? r.platform : os);
    browsers.set(browser, (browsers.get(browser) ?? 0) + 1);
    oses.set(osLabel, (oses.get(osLabel) ?? 0) + 1);
    const appLabel = r.app_build
      ? `Gwave v1.0.${r.app_build}`
      : r.platform
        ? `Gwave app (${r.platform})`
        : "web";
    apps.set(appLabel, (apps.get(appLabel) ?? 0) + 1);
  }

  const asRows = (m: Map<string, number>, limit = 20) =>
    [...m.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

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
    byBand: asRows(bands, 6),
    byChannel: asRows(channels, 20),
    byVendor: asRows(vendors, 20),
    byEncryption: asRows(encryption, 12),
    byBrowser: asRows(browsers, 12),
    byOs: asRows(oses, 12),
    byApp: asRows(apps, 12),
    wpsCount,
    hiddenCount,
  };
}

export interface WifiNetworkRow {
  bssid: string;
  ssid: string | null;
  security: string | null;
  /** Encryption family parsed from the raw capability string. */
  encryption: string;
  /** Hardware maker from the OUI, null when not in the short list. */
  vendor: string | null;
  band: string | null;
  channel: number | null;
  wps: boolean;
  bestSignal: number | null;
  latitude: number;
  longitude: number;
  observations: number;
  lastSeenAt: string;
  /** Admin watchlist entry, when this BSSID has been flagged. */
  watch: { risk: string; category: string; note: string } | null;
}

/** Every access point on record, for the admin table + map. */
export async function getWifiNetworks(
  limit = 2000,
): Promise<WifiNetworkRow[]> {
  const admin = createAdminClient();
  const [{ data }, { data: flags }] = await Promise.all([
    admin
      .from("wifi_networks")
      .select(
        "bssid, ssid, security, capabilities, band, channel, best_signal, latitude, longitude, observations, last_seen_at",
      )
      .order("observations", { ascending: false })
      .limit(limit)
      .returns<
        {
          bssid: string;
          ssid: string | null;
          security: string | null;
          capabilities: string | null;
          band: string | null;
          channel: number | null;
          best_signal: number | null;
          latitude: number;
          longitude: number;
          observations: number;
          last_seen_at: string;
        }[]
      >(),
    admin
      .from("wifi_watchlist")
      .select("bssid, risk, category, note")
      .limit(5000)
      .returns<
        { bssid: string; risk: string; category: string; note: string }[]
      >(),
  ]);
  const flagged = new Map((flags ?? []).map((f) => [f.bssid, f]));
  return (data ?? []).map((r) => {
    const f = flagged.get(r.bssid);
    return {
      bssid: r.bssid,
      ssid: r.ssid,
      security: r.security,
      encryption: encryptionOf(r.capabilities, r.security),
      vendor: vendorForMac(r.bssid),
      band: r.band,
      channel: r.channel,
      wps: hasWps(r.capabilities),
      bestSignal: r.best_signal,
      latitude: r.latitude,
      longitude: r.longitude,
      observations: r.observations,
      lastSeenAt: r.last_seen_at,
      watch: f ? { risk: f.risk, category: f.category, note: f.note } : null,
    };
  });
}

export interface WifiCluster {
  /** Grid cell centre — clusters are bucketed to ~110 m. */
  latitude: number;
  longitude: number;
  apCount: number;
  hiddenCount: number;
  /** The most common SSID prefix in the cell, when several APs share one. */
  commonPrefix: string | null;
  topVendor: string | null;
  sampleSsids: string[];
  bssids: string[];
  flaggedCount: number;
}

/**
 * Dense access-point clusters — many APs in one small area.
 *
 * This is a LEAD, not a finding. A large private network in one building can
 * be a hotel, a mall, a university, an office park — or one of the border scam
 * compounds. The dashboard says so plainly, because labelling a legitimate
 * business as a criminal operation on the strength of a Wi-Fi count would be
 * a real harm. What the cluster view is for is deciding where to look; the
 * judgement then goes on the record through the watchlist.
 *
 * Bucketing to 0.001° (~110 m) keeps a single building in one cell without
 * needing PostGIS.
 */
export async function getWifiClusters(
  minAps = 8,
): Promise<WifiCluster[]> {
  const admin = createAdminClient();
  const [{ data }, { data: flags }] = await Promise.all([
    admin
      .from("wifi_networks")
      .select("bssid, ssid, latitude, longitude")
      .limit(20_000)
      .returns<
        {
          bssid: string;
          ssid: string | null;
          latitude: number;
          longitude: number;
        }[]
      >(),
    admin
      .from("wifi_watchlist")
      .select("bssid")
      .limit(5000)
      .returns<{ bssid: string }[]>(),
  ]);
  const flagged = new Set((flags ?? []).map((f) => f.bssid));

  const cells = new Map<
    string,
    {
      lat: number;
      lng: number;
      bssids: string[];
      ssids: string[];
      hidden: number;
      vendors: Map<string, number>;
      flagged: number;
    }
  >();
  for (const n of data ?? []) {
    const key = `${n.latitude.toFixed(3)}|${n.longitude.toFixed(3)}`;
    const cell =
      cells.get(key) ??
      {
        lat: Number(n.latitude.toFixed(3)),
        lng: Number(n.longitude.toFixed(3)),
        bssids: [] as string[],
        ssids: [] as string[],
        hidden: 0,
        vendors: new Map<string, number>(),
        flagged: 0,
      };
    cell.bssids.push(n.bssid);
    if (n.ssid && n.ssid.trim()) cell.ssids.push(n.ssid.trim());
    else cell.hidden += 1;
    const v = vendorForMac(n.bssid);
    if (v) cell.vendors.set(v, (cell.vendors.get(v) ?? 0) + 1);
    if (flagged.has(n.bssid)) cell.flagged += 1;
    cells.set(key, cell);
  }

  return [...cells.values()]
    .filter((c) => c.bssids.length >= minAps)
    .map((c) => {
      // A shared SSID prefix across many APs is the signature of one managed
      // network (a campus, a hotel — or a compound), so it is worth surfacing.
      const prefixes = new Map<string, number>();
      for (const s of c.ssids) {
        const p = s.slice(0, 6).toLowerCase();
        if (p.length >= 3) prefixes.set(p, (prefixes.get(p) ?? 0) + 1);
      }
      const topPrefix = [...prefixes.entries()].sort((a, b) => b[1] - a[1])[0];
      const topVendor = [...c.vendors.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        latitude: c.lat,
        longitude: c.lng,
        apCount: c.bssids.length,
        hiddenCount: c.hidden,
        commonPrefix: topPrefix && topPrefix[1] >= 3 ? topPrefix[0] : null,
        topVendor: topVendor ? topVendor[0] : null,
        sampleSsids: [...new Set(c.ssids)].slice(0, 6),
        bssids: c.bssids.slice(0, 50),
        flaggedCount: c.flagged,
      };
    })
    .sort((a, b) => b.apCount - a.apCount)
    .slice(0, 50);
}

export interface WatchlistRow {
  bssid: string;
  risk: string;
  category: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  ssid: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** The admin watchlist, joined to whatever the map knows about each BSSID. */
export async function getWifiWatchlist(): Promise<WatchlistRow[]> {
  const admin = createAdminClient();
  const { data: flags } = await admin
    .from("wifi_watchlist")
    .select("bssid, risk, category, note, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(500)
    .returns<
      {
        bssid: string;
        risk: string;
        category: string;
        note: string;
        created_at: string;
        updated_at: string;
      }[]
    >();
  const rows = flags ?? [];
  if (rows.length === 0) return [];
  const { data: nets } = await admin
    .from("wifi_networks")
    .select("bssid, ssid, latitude, longitude")
    .in(
      "bssid",
      rows.map((r) => r.bssid),
    )
    .returns<
      {
        bssid: string;
        ssid: string | null;
        latitude: number;
        longitude: number;
      }[]
    >();
  const byBssid = new Map((nets ?? []).map((n) => [n.bssid, n]));
  return rows.map((r) => {
    const n = byBssid.get(r.bssid);
    return {
      bssid: r.bssid,
      risk: r.risk,
      category: r.category,
      note: r.note,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      ssid: n?.ssid ?? null,
      latitude: n?.latitude ?? null,
      longitude: n?.longitude ?? null,
    };
  });
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
