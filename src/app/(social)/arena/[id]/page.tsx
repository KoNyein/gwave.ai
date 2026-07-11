import { notFound, redirect } from "next/navigation";

import { KyarSpectator } from "@/components/messenger/kyar-spectator";
import { WagerSpectator } from "@/components/messenger/wager-spectator";
import { getCurrentProfile } from "@/lib/auth";
import { getWager } from "@/lib/db/wagers";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Live Match" };
export const dynamic = "force-dynamic";

export default async function ArenaMatchPage({
  params,
}: {
  params: { id: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const wager = await getWager(params.id);
  // Only a live, in-progress match is watchable by spectators.
  if (!wager || !wager.is_live || wager.status !== "active") notFound();

  const supabase = await createClient();
  const [{ data: host }, { data: guest }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, username, avatar_url")
      .eq("id", wager.host_id)
      .maybeSingle(),
    wager.guest_id
      ? supabase
          .from("profiles")
          .select("full_name, username, avatar_url")
          .eq("id", wager.guest_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const spectatorProps = {
    wagerId: wager.id,
    potMmk: wager.pot_mmk,
    stakeMmk: wager.stake_mmk,
    hostName: host?.full_name || host?.username || "Host",
    guestName: guest?.full_name || guest?.username || "Guest",
  };

  return (
    <div className="mx-auto max-w-md space-y-4">
      {wager.game === "kyar" ? (
        <KyarSpectator {...spectatorProps} />
      ) : (
        <WagerSpectator {...spectatorProps} />
      )}
    </div>
  );
}
