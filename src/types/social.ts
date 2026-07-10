import type {
  Comment,
  Conversation,
  Message,
  Notification,
  Post,
  PostMedia,
  Profile,
  ReactionType,
  Story,
} from "@/types/database";

/** Minimal author info embedded in posts, comments and notifications. */
export type AuthorSummary = Pick<
  Profile,
  "id" | "username" | "full_name" | "avatar_url"
> & {
  /** Present where the member badge is rendered (posts, comments). */
  role?: Profile["role"];
};

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
  /** Group context when the post lives in a group. */
  group: { id: string; name: string; slug: string } | null;
  /** Page context when the post was published as a page. */
  page: { id: string; name: string; slug: string; avatar_url: string | null } | null;
  /** Set when this card is a paid promotion spliced into the feed. */
  sponsored?: boolean;
  /** The campaign that placed this card (for impression/click billing). */
  boost_id?: string | null;
  /** Advertiser's promotional headline, shown above the post. */
  boost_headline?: string | null;
}

/** One entry in a post's audience list (author-only). */
export interface PostViewer {
  viewed_at: string;
  viewer: Pick<Profile, "id" | "username" | "full_name" | "avatar_url">;
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

/** A conversation as listed in the messenger sidebar. */
export interface ConversationSummary extends Conversation {
  participants: {
    user_id: string;
    last_read_at: string;
    profile: AuthorSummary;
  }[];
  last_message: Pick<
    Message,
    | "id"
    | "sender_id"
    | "content"
    | "image_path"
    | "latitude"
    | "file_kind"
    | "created_at"
  > | null;
  unread: boolean;
}

export interface MessageWithSender extends Message {
  sender: AuthorSummary;
}

/** All active stories of one author, grouped for the story bar/viewer. */
export interface StoryGroup {
  author: AuthorSummary;
  stories: (Story & { viewed: boolean })[];
  allViewed: boolean;
}

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
