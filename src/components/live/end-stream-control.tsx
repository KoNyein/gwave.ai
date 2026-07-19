"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, Save, Square, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveLiveWrapPost } from "@/lib/actions/live";

/**
 * The host's always-visible End control, drawn ON the video (top area) so it
 * never hides below the fold. Ending asks what to do with the broadcast:
 *   💾 သိမ်းမယ်  — end the stream, keep it (replay when recording is on) and
 *                  drop a wrap-up post with optional 📍 location + 👥 tags
 *   🗑 ဖျက်မယ်   — end and delete the stream entirely
 */
export function EndStreamControl({ streamId }: { streamId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<null | "save" | "delete">(null);
  const [location, setLocation] = React.useState("");
  const [friends, setFriends] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const endSave = async () => {
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(`/api/live/${streamId}/end`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to end the stream.");
      // Wrap-up post is best-effort — ending already succeeded.
      await saveLiveWrapPost(streamId, location, friends).catch(() => undefined);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to end the stream.");
      setBusy(null);
    }
  };

  const endDelete = async () => {
    setBusy("delete");
    setError(null);
    try {
      await fetch(`/api/live/${streamId}/end`, { method: "POST" }).catch(
        () => undefined,
      );
      const res = await fetch(`/api/live/${streamId}/delete`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to delete the stream.");
      router.push("/live");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete the stream.");
      setBusy(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pointer-events-auto flex items-center gap-1 rounded-full bg-destructive px-3 py-1 text-xs font-bold text-destructive-foreground shadow-lg"
      >
        <Square className="h-3 w-3" /> ပိတ်မယ်
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-background p-5 shadow-2xl">
            <div>
              <h2 className="text-base font-bold">Live ကို ပိတ်မလား?</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                သိမ်းရင် feed မှာ post တင်ပေးပြီး replay (recording ဖွင့်ထားရင်)
                ကြည့်လို့ရပါမယ်။ ဖျက်ရင် ဒီ Live လုံးဝ ပျောက်သွားပါမယ်။
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="📍 နေရာ tag (မထည့်လည်းရ)"
                  maxLength={120}
                />
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  value={friends}
                  onChange={(e) => setFriends(e.target.value)}
                  placeholder="👥 သူငယ်ချင်း tag — username များ (space ခြား)"
                  maxLength={200}
                />
              </div>
            </div>

            {error ? <p className="text-xs text-destructive">{error}</p> : null}

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={endSave} disabled={busy !== null}>
                {busy === "save" ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1 h-4 w-4" />
                )}
                သိမ်းပြီး ပိတ်မယ်
              </Button>
              <Button
                variant="destructive"
                onClick={endDelete}
                disabled={busy !== null}
              >
                {busy === "delete" ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-1 h-4 w-4" />
                )}
                ဖျက်ပြီး ပိတ်မယ်
              </Button>
            </div>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setOpen(false)}
              disabled={busy !== null}
            >
              မပိတ်သေးပါ — ဆက်လွှင့်မယ်
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
