import Link from "next/link";
import { redirect } from "next/navigation";
import { Globe, LayoutGrid, Lock, Radio, Video } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AddCameraForm } from "@/components/cctv/add-camera-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { getMyCameras } from "@/lib/db/cctv";

export const metadata = { title: "Cameras" };
export const dynamic = "force-dynamic";

export default async function CamerasPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [t, cameras] = await Promise.all([
    getTranslations("cctv"),
    getMyCameras(profile.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Video className="h-5 w-5 text-primary" /> {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {cameras.length > 0 ? (
            <Button asChild size="sm" variant="outline">
              <Link href="/cameras/wall">
                <LayoutGrid className="mr-1 h-4 w-4" /> {t("wallTitle")}
              </Link>
            </Button>
          ) : null}
          <AddCameraForm />
        </div>
      </div>

      {cameras.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <Radio className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">{t("emptyTitle")}</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t("emptyHint")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cameras.map((cam) => {
            const expired = cam.public_until
              ? new Date(cam.public_until).getTime() < Date.now()
              : false;
            const live = cam.is_public && !expired;
            return (
              <Link key={cam.id} href={`/cameras/${cam.id}`}>
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardContent className="flex h-full flex-col gap-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">{cam.title}</span>
                      {live ? (
                        <Globe className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t(`type_${cam.camera_type}`)}
                    </p>
                    <p className="mt-auto text-xs text-muted-foreground">
                      {live ? t("statusPublic") : t("statusPrivate")}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
