import { WifiAnalytics } from "@/components/admin/wifi-analytics";
import { getWifiNetworks, getWifiOverview } from "@/lib/db/wifi-admin";

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
  const [overview, networks] = await Promise.all([
    getWifiOverview(),
    getWifiNetworks(),
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
    </div>
  );
}
