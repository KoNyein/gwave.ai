import Link from "next/link";
import { Lock, Video } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CameraPlayer } from "@/components/cctv/camera-player";
import { HlsPlayer } from "@/components/cctv/hls-player";
import { KvsPlayer } from "@/components/cctv/kvs-player";
import { getSharedCamera } from "@/lib/db/cctv";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live camera" };

/**
 * Public share page for a camera. Access is enforced by Row Level Security:
 * getSharedCamera only returns a row when the camera is public (and any
 * temporary-share window is still open), or when the viewer is its owner.
 * Anyone else — including an anonymous visitor with a leaked link — gets null,
 * so we show a neutral "private or unavailable" message.
 */
export default async function WatchPage({
  params,
}: {
  params: { token: string };
}) {
  const t = await getTranslations("cctv");
  const camera = await getSharedCamera(params.token);

  if (!camera) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">{t("unavailableTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("unavailableHint")}</p>
        <Link href="/" className="text-sm text-primary hover:underline">
          {t("backHome")}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Video className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold">{camera.title}</h1>
      </div>
      {camera.camera_type === "kvs" ? (
        <KvsPlayer token={params.token} title={camera.title} />
      ) : camera.hls_url ? (
        <HlsPlayer src={camera.hls_url} title={camera.title} />
      ) : (
        <CameraPlayer streamId={camera.stream_id} title={camera.title} />
      )}
      <p className="text-center text-xs text-muted-foreground">
        {t("sharedFooter")}
      </p>
    </main>
  );
}
