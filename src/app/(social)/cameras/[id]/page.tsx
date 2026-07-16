import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Radio, Upload } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CameraClips } from "@/components/cctv/camera-clips";
import { CameraGroupShare } from "@/components/cctv/camera-group-share";
import { CameraHlsForm } from "@/components/cctv/camera-hls-form";
import { CameraPlayer } from "@/components/cctv/camera-player";
import { KvsPlayer } from "@/components/cctv/kvs-player";
import { PtzControls } from "@/components/cctv/ptz-controls";
import { CameraShareControls } from "@/components/cctv/camera-share-controls";
import { HlsPlayer } from "@/components/cctv/hls-player";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { publishUrl } from "@/lib/cctv-player";
import {
  getCameraAlerts,
  getCameraClips,
  getCameraGroupShareIds,
  getMyCamera,
} from "@/lib/db/cctv";
import { getMyGroups } from "@/lib/db/groups";
import { publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Camera" };

export default async function CameraDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [t, camera] = await Promise.all([
    getTranslations("cctv"),
    getMyCamera(profile.id, params.id),
  ]);
  if (!camera) notFound();

  const publish =
    camera.camera_type === "webrtc" ? publishUrl(camera.stream_id) : null;

  // Recordings + alerts (KVS cameras record in-browser).
  const [clips, alerts] =
    camera.camera_type === "kvs"
      ? await Promise.all([
          getCameraClips(camera.id),
          getCameraAlerts(camera.id),
        ])
      : [[], []];

  // Group sharing: the owner's groups + which ones this camera is shared with.
  const [myGroups, sharedGroupIds] = await Promise.all([
    getMyGroups(profile.id),
    getCameraGroupShareIds(camera.id),
  ]);

  return (
    <div className="space-y-4">
      <Link
        href="/cameras"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("title")}
      </Link>

      <h1 className="text-xl font-bold">{camera.title}</h1>

      {camera.camera_type === "kvs" ? (
        <KvsPlayer
          id={camera.id}
          title={camera.title}
          shareUserId={profile.id}
        />
      ) : camera.hls_url ? (
        <HlsPlayer src={camera.hls_url} title={camera.title} />
      ) : (
        <CameraPlayer streamId={camera.stream_id} title={camera.title} />
      )}

      {camera.ptz_url ? <PtzControls cameraId={camera.id} /> : null}

      <CameraHlsForm id={camera.id} hlsUrl={camera.hls_url} />

      {publish ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-medium">{t("publishTitle")}</p>
          <p className="mb-2 text-xs text-muted-foreground">{t("publishHint")}</p>
          <Button asChild size="sm" variant="outline">
            <a href={publish} target="_blank" rel="noopener noreferrer">
              <Upload className="mr-1 h-4 w-4" /> {t("openPublisher")}
            </a>
          </Button>
        </div>
      ) : null}

      {camera.camera_type === "rtsp" ? (
        <div className="rounded-xl border p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Radio className="h-4 w-4 text-primary" /> {t("rtspSourceTitle")}
          </p>
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
            {camera.rtsp_url}
          </p>
        </div>
      ) : null}

      {camera.camera_type === "kvs" ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Radio className="h-4 w-4 text-primary" /> {t("kvsChannelTitle")}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {camera.kvs_channel}
            {camera.kvs_region ? ` · ${camera.kvs_region}` : ""}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{t("kvsMasterHint")}</p>
        </div>
      ) : null}

      {camera.camera_type === "kvs" ? (
        <CameraClips clips={clips} alerts={alerts} />
      ) : null}

      <CameraGroupShare
        cameraId={camera.id}
        groups={myGroups.map((g) => ({ id: g.id, name: g.name }))}
        sharedIds={sharedGroupIds}
      />

      <CameraShareControls
        id={camera.id}
        isPublic={camera.is_public}
        publicUntil={camera.public_until}
        shareToken={camera.share_token}
        baseUrl={publicEnv.NEXT_PUBLIC_SITE_URL}
      />
    </div>
  );
}
