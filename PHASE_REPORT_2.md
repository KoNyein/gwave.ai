# Phase 2 — Groups, Pages, Messenger, Stories

Builds community and chat features on the Phase 1 social core: groups with
join flows and member management, business pages, a realtime messenger with
typing indicators and read receipts, and 24-hour stories.

## What was built

### Data layer

- **Migration** `supabase/migrations/20260705130000_community_chat.sql`:
  - Enums: `group_privacy` (public/private), `group_member_role`
    (member/moderator/admin), `group_member_status` (pending/active).
  - Tables: `groups` (denormalized `member_count`), `group_members`
    (role + status; `pending` models a join request), `pages`
    (denormalized `follower_count`), `page_followers`, `conversations`
    (with `direct_key` so a user pair can only ever have one 1-1 chat),
    `conversation_participants` (with `last_read_at` for read receipts),
    `messages`, `stories` (default `expires_at = now() + 24h`),
    `story_views`.
  - `posts` gains nullable `group_id` / `page_id` (mutually exclusive).
  - **RLS rework**: post visibility is now centralized in
    `can_view_post_id()` — group posts follow group privacy (public group
    → everyone, private → active members), page posts are public, ordinary
    posts keep the Phase 1 rules. All post-child policies (media,
    comments, reactions, shares) were re-pointed at this helper.
  - **RLS for new tables**: groups/pages are discoverable directories,
    owner-managed; group joins are self-service but the *status is
    enforced by policy* (public → active, private → pending; only group
    admins/moderators can approve or change roles); conversations and
    messages are participant-only; stories are visible while unexpired to
    the author, friends and followers; story views are recorded by the
    viewer and readable by the story author.
  - **RPCs** (SECURITY DEFINER): `get_or_create_direct_conversation()`
    (atomic find-or-create of a 1-1 chat + both participant rows) and
    `create_group_with_owner()` (group + owner-as-admin membership).
  - Counter triggers for `member_count` / `follower_count`; a
    `touch_conversation` trigger keeps `last_message_at` current.
  - `messages` and `conversations` added to the realtime publication.

- **Edge Function** `supabase/functions/cleanup-stories/index.ts`:
  scheduled cleanup that deletes expired stories and removes their media
  from storage (deploy + hourly schedule documented in the file header).

### Features

1. **Groups** — `/groups` directory (your groups + discover, create
   dialog with public/private choice); `/groups/[slug]` with cover
   header, join/request/leave button, Discussion tab (reuses the Phase 1
   feed + composer posting into the group), Members tab, and an
   admin-only Requests tab (approve/deny, promote/demote moderators,
   remove members). Private group feeds show a lock screen to
   non-members.
2. **Pages** — `/pages` directory (create dialog with category);
   `/pages/[slug]` with page avatar/cover header, follow/unfollow button
   with live follower count, Posts tab (owner posts as the page) and
   About tab. Post cards show a "Author ▸ Group/Page" context link.
3. **Messenger** — `/messages` full-width two-pane layout (list +
   chat window, mobile-aware with back navigation): 1-1 conversations via
   the find-or-create RPC ("new message" picks from friends), instant
   delivery over Supabase Realtime (`postgres_changes` on `messages`,
   RLS-scoped), typing indicators over a per-conversation broadcast
   channel, "Seen" read receipts driven by `last_read_at` updates
   (live via realtime), image sending through the media bucket, optimistic
   sends, unread badges and conversation reordering.
4. **Stories** — story bar at the top of the feed (create tile +
   per-author rings, unviewed highlighted); create dialog with image
   upload + text overlay and live preview; full-screen viewer with
   animated progress bars, 5s auto-advance across authors, tap/keyboard
   navigation, view tracking (`story_views`) and own-story deletion.
   24h expiry enforced both by RLS (`expires_at > now()`) and the
   scheduled cleanup function.

### API routes

- `/api/posts` extended with `scope=group|page`.
- `GET /api/messages?conversation=` — last 100 messages.
- `GET /api/conversations` — refreshed conversation list.

## Quality gates

All pass locally:

```bash
pnpm typecheck   # tsc --noEmit — OK
pnpm lint        # next lint — no warnings or errors
pnpm build       # next build — compiled successfully
```

The migration chain (0001 → 0003) and seed were additionally applied to a
scratch PostgreSQL 16 instance with asserts covering: group creation RPC,
private-group post invisibility for non-members, join-request flow
(self-service insert forced to `pending`, self-approval blocked by RLS,
admin approval works, member counts correct), direct-conversation RPC
idempotency, participant-only message access, `last_message_at` trigger,
and story visibility (follower sees, stranger does not).

## How to test manually

1. Apply the migration (`supabase db push` / `supabase db reset`).
2. **Groups**: create a private group as user A; as user B request to
   join (button shows "Request sent"); as A approve from the Requests
   tab; post in the group as B; verify user C sees neither the post nor
   the discussion. Promote B to moderator and check B can now approve.
3. **Pages**: create a page, post as the page, follow it from another
   account, check follower count and the ▸ context link on feed cards.
4. **Messenger**: open /messages in two browsers; start a chat from the
   pencil icon; verify instant delivery, the typing indicator while the
   other side types, "Seen" appearing when the other side opens the chat,
   photo sending, and unread dots on the conversation list.
5. **Stories**: create a story with a text overlay; from a friend's
   account watch it from the story bar (ring dims once viewed); verify
   auto-advance and progress bars; delete your own story from the viewer.

## Notes / follow-ups

- Group chat conversations (`is_group = true`) are modeled in the schema
  but the UI currently creates 1-1 chats only; desktop chat popups were
  deferred — /messages covers the flows.
- Story creation is image-only in the UI (schema supports video).
- Message history loads the last 100 messages (no pagination yet).
- Knowledge search (strains + minerals) is Phase 3.
