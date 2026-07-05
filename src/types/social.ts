import type {
  Comment,
  Notification,
  Post,
  PostMedia,
  Profile,
  ReactionType,
} from "@/types/database";

/** Minimal author info embedded in posts, comments and notifications. */
export type AuthorSummary = Pick<
  Profile,
  "id" | "username" | "full_name" | "avatar_url"
>;

/** A post as rendered in the feed, with everything the card needs. */
export interface FeedPost extends Post {
  author: AuthorSummary;
  media: PostMedia[];
  /** The viewer's own reaction, if any (0 or 1 rows embedded). */
  my_reaction: { type: ReactionType }[];
  /** Original post when this is a share (null when it was deleted). */
  shared_post:
    | (Post & { author: AuthorSummary; media: PostMedia[] })
    | null;
}

export interface CommentWithAuthor extends Comment {
  author: AuthorSummary;
  my_reaction: { type: ReactionType }[];
}

export interface NotificationWithActor extends Notification {
  actor: AuthorSummary | null;
}

export interface FeedPage {
  posts: FeedPost[];
  /** Cursor for the next page, or null when exhausted. */
  nextCursor: string | null;
}

/** Relationship between the viewer and another profile. */
export type FriendState =
  | { kind: "self" }
  | { kind: "none" }
  | { kind: "request_sent"; friendshipId: string }
  | { kind: "request_received"; friendshipId: string }
  | { kind: "friends"; friendshipId: string }
  | { kind: "blocked"; friendshipId: string };

/** Serialized keyset cursor: "<created_at ISO>|<post id>". */
export function encodeCursor(createdAt: string, id: string): string {
  return `${createdAt}|${id}`;
}

export function decodeCursor(
  cursor: string,
): { createdAt: string; id: string } | null {
  const sep = cursor.indexOf("|");
  if (sep === -1) return null;
  const createdAt = cursor.slice(0, sep);
  const id = cursor.slice(sep + 1);
  if (!createdAt || !id) return null;
  return { createdAt, id };
}
