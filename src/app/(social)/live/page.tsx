import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, Plus, Radio } from "lucide-react";

import { UserAvatar } from "@/components/social/user-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { listStreams } from "@/lib/db/live";
import { displayName, timeAgo } from "@/lib/format";

export const metadata = { title: "Live" };
export const dynamic = "force-dynamic";

export default async function LivePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const streams = await listStreams();
  const liveNow = streams.filter((s) => s.status === "live");
  const rest = streams.filter((s) => s.status !== "live");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Live</h1>
            <p className="text-sm text-muted-foreground">
              Watch broadcasts from the community — or start your own.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/live/dashboard"
            className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted/50"
          >
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Link>
          <Link
            href="/live/new"
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Go live
          </Link>
        </div>
      </div>

      {liveNow.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold">Live now</h2>
          {liveNow.map((stream) => (
            <Link key={stream.id} href={`/live/${stream.id}`} className="block">
              <Card className="border-destructive/40 transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-3 p-4">
                  <UserAvatar profile={stream.host} linked={false} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{stream.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {displayName(stream.host)}
                      {stream.started_at
                        ? ` · started ${timeAgo(stream.started_at)}`
                        : ""}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase text-destructive-foreground">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    Live
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-bold">Recent broadcasts</h2>
        {rest.length === 0 && liveNow.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Nobody is live yet. Be the first — hit{" "}
              <span className="font-medium text-primary">Go live</span>!
            </CardContent>
          </Card>
        ) : (
          rest.map((stream) => (
            <Link key={stream.id} href={`/live/${stream.id}`} className="block">
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-3 p-4">
                  <UserAvatar profile={stream.host} linked={false} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{stream.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {displayName(stream.host)} · {timeAgo(stream.created_at)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                    {stream.status === "ended" ? "Ended" : "Waiting"}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
