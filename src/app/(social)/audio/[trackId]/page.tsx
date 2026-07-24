import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, Headphones, Music2, Radio } from "lucide-react";

import { AudioFeatures } from "@/components/audio/audio-features";
import { AudioHelpForm } from "@/components/audio/audio-help-form";
import { AudioPlayer } from "@/components/audio/audio-player";
import { AudioPurchase } from "@/components/audio/audio-purchase";
import { AudioRating, RatingSummary } from "@/components/audio/audio-rating";
import { AudioShare } from "@/components/audio/audio-share";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import {
  getMyRating,
  getRatingStats,
  getResume,
  getTrackDetail,
  isEntitled,
} from "@/lib/db/audio";

export const dynamic = "force-dynamic";

export default async function AudioTrackPage({
  params,
}: {
  params: Promise<{ trackId: string }>;
}) {
  const { trackId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [t, detail] = await Promise.all([
    getTranslations("audio"),
    getTrackDetail(trackId),
  ]);
  if (!detail) notFound();

  const [entitled, resume, ratingStats, myRating] = await Promise.all([
    isEntitled(trackId),
    getResume(profile.id, trackId),
    getRatingStats(trackId),
    getMyRating(profile.id, trackId),
  ]);

  const { track, music, podcast, audiobook, chapters } = detail;

  const subtitle = music
    ? music.artist + (music.album ? ` · ${music.album}` : "")
    : audiobook
      ? t("by", { name: audiobook.author }) +
        (audiobook.narrator ? ` · ${t("narratedBy", { name: audiobook.narrator })}` : "")
      : podcast
        ? podcast.episode_no
          ? t("episode", { n: podcast.episode_no })
          : ""
        : "";

  const KindIcon =
    track.kind === "music" ? Music2 : track.kind === "podcast" ? Radio : Headphones;

  const showBuy = track.is_premium && !entitled;

  return (
    <div className="space-y-5">
      <Link
        href="/audio"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> {t("back")}
      </Link>

      {/* Header */}
      <div className="flex gap-4">
        <div className="relative aspect-square w-28 shrink-0 overflow-hidden rounded-lg bg-muted sm:w-36">
          {track.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={track.cover_url}
              alt={track.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <KindIcon className="h-10 w-10" />
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            <KindIcon className="h-3 w-3" />
            {track.kind === "music"
              ? t("tabMusic")
              : track.kind === "podcast"
                ? t("tabPodcasts")
                : t("tabAudiobooks")}
          </span>
          <h1 className="text-lg font-bold leading-tight">{track.title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          <RatingSummary avg={ratingStats.avg} count={ratingStats.count} />
          {track.is_premium ? (
            entitled ? (
              <span className="inline-block rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                {t("owned")}
              </span>
            ) : (
              <span className="inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                {t("premium")}
              </span>
            )
          ) : (
            <span className="inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {t("free")}
            </span>
          )}
        </div>
      </div>

      {/* Purchase (premium & not yet entitled) */}
      {showBuy && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-sm text-muted-foreground">{t("premiumLocked")}</p>
            <AudioPurchase trackId={track.id} price={track.price} currency={track.currency} />
          </CardContent>
        </Card>
      )}

      {/* Player */}
      <AudioPlayer
        trackId={track.id}
        audioUrl={track.audio_url}
        durationS={track.duration_s}
        chapters={chapters}
        entitled={entitled}
        resumePosition={resume?.position_s ?? 0}
        resumeSpeed={resume?.speed ?? 1}
        lyrics={detail.lyrics}
      />

      {/* Audio features (tempo / key / etc) */}
      <AudioFeatures
        track={track}
        labels={{
          bpm: t("bpm"),
          key: t("key"),
          timeSig: t("timeSig"),
          mood: t("mood"),
          year: t("year"),
        }}
      />

      {/* Share: native / QR / NFC */}
      <AudioShare title={track.title} />

      {/* Rate this title (once you can play it) */}
      {entitled && <AudioRating trackId={track.id} mine={myRating} />}

      {/* Description / show notes */}
      {(track.description || podcast?.show_notes) && (
        <section className="space-y-1">
          <h2 className="text-sm font-semibold">
            {podcast ? t("showNotes") : t("about")}
          </h2>
          <p className="whitespace-pre-line text-sm text-muted-foreground">
            {podcast?.show_notes || track.description}
          </p>
        </section>
      )}

      {/* Metadata chips */}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {music?.genre && <Chip>{music.genre}</Chip>}
        {music?.isrc && <Chip>ISRC {music.isrc}</Chip>}
        {audiobook?.isbn && <Chip>ISBN {audiobook.isbn}</Chip>}
        {audiobook?.publisher && <Chip>{audiobook.publisher}</Chip>}
        {track.transcript_url && (
          <a
            href={track.transcript_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-muted px-2 py-0.5 font-medium text-primary hover:underline"
          >
            {t("transcript")}
          </a>
        )}
      </div>

      {/* Help */}
      <details className="group rounded-lg border border-border bg-background/50">
        <summary className="cursor-pointer list-none p-3 text-sm font-semibold">
          {t("helpTitle")}
        </summary>
        <div className="space-y-2 border-t border-border p-3 text-sm text-muted-foreground">
          <p><span className="font-medium text-foreground">1. {t("helpDiscoverT")}</span> {t("helpDiscoverB")}</p>
          <p><span className="font-medium text-foreground">2. {t("helpBuyT")}</span> {t("helpBuyB")}</p>
          <p><span className="font-medium text-foreground">3. {t("helpPlayerT")}</span> {t("helpPlayerB")}</p>
          <p><span className="font-medium text-foreground">4. {t("helpOfflineT")}</span> {t("helpOfflineB")}</p>
          <p><span className="font-medium text-foreground">5. {t("helpSupportT")}</span> {t("helpSupportB")}</p>
          <div className="border-t border-border pt-3">
            <AudioHelpForm trackId={track.id} />
          </div>
        </div>
      </details>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-muted px-2 py-0.5">{children}</span>;
}
