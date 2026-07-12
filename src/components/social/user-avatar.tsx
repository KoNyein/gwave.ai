import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { PRESENCE } from "@/lib/presence";
import { cn } from "@/lib/utils";
import type { PresenceStatus } from "@/types/database";
import type { AuthorSummary } from "@/types/social";

export function UserAvatar({
  profile,
  className,
  linked = true,
  status,
}: {
  /** Nullable: a deleted/hidden profile renders a plain placeholder. */
  profile: AuthorSummary | null | undefined;
  className?: string;
  linked?: boolean;
  /** Optional presence badge shown at the avatar's corner. */
  status?: PresenceStatus | null;
}) {
  const showDot = status && status !== "invisible";
  const avatar = (
    <span className="relative inline-block shrink-0">
      <Avatar className={cn("h-10 w-10", className)}>
        {profile?.avatar_url ? (
          <AvatarImage src={profile.avatar_url} alt="" />
        ) : null}
        <AvatarFallback>{profile ? initials(profile) : "U"}</AvatarFallback>
      </Avatar>
      {showDot ? (
        <span
          className={cn(
            "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
            PRESENCE[status].dot,
          )}
          title={PRESENCE[status].label}
        />
      ) : null}
    </span>
  );

  if (linked && profile?.username) {
    return (
      <Link href={`/u/${profile.username}`} className="shrink-0">
        {avatar}
      </Link>
    );
  }
  return avatar;
}
