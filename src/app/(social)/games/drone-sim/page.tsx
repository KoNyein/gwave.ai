import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";

import { DroneSim } from "@/components/games/drone-sim/DroneSim";
import { TRACKS } from "@/components/games/drone-sim/engine";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/data/server";

export const metadata = { title: "Drone Champions — FPV Simulator" };
export const dynamic = "force-dynamic";

interface Row {
  user_id: string;
  best_ms: number;
}
interface ReadClient {
  from(table: string): {
    select(cols: string): {
      eq(
        col: string,
        val: string,
      ): {
        order(
          col: string,
          opts: { ascending: boolean },
        ): { limit(n: number): PromiseLike<{ data: Row[] | null }> };
      };
    };
  };
}

interface Entry {
  name: string;
  avatar: string | null;
  ms: number;
}

function fmt(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

async function loadLeaderboards(): Promise<Record<string, Entry[]>> {
  const db = await createClient();
  const sb = db as unknown as ReadClient;
  const out: Record<string, Entry[]> = {};
  for (const track of TRACKS) {
    try {
      const { data } = await sb
        .from("drone_race_scores")
        .select("user_id,best_ms")
        .eq("track", track.name)
        .order("best_ms", { ascending: true })
        .limit(10);
      const rows = data ?? [];
      if (rows.length === 0) {
        out[track.name] = [];
        continue;
      }
      const ids = rows.map((r) => r.user_id);
      const { data: profiles } = await db
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", ids);
      const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));
      out[track.name] = rows.map((r) => {
        const p = byId.get(r.user_id);
        return {
          name:
            (p?.full_name as string) ||
            (p?.username as string) ||
            "Gwave pilot",
          avatar: (p?.avatar_url as string) ?? null,
          ms: r.best_ms,
        };
      });
    } catch {
      out[track.name] = [];
    }
  }
  return out;
}

export default async function DroneSimPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const boards = await loadLeaderboards();

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Link
          href="/games"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Games
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">🚁 Drone Champions</h1>
        <p className="text-sm text-muted-foreground">
          An FPV drone simulator you fly with your phone, a keyboard, or a
          controller — race the gates, beat your best lap, climb the league.
        </p>
      </div>

      <DroneSim />

      <div className="grid gap-4 sm:grid-cols-2">
        {TRACKS.map((t) => (
          <Card key={t.name}>
            <CardContent className="p-4">
              <p className="mb-2 flex items-center gap-2 font-semibold">
                <Trophy className="h-4 w-4 text-amber-500" /> {t.name}
              </p>
              {(boards[t.name] ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No times yet — set the first record!
                </p>
              ) : (
                <ol className="space-y-1 text-sm">
                  {(boards[t.name] ?? []).map((e, i) => (
                    <li
                      key={`${t.name}-${i}`}
                      className="flex items-center justify-between"
                    >
                      <span className="truncate">
                        {i + 1}. {e.name}
                      </span>
                      <span className="font-mono font-semibold">
                        {fmt(e.ms)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
