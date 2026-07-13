import Link from "next/link";
import { Camera, ChevronRight, Video } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Card, CardContent } from "@/components/ui/card";
import type { UserCamera } from "@/types/database";

/**
 * A compact row of the owner's cameras on the smart-home page, so a live view
 * is one tap away next to the switches — the private rtsp_url is never sent to
 * the client, only the title and a link to the guarded viewer.
 */
export async function HomeCameras({ cameras }: { cameras: UserCamera[] }) {
  const t = await getTranslations("home");
  if (cameras.length === 0) return null;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase text-muted-foreground">
          <Video className="h-4 w-4" /> {t("cameras")}
        </h2>
        <Link
          href="/cameras"
          className="flex items-center text-xs font-medium text-primary hover:underline"
        >
          {t("allCameras")}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cameras.map((camera) => (
          <Link key={camera.id} href={`/cameras/${camera.id}`}>
            <Card className="overflow-hidden transition-shadow hover:shadow-md">
              <div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground">
                <Camera className="h-8 w-8" />
              </div>
              <CardContent className="p-3">
                <p className="truncate text-sm font-medium">{camera.title}</p>
                <p className="text-xs text-muted-foreground">
                  {camera.camera_type === "rtsp" ? "CCTV" : t("cameraLive")}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
