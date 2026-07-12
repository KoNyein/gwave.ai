/** Compact relative time, Facebook-style: "5m", "3h", "2d", "Jan 5". */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));

  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** Money with its currency code, e.g. "1,200 THB". */
export function formatPrice(
  amount: number | null | undefined,
  currency: string,
): string {
  if (amount == null) return "";
  return `${amount.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })} ${currency}`;
}

/** Display name with username fallback; tolerates a missing profile. */
export function displayName(
  profile: {
    full_name: string | null;
    username: string | null;
  } | null | undefined,
): string {
  return profile?.full_name || profile?.username || "Unknown user";
}

export function initials(
  profile: {
    full_name: string | null;
    username: string | null;
  } | null | undefined,
): string {
  const source = profile?.full_name || profile?.username || "U";
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
