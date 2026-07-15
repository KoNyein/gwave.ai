"use client";

import * as React from "react";
import { Check, Loader2, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { shareCameraWithGroup } from "@/lib/actions/cctv";
import { cn } from "@/lib/utils";

/**
 * Owner control: pick which of your groups can watch this camera. Every member
 * of a checked group gets access to the live feed (via /watch); unchecking
 * revokes it.
 */
export function CameraGroupShare({
  cameraId,
  groups,
  sharedIds,
}: {
  cameraId: string;
  groups: { id: string; name: string }[];
  sharedIds: string[];
}) {
  const t = useTranslations("cctv");
  const [shared, setShared] = React.useState<Set<string>>(
    () => new Set(sharedIds),
  );
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function toggle(groupId: string) {
    const willShare = !shared.has(groupId);
    setBusy(groupId);
    setError(null);
    const res = await shareCameraWithGroup({ cameraId, groupId, share: willShare });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setShared((prev) => {
      const next = new Set(prev);
      if (willShare) next.add(groupId);
      else next.delete(groupId);
      return next;
    });
  }

  if (groups.length === 0) return null;

  return (
    <div className="rounded-xl border p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Users className="h-4 w-4 text-primary" /> {t("shareGroupsTitle")}
      </p>
      <p className="mb-2 text-xs text-muted-foreground">{t("shareGroupsHint")}</p>
      <div className="flex flex-wrap gap-1.5">
        {groups.map((g) => {
          const on = shared.has(g.id);
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => toggle(g.id)}
              disabled={busy !== null}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                on
                  ? "border-primary bg-primary/10 text-primary"
                  : "hover:bg-muted",
              )}
            >
              {busy === g.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : on ? (
                <Check className="h-3 w-3" />
              ) : null}
              {g.name}
            </button>
          );
        })}
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
