import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Radio, Upload } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CameraPlayer } from "@/components/cctv/camera-player";
import { CameraShareControls } from "@/components/cctv/camera-share-controls";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { publishUrl } from "@/lib/cctv-player";
import { getMyCamera } from "@/lib/db/cctv";
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

  return (
    <div className="space-y-4">
      <Link
        href="/cameras"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("title")}
      </Link>

      <h1 className="text-xl font-bold">{camera.title}</h1>

      <CameraPlayer streamId={camera.stream_id} title={camera.title} />

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
