import { BadgeCheck } from "lucide-react";

import type { UserRole } from "@/types/database";

const MEMBER_ROLES: UserRole[] = [
  "member",
  "moderator",
  "developer",
  "admin",
  "super_admin",
];

/** Green check shown next to names of paying members (and staff). */
export function MemberBadge({ role }: { role?: UserRole }) {
  if (!role || !MEMBER_ROLES.includes(role)) return null;
  return (
    <BadgeCheck
      className="inline h-4 w-4 shrink-0 text-primary"
      aria-label="Member"
    />
  );
}
