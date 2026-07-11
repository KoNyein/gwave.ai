"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ImagePlus, Loader2, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "@/lib/actions/profile";
import { mediaUrl, uploadMedia } from "@/lib/media";
import { PRESENCE, PRESENCE_ORDER } from "@/lib/presence";
import { cn } from "@/lib/utils";
import type { PresenceStatus, Profile } from "@/types/database";

export function ProfileEditor({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [fullName, setFullName] = React.useState(profile.full_name ?? "");
  const [bio, setBio] = React.useState(profile.bio ?? "");
  const [avatar, setAvatar] = React.useState(profile.avatar_url);
  const [cover, setCover] = React.useState(profile.cover_url);
  const [status, setStatus] = React.useState<PresenceStatus>(
    profile.presence_status ?? "available",
  );
  const [busyField, setBusyField] = React.useState<"avatar" | "cover" | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function pick(kind: "avatar" | "cover", file: File) {
    setBusyField(kind);
    setError(null);
    try {
      const up = await uploadMedia(profile.id, file);
      if (up.media_type !== "image") throw new Error("ဓာတ်ပုံ ဖိုင်သာ ရပါတယ်။");
      const url = mediaUrl(up.storage_path);
      if (kind === "avatar") setAvatar(url);
      else setCover(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload မအောင်မြင်ပါ။");
    } finally {
      setBusyField(null);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await updateProfile({
      full_name: fullName.trim() || null,
      bio: bio.trim() || null,
      avatar_url: avatar,
      cover_url: cover,
      presence_status: status,
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="space-y-4">
      {/* Cover + avatar */}
      <div className="relative">
        <div
          className="h-28 w-full rounded-xl bg-gradient-to-r from-primary to-accent sm:h-36"
          style={
            cover
              ? { backgroundImage: `url(${cover})`, backgroundSize: "cover", backgroundPosition: "center" }
              : undefined
          }
        />
        <label className="absolute right-2 top-2 inline-flex cursor-pointer items-center gap-1 rounded-lg bg-background/80 px-2 py-1 text-xs font-medium hover:bg-background">
          {busyField === "cover" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImagePlus className="h-3.5 w-3.5" />
          )}
          Cover
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pick("cover", f);
              e.target.value = "";
            }}
          />
        </label>

        <div className="absolute -bottom-8 left-4">
          <label className="group relative block h-20 w-20 cursor-pointer overflow-hidden rounded-full border-4 border-background bg-muted">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                <User className="h-8 w-8" />
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
              {busyField === "avatar" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Camera className="h-5 w-5" />
              )}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pick("avatar", f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      <div className="space-y-3 pt-8">
        <div className="space-y-1.5">
          <Label htmlFor="pe-name">အမည်</Label>
          <Input
            id="pe-name"
            value={fullName}
            maxLength={80}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pe-bio">ကိုယ်ရေးအကျဉ်း (bio)</Label>
          <textarea
            id="pe-bio"
            value={bio}
            maxLength={500}
            rows={2}
            onChange={(e) => setBio(e.target.value)}
            className="w-full resize-none rounded-md border bg-background p-2 text-sm"
          />
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <Label>Status</Label>
          <div className="flex flex-wrap gap-1.5">
            {PRESENCE_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm",
                  status === s ? "border-primary bg-primary/10" : "text-muted-foreground",
                )}
              >
                <span className={cn("h-2.5 w-2.5 rounded-full", PRESENCE[s].dot)} />
                {PRESENCE[s].emoji} {PRESENCE[s].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">❌ {error}</p> : null}

      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? (
          <>
            <Loader2 className="mr-1 h-4 w-4 animate-spin" /> သိမ်းနေသည်…
          </>
        ) : saved ? (
          <>
            <Check className="mr-1 h-4 w-4" /> သိမ်းပြီးပါပြီ
          </>
        ) : (
          "သိမ်းမည်"
        )}
      </Button>
    </div>
  );
}
