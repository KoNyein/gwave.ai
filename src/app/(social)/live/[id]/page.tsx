import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Radio } from "lucide-react";
import { z } from "zod";

import { DoubleTapHeart } from "@/components/live/double-tap-heart";
import { EndStreamControl } from "@/components/live/end-stream-control";
import { HostPanel } from "@/components/live/host-panel";
import { LiveChat, type ChatEntry } from "@/components/live/live-chat";
import { LiveOverlay } from "@/components/live/live-overlay";
import { LiveGifts } from "@/components/live/live-gifts";
import { LivePlayer } from "@/components/live/live-player";
import { AgoraStage } from "@/components/live/agora-stage";
import { IvsStage } from "@/components/live/ivs-stage";
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
import { createClient } from "@/lib/data/server";
import { displayName, liveStreamTitle, timeAgo } from "@/lib/format";
import { agoraRecordingUrl } from "@/lib/agora";
import { isIvsChannelLive, latestIvsRecordingPath } from "@/lib/ivs";
import { ivsRecordingUrl } from "@/lib/ivs-realtime";
import { recordingPlaybackUrl } from "@/lib/livekit";
import { mediaUrl } from "@/lib/media-url";
import { createAdminClient } from "@/lib/data/admin";
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
  // Provider per stream: Agora (managed WebRTC) or LiveKit broadcast from the
  // browser (no RTMP key); IVS and Mux ingest RTMP(S) from OBS via a key.
  const isAgora = Boolean(stream.agora_channel);
  const isLivekit = Boolean(stream.livekit_room);
  const isIvs = Boolean(stream.ivs_channel_arn);
  const isIvsStage = Boolean(stream.ivs_stage_arn);
  const isBrowserLive = isAgora || isLivekit || isIvsStage;

  // IVS has no webhook into the app (yet — that needs EventBridge), so an idle
  // IVS stream checks the channel on page view: once OBS starts pushing, the
  // next visit flips it live for everyone. Cheap (one GetStream) and only for
  // idle IVS streams.
  if (isIvs && stream.status === "idle" && stream.ivs_channel_arn) {
    if (await isIvsChannelLive(stream.ivs_channel_arn)) {
      const admin = createAdminClient();
      await admin
        .from("live_streams")
        .update({
          status: "live",
          started_at: stream.started_at ?? new Date().toISOString(),
        })
        .eq("id", stream.id)
        .eq("status", "idle");
      stream.status = "live";
    }
  }
  // …and the reverse: a "live" IVS stream whose channel is actually offline is
  // a broadcast that died without ending — viewers got a broken "Source Not
  // Supported" player. Mark it ended (linking the recording when one exists)
  // so the page renders the ended/replay state instead.
  if (
    isIvs &&
    stream.status === "live" &&
    stream.ivs_channel_arn &&
    Date.now() - new Date(stream.created_at).getTime() > 3 * 60_000 &&
    !(await isIvsChannelLive(stream.ivs_channel_arn))
  ) {
    const recordingPath = await latestIvsRecordingPath(stream.ivs_channel_arn);
    const admin = createAdminClient();
    await admin
      .from("live_streams")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
        ...(recordingPath ? { recording_path: recordingPath } : {}),
      })
      .eq("id", stream.id)
      .eq("status", "live");
    stream.status = "ended";
    if (recordingPath) stream.recording_path = recordingPath;
  }
  // Auto-saved replay: an ended browser broadcast plays back its recording
  // instead of the "broadcast ended" placeholder. Egress recordings resolve via
  // their own base, Agora recordings via the Agora base, and both fall back to
  // the media CDN when a dedicated base isn't configured.
  const replayUrl =
    isBrowserLive && stream.status === "ended" && stream.recording_path
      ? (isIvsStage ? ivsRecordingUrl(stream.recording_path) : null) ??
        recordingPlaybackUrl(stream.recording_path) ??
        agoraRecordingUrl(stream.recording_path) ??
        mediaUrl(stream.recording_path)
      : null;
  // RLS returns the key only to the host; null for everyone else. Only Mux
  // (RTMP) streams have a stream key.
  const streamKey = isHost && !isBrowserLive ? await getStreamKey(stream.id) : null;
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
  const giftDb = await createClient();
  const { data: myGpayGift } = await giftDb
    .from("gpay_accounts")
    .select("status")
    .eq("user_id", profile.id)
    .maybeSingle<{ status: string }>();
  const canGift = myGpayGift?.status === "active" && !isHost;
  let giftHasPin = false;
  if (canGift) {
    const { data } = await giftDb.rpc("gpay_has_pin");
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

      {/*
        Twitch/YouTube-style layout on wide screens: video + host controls in
        the main column, chat in a tall sticky sidebar. On mobile the DOM order
        is video → header → CHAT → everything else, so the comment box sits
        right under the video instead of being buried below the sale panels.
      */}
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        {/* ── Video + header (main column, top) ────────────────────────── */}
        <div className="space-y-4 lg:col-span-2">
          <div
            className={`relative overflow-hidden rounded-xl ${
              stream.status !== "ended"
                ? "h-[calc(100dvh-9.5rem)] bg-black lg:h-auto"
                : ""
            }`}
          >
            {replayUrl ? (
              replayUrl.includes(".m3u8") ? (
                <LivePlayer
                  playbackId={null}
                  status={stream.status}
                  title={stream.title}
                  vodSrc={replayUrl}
                />
              ) : (
                <video
                  controls
                  playsInline
                  preload="metadata"
                  src={replayUrl}
                  className="mx-auto max-h-[80vh] w-full rounded-xl border bg-black"
                />
              )
            ) : isBrowserLive && stream.status === "ended" ? (
              // Ended browser broadcast with no saved replay: say so plainly
              // instead of a bare "ended" placeholder that reads as a blank
              // screen. A replay appears here automatically once recording is
              // enabled and the file finishes processing.
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border bg-muted px-6 text-center text-muted-foreground">
                <Radio className="h-8 w-8" />
                <p className="text-sm font-medium">
                  ဒီ Live ပြီးဆုံးသွားပါပြီ။
                </p>
                <p className="text-xs">
                  Replay မရနိုင်သေးပါ — recording ဖွင့်ထားမှ ပြန်ကြည့်လို့ရပါမည်။
                </p>
              </div>
            ) : isIvsStage ? (
              <IvsStage
                streamId={stream.id}
                isHost={isHost}
                status={stream.status}
              />
            ) : isAgora ? (
              <AgoraStage
                streamId={stream.id}
                isHost={isHost}
                status={stream.status}
              />
            ) : isLivekit ? (
              <LiveStage
                streamId={stream.id}
                isHost={isHost}
                status={stream.status}
              />
            ) : (
              <LivePlayer
                playbackId={stream.mux_playback_id}
                vodPlaybackId={stream.vod_playback_id}
                status={stream.status}
                title={stream.title}
                src={isIvs ? stream.ivs_playback_url : null}
                vodSrc={
                  isIvs && stream.status === "ended" && stream.recording_path
                    ? ivsRecordingUrl(stream.recording_path)
                    : null
                }
              />
            )}
            {stream.status === "live" ? (
              <>
                <LiveOverlay streamId={stream.id} currentUser={currentUser} />
                <DoubleTapHeart streamId={stream.id} userId={profile.id} />
              </>
            ) : null}
            <div className="absolute right-3 top-3 z-40 flex items-center gap-2">
              {stream.status === "live" && (
                <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase text-destructive-foreground">
                  Live
                </span>
              )}
              <ViewerCount streamId={stream.id} viewerId={profile.id} />
              {isHost && stream.status !== "ended" ? (
                <EndStreamControl streamId={stream.id} />
              ) : null}
            </div>

            {/* TikTok-style mobile chat: the comments + input ride ON the
                video over a bottom gradient (desktop keeps the sidebar). */}
            {stream.status !== "ended" ? (
              <>
                {/* Host/title chip, TikTok-style */}
                <div className="absolute left-3 top-3 z-20 max-w-[60%] rounded-full bg-black/50 px-3 py-1 lg:hidden">
                  <p className="truncate text-xs font-semibold text-white">
                    {liveStreamTitle(stream.title, stream.host)}
                  </p>
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 lg:hidden">
                  <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-8">
                    <div className="pointer-events-auto flex items-center justify-between px-2">
                      <ReactionBar
                        streamId={stream.id}
                        userId={profile.id}
                        disabled={false}
                        showFloaters={false}
                      />
                      <LiveGifts
                        streamId={stream.id}
                        gifts={liveGifts}
                        hasPin={giftHasPin}
                        canGift={canGift}
                      />
                    </div>
                    <div className="pointer-events-auto h-48">
                      <LiveChat
                        streamId={stream.id}
                        currentUser={currentUser}
                        initialMessages={chat}
                        overlay
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* Title + host + reactions grouped into one clean header card.
              While live on mobile everything rides on the video (one-screen
              TikTok layout), so this card is desktop-only until it ends. */}
          <Card className={stream.status !== "ended" ? "hidden lg:block" : ""}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <UserAvatar profile={stream.host} />
                  <div className="min-w-0">
                    <h1 className="truncate text-lg font-bold">
                      {liveStreamTitle(stream.title, stream.host)}
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      {displayName(stream.host)} · {timeAgo(stream.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <ReactionBar
                    streamId={stream.id}
                    userId={profile.id}
                    disabled={stream.status === "ended"}
                    showFloaters={stream.status !== "live"}
                  />
                  <LiveGifts
                    streamId={stream.id}
                    gifts={liveGifts}
                    hasPin={giftHasPin}
                    canGift={canGift}
                    disabled={stream.status === "ended"}
                  />
                </div>
              </div>

              {stream.description && (
                <p className="text-sm text-muted-foreground">
                  {stream.description}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Chat + top supporters: right sidebar on desktop, directly under
               the video on mobile ─────────────────────────────────────── */}
        <div
          className={`space-y-4 lg:sticky lg:top-4 lg:col-start-3 lg:row-start-1 lg:row-span-2 ${
            stream.status !== "ended" ? "hidden lg:block" : ""
          }`}
        >
          <Card className="overflow-hidden">
            <CardContent className="h-[22rem] p-0 lg:h-[calc(100vh-7rem)]">
              <LiveChat
                streamId={stream.id}
                currentUser={currentUser}
                initialMessages={chat}
                disabled={stream.status === "ended"}
              />
            </CardContent>
          </Card>

          <TopGifters gifters={topGifters} />
        </div>

        {/* ── Goal, host tools, Live Sale (main column, below) ─────────── */}
        <div className="space-y-4 lg:col-span-2 lg:col-start-1">
          <GameGoalBar
            streamId={stream.id}
            isHost={isHost}
            gameName={stream.game_name ?? null}
            goalAmount={stream.goal_amount ?? null}
            goalLabel={stream.goal_label ?? null}
            gifted={giftTotal}
          />

          {isHost && (
            <HostPanel
              streamId={stream.id}
              status={stream.status}
              rtmpUrl={isIvs ? stream.ivs_ingest_url ?? MUX_RTMP_URL : MUX_RTMP_URL}
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
        </div>
      </div>
    </div>
  );
}
