import { WifiAnalytics } from "@/components/admin/wifi-analytics";
import { WifiDetailTables } from "@/components/admin/wifi-detail-tables";
import {
  getWifiClusters,
  getWifiNetworks,
  getWifiOverview,
  getWifiWatchlist,
} from "@/lib/db/wifi-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "WiFi data — Admin" };

/**
 * Admin WiFi data page: everything users have contributed from the in-app
 * WiFi map scanner — coverage map, security and signal distributions, scan
 * activity over 30 days, and per-user contribution. The admin layout's
 * requireRole("admin") is the gate; wifi_scans itself is RLS-sealed and only
 * reachable through the server admin client.
 */
export default async function AdminWifiPage() {
  const [overview, networks, clusters, watchlist] = await Promise.all([
    getWifiOverview(),
    getWifiNetworks(),
    getWifiClusters(),
    getWifiWatchlist(),
  ]);

  const points = networks.map((n) => ({
    latitude: n.latitude,
    longitude: n.longitude,
    ssid: n.ssid,
    bssid: n.bssid,
    security: n.security,
    bestSignal: n.bestSignal,
    observations: n.observations,
  }));

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-bold">📡 WiFi scanner data</h1>
        <p className="text-sm text-muted-foreground">
          User များ စုစည်းပေးထားသော WiFi map အချက်အလက် အားလုံး
        </p>
      </div>
      <WifiAnalytics overview={overview} points={points} />
      <WifiDetailTables
        networks={networks}
        clusters={clusters}
        watchlist={watchlist}
        charts={{
          byBand: overview.byBand,
          byChannel: overview.byChannel,
          byVendor: overview.byVendor,
          byEncryption: overview.byEncryption,
          byBrowser: overview.byBrowser,
          byOs: overview.byOs,
          byApp: overview.byApp,
          wpsCount: overview.wpsCount,
          hiddenCount: overview.hiddenCount,
        }}
      />
    </div>
  );
}
