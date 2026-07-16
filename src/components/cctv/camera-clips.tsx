import {
  AlertTriangle,
  Bell,
  Film,
  ScanFace,
  Video as VideoIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Card, CardContent } from "@/components/ui/card";
import type { CameraAlert, CameraClip } from "@/lib/db/cctv";
import { mediaUrl } from "@/lib/media";

function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** Recorded clips + recent motion/face alerts for a camera (owner-only). */
export async function CameraClips({
  clips,
  alerts,
}: {
  clips: CameraClip[];
  alerts: CameraAlert[];
}) {
  const t = await getTranslations("cctv");

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {/* Recordings */}
      <Card>
        <CardContent className="space-y-2 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Film className="h-4 w-4 text-primary" /> {t("clipsTitle")}
          </p>
          {clips.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("noClips")}</p>
          ) : (
            <ul className="space-y-2">
              {clips.map((clip) => (
                <li
                  key={clip.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <VideoIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-xs">
                      {t(
                        clip.kind === "motion"
                          ? "clipMotion"
                          : clip.kind === "face"
                            ? "clipFace"
                            : "clipManual",
                      )}
                      {clip.duration_seconds ? ` · ${clip.duration_seconds}s` : ""}
                      {" · "}
                      {timeAgo(clip.created_at)}
                    </span>
                  </span>
                  <a
                    href={mediaUrl(clip.storage_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs font-medium text-primary hover:underline"
                  >
                    {t("watchClip")}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card>
        <CardContent className="space-y-2 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Bell className="h-4 w-4 text-primary" /> {t("alertsTitle")}
          </p>
          {alerts.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("noAlerts")}</p>
          ) : (
            <ul className="space-y-1.5">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-xs">
                  {a.kind === "face" ? (
                    <ScanFace className="h-4 w-4 shrink-0 text-sky-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                  )}
                  <span className="flex-1 truncate">
                    {t(a.kind === "face" ? "clipFace" : "clipMotion")}
                    {a.note ? ` · ${a.note}` : ""}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {timeAgo(a.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
