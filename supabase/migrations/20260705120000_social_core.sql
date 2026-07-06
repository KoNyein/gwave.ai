-- Phase 1: social core — posts, media, comments, reactions, shares,
-- friendships, follows and notifications, with RLS and notification triggers.

-- Profiles gain a cover photo for the Facebook-style profile page.
alter table public.profiles add column cover_url text;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.post_visibility as enum ('public', 'friends', 'only_me');

create type public.reaction_type as enum (
  'like',
  'love',
  'haha',
  'wow',
  'sad',
  'angry'
);

create type public.friendship_status as enum ('pending', 'accepted', 'blocked');

create type public.notification_type as enum (
  'friend_request',
  'friend_accepted',
  'post_reaction',
  'post_comment',
  'comment_reply',
  'post_share',
  'new_follower'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  content text not null default '',
  visibility public.post_visibility not null default 'public',
  -- Set when this post is a share of another post.
  shared_post_id uuid references public.posts (id) on delete set null,
  reaction_count integer not null default 0,
  comment_count integer not null default 0,
  share_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_content_length check (char_length(content) <= 10000)
);

create index posts_author_created_idx
  on public.posts (author_id, created_at desc);
create index posts_created_idx on public.posts (created_at desc, id desc);
create index posts_shared_post_idx
  on public.posts (shared_post_id)
  where shared_post_id is not null;

create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.handle_updated_at();

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  storage_path text not null,
  width integer,
  height integer,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index post_media_post_idx on public.post_media (post_id, position);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  -- One level of nesting only (enforced by trigger below).
  parent_id uuid references public.comments (id) on delete cascade,
  content text not null,
  reaction_count integer not null default 0,
  reply_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comment_content_length
    check (char_length(content) between 1 and 4000)
);

create index comments_post_idx on public.comments (post_id, created_at);
create index comments_parent_idx
  on public.comments (parent_id)
  where parent_id is not null;

create trigger comments_set_updated_at
  before update on public.comments
  for each row execute function public.handle_updated_at();

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  type public.reaction_type not null,
  created_at timestamptz not null default now(),
  -- A reaction targets exactly one of: a post or a comment.
  constraint reaction_single_target
    check ((post_id is null) <> (comment_id is null))
);

-- One reaction per user per target.
create unique index reactions_user_post_key
  on public.reactions (user_id, post_id)
  where post_id is not null;
create unique index reactions_user_comment_key
  on public.reactions (user_id, comment_id)
  where comment_id is not null;
create index reactions_post_idx
  on public.reactions (post_id)
  where post_id is not null;
create index reactions_comment_idx
  on public.reactions (comment_id)
  where comment_id is not null;

-- Share events: one row per share-post referencing the original post.
-- Populated by trigger when a post with shared_post_id is created.
create table public.shares (
  id uuid primary key default gen_random_uuid(),
  original_post_id uuid not null references public.posts (id) on delete cascade,
  share_post_id uuid not null unique references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index shares_original_post_idx on public.shares (original_post_id);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendship_not_self check (requester_id <> addressee_id)
);

-- Only one friendship row per pair, regardless of direction.
create unique index friendships_pair_key
  on public.friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );
create index friendships_addressee_idx
  on public.friendships (addressee_id, status);
create index friendships_requester_idx
  on public.friendships (requester_id, status);

create trigger friendships_set_updated_at
  before update on public.friendships
  for each row execute function public.handle_updated_at();

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follow_not_self check (follower_id <> followee_id)
);

create index follows_followee_idx on public.follows (followee_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx
  on public.notifications (recipient_id)
  where not read;

-- Stream new notifications to clients over Supabase Realtime.
alter publication supabase_realtime add table public.notifications;

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- True when an accepted friendship exists between the two users.
-- SECURITY DEFINER so it can be used inside RLS policies without recursion.
create or replace function public.are_friends(user_a uuid, user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = user_a and f.addressee_id = user_b)
        or (f.requester_id = user_b and f.addressee_id = user_a)
      )
  );
$$;

-- Visibility check shared by posts / comments / reactions policies.
create or replace function public.can_view_post(
  post_author uuid,
  post_vis public.post_visibility
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    post_author = auth.uid()
    or post_vis = 'public'
    or (post_vis = 'friends' and public.are_friends(auth.uid(), post_author));
$$;

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

-- Comments nest one level only, and replies must stay on the parent's post.
create or replace function public.enforce_comment_nesting()
returns trigger
language plpgsql
as $$
declare
  parent record;
begin
  if new.parent_id is not null then
    select post_id, parent_id into parent
    from public.comments
    where id = new.parent_id;

    if parent is null then
      raise exception 'Parent comment not found';
    end if;
    if parent.parent_id is not null then
      raise exception 'Comments can only be nested one level deep';
    end if;
    if parent.post_id <> new.post_id then
      raise exception 'Reply must belong to the same post as its parent';
    end if;
  end if;
  return new;
end;
$$;

create trigger comments_enforce_nesting
  before insert on public.comments
  for each row execute function public.enforce_comment_nesting();

-- When a share-post is created, record the share event (which also drives the
-- share counter and the notification). SECURITY DEFINER: users cannot write
-- to shares directly.
create or replace function public.handle_shared_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.shared_post_id is not null then
    insert into public.shares (original_post_id, share_post_id, user_id)
    values (new.shared_post_id, new.id, new.author_id);
  end if;
  return new;
end;
$$;

create trigger posts_handle_share
  after insert on public.posts
  for each row execute function public.handle_shared_post();

-- ---------------------------------------------------------------------------
-- Counter triggers (denormalized counts for cheap feed rendering)
-- ---------------------------------------------------------------------------

create or replace function public.bump_reaction_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target record;
  delta integer;
begin
  target := coalesce(new, old);
  delta := case when tg_op = 'INSERT' then 1
                when tg_op = 'DELETE' then -1
                else 0 end;
  if delta <> 0 then
    if target.post_id is not null then
      update public.posts
      set reaction_count = greatest(reaction_count + delta, 0)
      where id = target.post_id;
    else
      update public.comments
      set reaction_count = greatest(reaction_count + delta, 0)
      where id = target.comment_id;
    end if;
  end if;
  return null;
end;
$$;

create trigger reactions_bump_count
  after insert or delete on public.reactions
  for each row execute function public.bump_reaction_count();

create or replace function public.bump_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target record;
  delta integer;
begin
  target := coalesce(new, old);
  delta := case when tg_op = 'INSERT' then 1 else -1 end;
  update public.posts
  set comment_count = greatest(comment_count + delta, 0)
  where id = target.post_id;
  if target.parent_id is not null then
    update public.comments
    set reply_count = greatest(reply_count + delta, 0)
    where id = target.parent_id;
  end if;
  return null;
end;
$$;

create trigger comments_bump_count
  after insert or delete on public.comments
  for each row execute function public.bump_comment_count();

create or replace function public.bump_share_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target record;
  delta integer;
begin
  target := coalesce(new, old);
  delta := case when tg_op = 'INSERT' then 1 else -1 end;
  update public.posts
  set share_count = greatest(share_count + delta, 0)
  where id = target.original_post_id;
  return null;
end;
$$;

create trigger shares_bump_count
  after insert or delete on public.shares
  for each row execute function public.bump_share_count();

-- ---------------------------------------------------------------------------
-- Notification triggers (SECURITY DEFINER — users never insert notifications)
-- ---------------------------------------------------------------------------

create or replace function public.notify_on_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_author uuid;
begin
  if new.post_id is not null then
    select author_id into target_author from public.posts where id = new.post_id;
    if target_author is not null and target_author <> new.user_id then
      insert into public.notifications (recipient_id, actor_id, type, post_id)
      values (target_author, new.user_id, 'post_reaction', new.post_id);
    end if;
  end if;
  return null;
end;
$$;

create trigger reactions_notify
  after insert on public.reactions
  for each row execute function public.notify_on_reaction();

create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author uuid;
  parent_author uuid;
begin
  select author_id into post_author from public.posts where id = new.post_id;

  if new.parent_id is not null then
    select author_id into parent_author
    from public.comments
    where id = new.parent_id;
    if parent_author is not null and parent_author <> new.author_id then
      insert into public.notifications
        (recipient_id, actor_id, type, post_id, comment_id)
      values (parent_author, new.author_id, 'comment_reply', new.post_id, new.id);
    end if;
  end if;

  if post_author is not null
     and post_author <> new.author_id
     and (parent_author is null or parent_author <> post_author) then
    insert into public.notifications
      (recipient_id, actor_id, type, post_id, comment_id)
    values (post_author, new.author_id, 'post_comment', new.post_id, new.id);
  end if;
  return null;
end;
$$;

create trigger comments_notify
  after insert on public.comments
  for each row execute function public.notify_on_comment();

create or replace function public.notify_on_friendship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications (recipient_id, actor_id, type)
    values (new.addressee_id, new.requester_id, 'friend_request');
  elsif tg_op = 'UPDATE'
        and old.status = 'pending'
        and new.status = 'accepted' then
    insert into public.notifications (recipient_id, actor_id, type)
    values (new.requester_id, new.addressee_id, 'friend_accepted');
  end if;
  return null;
end;
$$;

create trigger friendships_notify
  after insert or update on public.friendships
  for each row execute function public.notify_on_friendship();

create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (recipient_id, actor_id, type)
  values (new.followee_id, new.follower_id, 'new_follower');
  return null;
end;
$$;

create trigger follows_notify
  after insert on public.follows
  for each row execute function public.notify_on_follow();

create or replace function public.notify_on_share()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  original_author uuid;
begin
  select author_id into original_author
  from public.posts
  where id = new.original_post_id;
  if original_author is not null and original_author <> new.user_id then
    insert into public.notifications (recipient_id, actor_id, type, post_id)
    values (original_author, new.user_id, 'post_share', new.original_post_id);
  end if;
  return null;
end;
$$;

create trigger shares_notify
  after insert on public.shares
  for each row execute function public.notify_on_share();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.shares enable row level security;
alter table public.friendships enable row level security;
alter table public.follows enable row level security;
alter table public.notifications enable row level security;

-- Posts: visibility-aware read; authors have full CRUD on their own posts.
create policy "Posts are viewable according to visibility"
  on public.posts
  for select
  to authenticated
  using (public.can_view_post(author_id, visibility));

create policy "Users can create their own posts"
  on public.posts
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and (
      shared_post_id is null
      or exists (
        select 1
        from public.posts original
        where original.id = shared_post_id
          and original.shared_post_id is null
          and public.can_view_post(original.author_id, original.visibility)
      )
    )
  );

create policy "Authors can update their own posts"
  on public.posts
  for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "Authors can delete their own posts"
  on public.posts
  for delete
  to authenticated
  using (author_id = auth.uid());

-- Post media: readable wherever the parent post is readable; writable by the
-- post author.
create policy "Media is viewable with its post"
  on public.post_media
  for select
  to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_id
        and public.can_view_post(p.author_id, p.visibility)
    )
  );

create policy "Authors can attach media to their posts"
  on public.post_media
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.posts p
      where p.id = post_id and p.author_id = auth.uid()
    )
  );

create policy "Authors can remove media from their posts"
  on public.post_media
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_id and p.author_id = auth.uid()
    )
  );

-- Comments: readable wherever the parent post is readable; users manage only
-- their own comments and may only comment on posts they can see.
create policy "Comments are viewable with their post"
  on public.comments
  for select
  to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_id
        and public.can_view_post(p.author_id, p.visibility)
    )
  );

create policy "Users can comment on visible posts"
  on public.comments
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.posts p
      where p.id = post_id
        and public.can_view_post(p.author_id, p.visibility)
    )
  );

create policy "Authors can update their own comments"
  on public.comments
  for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "Authors can delete their own comments"
  on public.comments
  for delete
  to authenticated
  using (author_id = auth.uid());

-- Reactions: readable wherever the target is readable; users manage only
-- their own reactions on content they can see.
create policy "Reactions are viewable with their target"
  on public.reactions
  for select
  to authenticated
  using (
    (
      post_id is not null
      and exists (
        select 1 from public.posts p
        where p.id = post_id
          and public.can_view_post(p.author_id, p.visibility)
      )
    )
    or (
      comment_id is not null
      and exists (
        select 1
        from public.comments c
        join public.posts p on p.id = c.post_id
        where c.id = comment_id
          and public.can_view_post(p.author_id, p.visibility)
      )
    )
  );

create policy "Users can react to visible content"
  on public.reactions
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      (
        post_id is not null
        and exists (
          select 1 from public.posts p
          where p.id = post_id
            and public.can_view_post(p.author_id, p.visibility)
        )
      )
      or (
        comment_id is not null
        and exists (
          select 1
          from public.comments c
          join public.posts p on p.id = c.post_id
          where c.id = comment_id
            and public.can_view_post(p.author_id, p.visibility)
        )
      )
    )
  );

create policy "Users can change their own reactions"
  on public.reactions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can remove their own reactions"
  on public.reactions
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Shares: read-only for users (rows are created by the posts trigger).
create policy "Shares are viewable with the original post"
  on public.shares
  for select
  to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = original_post_id
        and public.can_view_post(p.author_id, p.visibility)
    )
  );

-- Friendships: visible to the two parties; requester creates pending rows;
-- addressee accepts; either side may delete (cancel / decline / unfriend).
create policy "Users see their own friendships"
  on public.friendships
  for select
  to authenticated
  using (auth.uid() in (requester_id, addressee_id));

create policy "Users can send friend requests"
  on public.friendships
  for insert
  to authenticated
  with check (requester_id = auth.uid() and status = 'pending');

create policy "Addressee can respond to a friend request"
  on public.friendships
  for update
  to authenticated
  using (addressee_id = auth.uid())
  with check (
    addressee_id = auth.uid() and status in ('accepted', 'blocked')
  );

create policy "Either party can remove a friendship"
  on public.friendships
  for delete
  to authenticated
  using (auth.uid() in (requester_id, addressee_id));

-- Follows: public within the app; users manage only their own follows.
create policy "Follows are viewable by authenticated users"
  on public.follows
  for select
  to authenticated
  using (true);

create policy "Users can follow others"
  on public.follows
  for insert
  to authenticated
  with check (follower_id = auth.uid());

create policy "Users can unfollow"
  on public.follows
  for delete
  to authenticated
  using (follower_id = auth.uid());

-- Notifications: recipient-only read/update (inserts happen via triggers).
create policy "Users see their own notifications"
  on public.notifications
  for select
  to authenticated
  using (recipient_id = auth.uid());

create policy "Users can mark their notifications read"
  on public.notifications
  for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy "Users can delete their own notifications"
  on public.notifications
  for delete
  to authenticated
  using (recipient_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: public "media" bucket for post images/videos and avatars/covers.
-- Files live under <user_id>/... so ownership is enforced by path prefix.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Some hosted Supabase projects do not grant migrations ownership of
-- storage.objects; in that case create these three policies from the
-- dashboard instead (Storage → media → Policies).
do $$
begin
  create policy "Media files are publicly readable"
    on storage.objects
    for select
    using (bucket_id = 'media');

  create policy "Users can upload media into their own folder"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'media'
      and (storage.foldername(name))[1] = auth.uid()::text
    );

  create policy "Users can delete their own media files"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'media'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
exception
  when insufficient_privilege then
    raise notice 'Skipped storage.objects policies (insufficient privilege); create them via the dashboard.';
end;
$$;
