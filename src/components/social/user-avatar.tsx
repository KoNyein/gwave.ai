import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AuthorSummary } from "@/types/social";

export function UserAvatar({
  profile,
  className,
  linked = true,
}: {
  profile: AuthorSummary;
  className?: string;
  linked?: boolean;
}) {
  const avatar = (
    <Avatar className={cn("h-10 w-10", className)}>
      {profile.avatar_url ? (
        <AvatarImage src={profile.avatar_url} alt="" />
      ) : null}
      <AvatarFallback>{initials(profile)}</AvatarFallback>
    </Avatar>
  );

  if (linked && profile.username) {
    return (
      <Link href={`/u/${profile.username}`} className="shrink-0">
        {avatar}
      </Link>
    );
  }
  return avatar;
}
