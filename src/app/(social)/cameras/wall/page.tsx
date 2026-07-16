import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CameraWall } from "@/components/cctv/camera-wall";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { getMyCameras } from "@/lib/db/cctv";

export const metadata = { title: "Camera wall" };
export const dynamic = "force-dynamic";

/** Live multi-camera wall — all of the owner's cameras playing at once. */
export default async function CameraWallPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [t, cameras] = await Promise.all([
    getTranslations("cctv"),
    getMyCameras(profile.id),
  ]);

  // Only the fields the client wall needs — never the private rtsp_url.
  const wallCameras = cameras.map((c) => ({
    id: c.id,
    title: c.title,
    camera_type: c.camera_type,
    hls_url: c.hls_url,
  }));

  return (
    <div className="space-y-4">
      <Link
        href="/cameras"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("title")}
      </Link>

      <h1 className="flex items-center gap-2 text-xl font-bold">
        <LayoutGrid className="h-5 w-5 text-primary" /> {t("wallTitle")}
      </h1>

      {wallCameras.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t("emptyHint")}
          </CardContent>
        </Card>
      ) : (
        <CameraWall cameras={wallCameras} />
      )}
    </div>
  );
}
