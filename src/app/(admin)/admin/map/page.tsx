import Link from "next/link";

import { AdminUsersMap } from "@/components/admin/admin-users-map";
import { Card, CardContent } from "@/components/ui/card";
import { getUserLocations } from "@/lib/db/admin";

export const dynamic = "force-dynamic";

function ago(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * Admin map: every user who shares their location, plotted on OSM tiles, plus
 * a table with when each was last seen. Location sharing is opt-in (family GPS
 * / SOS), so only those users appear here.
 */
export default async function AdminMapPage() {
  const users = await getUserLocations();

  const now = Date.now();
  const fresh = users.filter(
    (u) => (now - new Date(u.updatedAt).getTime()) / 60000 < 15,
  ).length;
  const recent = users.filter((u) => {
    const m = (now - new Date(u.updatedAt).getTime()) / 60000;
    return m >= 15 && m < 60 * 24;
  }).length;

  const markers = users.map((u) => ({
    latitude: u.latitude,
    longitude: u.longitude,
    name: u.name,
    username: u.username,
    role: u.role,
    updatedAt: u.updatedAt,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <h1 className="text-xl font-bold">👥 Users map</h1>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> live &lt;15m ({fresh})
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> &lt;24h ({recent})
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> older
          </span>
        </div>
      </div>

      <p className="px-1 text-xs text-muted-foreground">
        Location sharing is opt-in (family GPS / SOS). {users.length} user
        {users.length === 1 ? "" : "s"} currently share a location.
      </p>

      <AdminUsersMap markers={markers} />

      <Card>
        <CardContent className="px-0 py-0">
          {users.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No users are sharing a location right now.
            </p>
          ) : (
            <div className="divide-y">
              {users.map((u) => (
                <div
                  key={u.userId}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {u.username ? (
                      <Link
                        href={`/u/${u.username}`}
                        className="font-medium hover:underline"
                      >
                        {u.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{u.name}</span>
                    )}
                    {u.username ? (
                      <span className="text-muted-foreground">
                        {" "}
                        @{u.username}
                      </span>
                    ) : null}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                    {u.role}
                  </span>
                  <span className="w-28 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                    {u.latitude.toFixed(4)}, {u.longitude.toFixed(4)}
                  </span>
                  <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                    {ago(u.updatedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
