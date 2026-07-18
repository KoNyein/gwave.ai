import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { DoubleTapHeart } from "@/components/live/double-tap-heart";
import { HostPanel } from "@/components/live/host-panel";
import { LiveChat, type ChatEntry } from "@/components/live/live-chat";
import { LiveGifts } from "@/components/live/live-gifts";
import { LivePlayer } from "@/components/live/live-player";
import { LiveStage } from "@/components/live/live-stage";
import { LiveSaleManager } from "@/components/live/live-sale-manager";
import { LiveSalePanel } from "@/components/live/live-sale-panel";
import { ReactionBar } from "@/components/live/reaction-bar";
import { TopGifters } from "@/components/live/top-gifters";
import { StreamStatusWatcher } from "@/components/live/stream-status-watcher";
import { ViewerCount } from "@/components/live/viewer-count";
import { UserAvatar } from "@/components/social/user-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { currencyToGpay, toRateMap } from "@/lib/currency";
import { getActiveCurrencies } from "@/lib/db/currency";
import { getMyGpayAccount } from "@/lib/db/gpay";
import { getRecentChat, getStream, getStreamKey } from "@/lib/db/live";
import {
  getLiveGifts,
  getStreamGiftTotal,
  getTopGifters,
} from "@/lib/db/live-gifts";
import { GameGoalBar } from "@/components/live/game-goal-bar";
import {
  getLiveProducts,
  getMySellableProducts,
} from "@/lib/db/live-products";
import { createClient } from "@/lib/supabase/server";
import { displayName, timeAgo } from "@/lib/format";
import { MUX_RTMP_URL } from "@/lib/mux";

export const dynamic = "force-dynamic";

const uuid = z.string().uuid();

export default async function LiveStreamPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  if (!uuid.safeParse(params.id).success) notFound();

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const stream = await getStream(params.id);
  if (!stream) notFound();

  const isHost = stream.host_id === profile.id;
  // LiveKit streams broadcast from the browser (no RTMP key); Mux streams
  // ingest from OBS via a key.
  const isLivekit = Boolean(stream.livekit_room);
  // RLS returns the key only to the host; null for everyone else.
  const streamKey = isHost && !isLivekit ? await getStreamKey(stream.id) : null;
  const chat = (await getRecentChat(stream.id)) as ChatEntry[];

  // Live Sale — products pinned to this stream, and (for buyers) their G-Pay
  // price/eligibility. Buying reuses the dropship + G-Pay order path.
  const liveProducts = await getLiveProducts(stream.id);
  const gpayByProduct: Record<
    string,
    { unitPrice: number; balance: number } | null
  > = {};
  const buyable = liveProducts.filter(
    (p) => p.kind === "dropship" && p.price != null,
  );
  if (buyable.length > 0) {
    const [myGpay, currencies] = await Promise.all([
      getMyGpayAccount(),
      getActiveCurrencies(),
    ]);
    if (myGpay?.status === "active") {
      const rates = toRateMap(currencies);
      const balance = Number(myGpay.balance);
      for (const p of buyable) {
        const unit = currencyToGpay(p.price as number, p.currency, rates);
        gpayByProduct[p.id] =
          unit != null && unit > 0 ? { unitPrice: unit, balance } : null;
      }
    }
  }
  const myProducts = isHost ? await getMySellableProducts(profile.id) : [];
  const pinnedIds = liveProducts.map((p) => p.id);

  // Live gifts (G-Pay powered) + top supporters + goal progress.
  const [liveGifts, topGifters, giftTotal] = await Promise.all([
    getLiveGifts(),
    getTopGifters(stream.id),
    getStreamGiftTotal(stream.id),
  ]);
  const giftSupabase = await createClient();
  const { data: myGpayGift } = await giftSupabase
    .from("gpay_accounts")
    .select("status")
    .eq("user_id", profile.id)
    .maybeSingle<{ status: string }>();
  const canGift = myGpayGift?.status === "active" && !isHost;
  let giftHasPin = false;
  if (canGift) {
    const { data } = await giftSupabase.rpc("gpay_has_pin");
    giftHasPin = data === true;
  }

  const currentUser = {
    id: profile.id,
    username: profile.username,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
  };

  return (
    <div className="space-y-4">
      <StreamStatusWatcher streamId={stream.id} />

      <Link
        href="/live"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Live
      </Link>

      <div className="relative overflow-hidden rounded-xl">
        {isLivekit ? (
          <LiveStage
            streamId={stream.id}
            isHost={isHost}
            status={stream.status}
          />
        ) : (
          <LivePlayer
            playbackId={stream.mux_playback_id}
            status={stream.status}
            title={stream.title}
          />
        )}
        {stream.status === "live" ? (
          <DoubleTapHeart streamId={stream.id} userId={profile.id} />
        ) : null}
        <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
          {stream.status === "live" && (
            <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase text-destructive-foreground">
              Live
            </span>
          )}
          <ViewerCount streamId={stream.id} viewerId={profile.id} />
        </div>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <UserAvatar profile={stream.host} />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold">{stream.title}</h1>
            <p className="text-xs text-muted-foreground">
              {displayName(stream.host)} · {timeAgo(stream.created_at)}
            </p>
          </div>
        </div>
      </div>

      {stream.description && (
        <p className="text-sm text-muted-foreground">{stream.description}</p>
      )}

      <div className="flex items-center gap-1">
        <ReactionBar
          streamId={stream.id}
          userId={profile.id}
          disabled={stream.status === "ended"}
        />
        <LiveGifts
          streamId={stream.id}
          gifts={liveGifts}
          hasPin={giftHasPin}
          canGift={canGift}
        />
      </div>

      <GameGoalBar
        streamId={stream.id}
        isHost={isHost}
        gameName={stream.game_name ?? null}
        goalAmount={stream.goal_amount ?? null}
        goalLabel={stream.goal_label ?? null}
        gifted={giftTotal}
      />

      <TopGifters gifters={topGifters} />

      {isHost && (
        <HostPanel
          streamId={stream.id}
          status={stream.status}
          rtmpUrl={MUX_RTMP_URL}
          streamKey={streamKey}
        />
      )}

      {/* Live Sale — viewers buy pinned products; host manages the pins */}
      <LiveSalePanel products={liveProducts} gpayByProduct={gpayByProduct} />
      {isHost && (
        <LiveSaleManager
          streamId={stream.id}
          myProducts={myProducts}
          pinnedIds={pinnedIds}
        />
      )}

      <Card className="overflow-hidden">
        <CardContent className="h-96 p-0">
          <LiveChat
            streamId={stream.id}
            currentUser={currentUser}
            initialMessages={chat}
            disabled={stream.status === "ended"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
