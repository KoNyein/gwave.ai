import Link from "next/link";
import { ChevronRight, UserPlus, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FriendButton } from "@/components/social/friend-button";
import { UserAvatar } from "@/components/social/user-avatar";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/data/server";
import { getFriends, getSuggestions } from "@/lib/db/friends";
import { displayName } from "@/lib/format";
import type { AuthorSummary } from "@/types/social";

/** Online = a heartbeat inside the last two minutes (same rule as the app). */
const ONLINE_WINDOW_MS = 2 * 60 * 1000;

/**
 * The right rail: people who actually exist.
 *
 * It used to render four invented pages and four invented contacts from a
 * hardcoded array — a brand-new account saw "Aung" and "Su Su" apparently
 * online and could tap neither. Both lists are real now: suggestions are
 * profiles with no friendship row to the viewer, contacts are accepted
 * friends, and the green dot means a heartbeat in the last two minutes rather
 * than decoration.
 */
export async function RightSidebar() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const t = await getTranslations("rightbar");
  const [suggestions, friends] = await Promise.all([
    getSuggestions(profile.id, 5),
    getFriends(profile.id),
  ]);

  // Presence in one flat query rather than widening the shared friendship
  // select — the friend list is read all over the app and doesn't need it.
  const online = new Set<string>();
  if (friends.length > 0) {
    const db = await createClient();
    const { data } = await db
      .from("profiles")
      .select("id, last_seen_at")
      .in(
        "id",
        friends.map((f) => f.id),
      )
      .returns<{ id: string; last_seen_at: string | null }[]>();
    const cutoff = Date.now() - ONLINE_WINDOW_MS;
    for (const row of data ?? []) {
      if (row.last_seen_at && new Date(row.last_seen_at).getTime() >= cutoff) {
        online.add(row.id);
      }
    }
  }

  // Online first: a contact list in no particular order is a phone book.
  const contacts = [...friends].sort((a, b) => {
    const byPresence = Number(online.has(b.id)) - Number(online.has(a.id));
    return byPresence !== 0
      ? byPresence
      : displayName(a).localeCompare(displayName(b));
  });

  // Nothing real to show beats four invented names.
  if (suggestions.length === 0 && contacts.length === 0) return null;

  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-80 shrink-0 space-y-3 overflow-y-auto px-3 py-4 xl:block">
      {suggestions.length > 0 ? (
        <section className="rounded-xl border bg-card p-2">
          <SectionHeader
            icon={<UserPlus className="h-4 w-4" />}
            title={t("suggestions")}
            href="/friends"
          />
          <div className="space-y-0.5">
            {suggestions.map((person) => (
              <div
                key={person.id}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted"
              >
                <UserAvatar profile={person} className="h-9 w-9" />
                <Link
                  href={person.username ? `/u/${person.username}` : "/friends"}
                  className="min-w-0 flex-1"
                >
                  <span className="block truncate text-sm font-medium">
                    {displayName(person)}
                  </span>
                  {person.username ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      @{person.username}
                    </span>
                  ) : null}
                </Link>
                <FriendButton profileId={person.id} state={{ kind: "none" }} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {contacts.length > 0 ? (
        <section className="rounded-xl border bg-card p-2">
          <SectionHeader
            icon={<Users className="h-4 w-4" />}
            title={t("contacts")}
            href="/friends"
          />
          <div className="space-y-0.5">
            {contacts.slice(0, 12).map((person) => (
              <ContactRow
                key={person.id}
                person={person}
                online={online.has(person.id)}
              />
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}

function SectionHeader({
  icon,
  title,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  href: string;
}) {
  return (
    <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        {icon}
        {title}
      </h2>
      <Link
        href={href}
        aria-label={title}
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

/** A contact row opens the conversation — that is what a contact is for. */
function ContactRow({
  person,
  online,
}: {
  person: AuthorSummary;
  online: boolean;
}) {
  return (
    <Link
      href="/messages"
      className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted"
    >
      <span className="relative shrink-0">
        <UserAvatar profile={person} className="h-9 w-9" linked={false} />
        {/* Only a real heartbeat lights the dot. An offline friend gets none,
            rather than a green dot that means nothing. */}
        {online ? (
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
        ) : null}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {displayName(person)}
      </span>
    </Link>
  );
}
