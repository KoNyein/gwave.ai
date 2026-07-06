# Phase 1 — Social Core

Builds the Facebook-style social core on the Phase 0 foundation: posts with
media, a cursor-paginated news feed, 6-type reactions, nested comments,
shares, the friend/follow system, user profiles and realtime notifications.
(The Phase 0 report is preserved in git history.)

## What was built

### Data layer

- **Migration** `supabase/migrations/20260705120000_social_core.sql`:
  - `profiles.cover_url` column (profile cover photo).
  - Enums: `post_visibility` (public/friends/only_me), `reaction_type`
    (like/love/haha/wow/sad/angry), `friendship_status`, `notification_type`.
  - Tables: `posts` (with denormalized `reaction_count`/`comment_count`/
    `share_count`), `post_media`, `comments` (one-level nesting via
    `parent_id`, enforced by trigger), `reactions` (unique per user per
    target via partial unique indexes), `shares` (populated by trigger when a
    post with `shared_post_id` is created), `friendships` (one row per pair
    regardless of direction via `least/greatest` unique index), `follows`,
    `notifications`.
  - **RLS everywhere**: posts respect visibility through a
    `can_view_post()` helper (`friends` visibility checks an accepted
    friendship via `are_friends()`); only authors edit/delete their posts;
    comments/reactions readable exactly where the parent post is readable;
    friendships visible only to the two parties (requester inserts pending,
    addressee accepts, either deletes); notifications recipient-only, with
    inserts happening exclusively through SECURITY DEFINER triggers.
  - Counter triggers keep the denormalized counts correct on
    insert/delete of reactions, comments and shares.
  - Notification triggers: post reaction, post comment, comment reply,
    friend request, friend accepted, post shared, new follower — all skip
    self-notifications.
  - `notifications` added to the `supabase_realtime` publication.
  - Public `media` storage bucket with per-user folder policies
    (`<user_id>/...` — users write/delete only inside their own folder).

- **Types**: `src/types/database.ts` extended for all new tables/enums;
  `src/types/social.ts` adds composed view types (`FeedPost`,
  `CommentWithAuthor`, `NotificationWithActor`, `FriendState`) and the
  keyset cursor codec.

- **Query layer** (`src/lib/db/`): `posts.ts` (`getFeed`, `getProfilePosts`,
  `getPost`, `getComments` — keyset pagination on `(created_at, id)`),
  `friends.ts` (friend state machine, requests, suggestions, counts),
  `notifications.ts`.

- **Server actions** (`src/lib/actions/`): `createPost`, `sharePost`,
  `deletePost`, `setReaction` (insert/change/clear), `addComment`,
  `deleteComment`; friend request send/accept/remove, follow/unfollow;
  mark notification(s) read. All inputs validated with Zod; all writes go
  through the RLS-scoped server client.

### Features

1. **Post composer** — dialog with text (10k chars), visibility selector
   (public/friends/only me), up to 10 images or 1 video. Images are
   compressed client-side (canvas → JPEG, max 2048px) before upload to
   Supabase Storage under the user's folder.
2. **News feed** `/feed` — posts from friends + follows + self,
   cursor-based infinite scroll (IntersectionObserver + `/api/posts`),
   optimistic reactions and comments.
3. **Post card** — Facebook layout: author header with timestamp +
   visibility icon, content, media grid (1–4 tiles with "+N" overflow),
   video player, reaction bar with hover picker (6 types), expandable
   comment thread (one nested level, reply targeting, comment likes,
   delete own), share dialog (re-shares always point at the original
   post), shared-post embed, delete menu for authors.
4. **Profile page** `/u/[username]` — cover (image or brand gradient),
   avatar, bio, friend count, Add Friend/Respond/Friends + Follow buttons,
   tabs: Posts (timeline with composer on own profile) / About / Friends.
5. **Friend system** `/friends` — incoming requests (confirm/decline),
   sent requests (cancel), all friends, "people you may know" suggestions.
6. **Notifications** — navbar bell with unread badge, live updates via
   Supabase Realtime (`postgres_changes` INSERT on `notifications`),
   dropdown with recent items (opening marks all read), full
   `/notifications` page. Notification click routes to the post (`/p/[id]`)
   or the actor's profile.
7. **Basic search** `/search?q=` — navbar search box; finds people
   (username/full name) and posts (content, RLS-filtered), LIKE wildcards
   escaped.
8. **Post permalink** `/p/[id]` — single-post page used by notifications
   and search results.

### API routes

- `GET /api/posts?scope=feed|profile&author=&cursor=` — paginated feed.
- `GET /api/comments?post=` — comments for a visible post.
- `GET /api/notifications` — recent notifications + unread count.

## Seed data

`supabase/seed/seed.sql` (idempotent, local stacks only): 5 demo users
(`demo1@gwave.ai` … `demo5@gwave.ai`, password `password123`), profiles,
4 accepted friendships + 1 pending request, 3 follows, 30 posts with
distinct timestamps (exercises pagination), comments incl. one nested
reply, 6 reactions, and 1 share.

## Quality gates

All pass locally:

```bash
pnpm typecheck   # tsc --noEmit — OK
pnpm lint        # next lint — no warnings or errors
pnpm build       # next build — compiled successfully
```

## How to test manually

1. Apply the migration: `supabase db push` (hosted) or
   `supabase db reset` (local — also runs the seed).
2. `pnpm dev`, log in as `demo1@gwave.ai` / `password123` (local seed) or
   register a fresh account.
3. **Feed**: create a text post; create a post with several images
   (watch them compress/upload); switch visibility to Friends/Only me and
   verify other accounts see/don't see it accordingly.
4. **Reactions**: hover the Like button for the 6-reaction picker; counts
   update optimistically; re-click to clear.
5. **Comments**: expand a post, comment, reply to a comment (one level),
   like and delete your own comments.
6. **Share**: share a post with a caption; the share appears in the feed
   embedding the original; the original's share count increments.
7. **Friends**: from a profile or /friends send a request; as the other
   user accept it (bell shows a realtime notification); confirm
   friends-only posts become visible.
8. **Notifications**: react/comment as user B on user A's post; user A's
   bell badge updates live without a refresh; opening the dropdown marks
   items read.
9. **Search & profile**: search a username from the navbar; open the
   profile; check tabs, cover gradient, friend count.
10. **Pagination**: with the seed's 30 posts, scroll the feed and verify
    pages of 10 load seamlessly.

## Notes / follow-ups

- Infinite scroll pages come from `/api/posts` route handlers; feed order
  is reverse-chronological (ranking is out of scope for Phase 1).
- Avatar/cover uploads still use URL fields from onboarding; the `media`
  bucket is ready for a proper upload flow in a later phase.
- Video uploads are passed through without transcoding (100 MB cap).
- Groups/Pages/Messenger/Stories are Phase 2.
