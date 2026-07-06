-- Phase 2: community + chat — groups, pages, messenger and stories, with a
-- rework of the post-visibility RLS to account for group/page posts.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.group_privacy as enum ('public', 'private');

create type public.group_member_role as enum ('member', 'moderator', 'admin');

-- 'pending' models a join request to a private group.
create type public.group_member_status as enum ('pending', 'active');

-- ---------------------------------------------------------------------------
-- Groups
-- ---------------------------------------------------------------------------

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  privacy public.group_privacy not null default 'public',
  cover_url text,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  member_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_name_length check (char_length(name) between 3 and 80),
  constraint group_slug_format check (slug ~ '^[a-z0-9-]{3,80}$')
);

create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function public.handle_updated_at();

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.group_member_role not null default 'member',
  status public.group_member_status not null default 'active',
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id, status);

-- ---------------------------------------------------------------------------
-- Pages
-- ---------------------------------------------------------------------------

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category text,
  description text,
  avatar_url text,
  cover_url text,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  follower_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint page_name_length check (char_length(name) between 3 and 80),
  constraint page_slug_format check (slug ~ '^[a-z0-9-]{3,80}$')
);

create trigger pages_set_updated_at
  before update on public.pages
  for each row execute function public.handle_updated_at();

create table public.page_followers (
  page_id uuid not null references public.pages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (page_id, user_id)
);

create index page_followers_user_idx on public.page_followers (user_id);

-- ---------------------------------------------------------------------------
-- Posts can now belong to a group or be published as a page
-- ---------------------------------------------------------------------------

alter table public.posts
  add column group_id uuid references public.groups (id) on delete cascade,
  add column page_id uuid references public.pages (id) on delete cascade,
  add constraint post_single_context check (group_id is null or page_id is null);

create index posts_group_idx
  on public.posts (group_id, created_at desc)
  where group_id is not null;
create index posts_page_idx
  on public.posts (page_id, created_at desc)
  where page_id is not null;

-- ---------------------------------------------------------------------------
-- Messenger
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  title text,
  -- For 1-1 chats: "least(uid_a, uid_b):greatest(uid_a, uid_b)" so a pair
  -- can only ever have one direct conversation.
  direct_key text unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index conversations_last_message_idx
  on public.conversations (last_message_at desc);

create table public.conversation_participants (
  conversation_id uuid not null
    references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index conversation_participants_user_idx
  on public.conversation_participants (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null default '',
  image_path text,
  created_at timestamptz not null default now(),
  constraint message_has_content
    check (char_length(content) > 0 or image_path is not null),
  constraint message_content_length check (char_length(content) <= 4000)
);

create index messages_conversation_idx
  on public.messages (conversation_id, created_at desc);

-- Keep the conversation ordering current.
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return null;
end;
$$;

create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- Chat is realtime.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;

-- ---------------------------------------------------------------------------
-- Stories
-- ---------------------------------------------------------------------------

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  media_path text not null,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  text_overlay text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create index stories_active_idx on public.stories (expires_at desc, author_id);

create table public.story_views (
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER to avoid RLS recursion)
-- ---------------------------------------------------------------------------

-- Active membership in a group.
create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = gid
      and gm.user_id = auth.uid()
      and gm.status = 'active'
  );
$$;

-- Admin (or moderator) rights in a group.
create or replace function public.is_group_admin(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = gid
      and gm.user_id = auth.uid()
      and gm.status = 'active'
      and gm.role in ('moderator', 'admin')
  );
$$;

-- Central post-visibility check used by posts and all of its child tables.
-- Group posts follow group privacy; page posts are public; ordinary posts
-- keep the Phase 1 visibility rules.
create or replace function public.can_view_post_id(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.posts p
    left join public.groups g on g.id = p.group_id
    where p.id = pid
      and (
        (p.group_id is not null
          and (g.privacy = 'public' or public.is_group_member(p.group_id)))
        or (p.page_id is not null)
        or (p.group_id is null and p.page_id is null
          and public.can_view_post(p.author_id, p.visibility))
      )
  );
$$;

create or replace function public.is_conversation_participant(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = cid and cp.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Counter triggers
-- ---------------------------------------------------------------------------

create or replace function public.bump_group_member_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta integer := 0;
begin
  if tg_op = 'INSERT' and new.status = 'active' then
    delta := 1;
  elsif tg_op = 'DELETE' and old.status = 'active' then
    delta := -1;
  elsif tg_op = 'UPDATE' then
    delta := (case when new.status = 'active' then 1 else 0 end)
           - (case when old.status = 'active' then 1 else 0 end);
  end if;
  if delta <> 0 then
    update public.groups
    set member_count = greatest(member_count + delta, 0)
    where id = coalesce(new.group_id, old.group_id);
  end if;
  return null;
end;
$$;

create trigger group_members_bump_count
  after insert or update or delete on public.group_members
  for each row execute function public.bump_group_member_count();

create or replace function public.bump_page_follower_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta integer;
begin
  delta := case when tg_op = 'INSERT' then 1 else -1 end;
  update public.pages
  set follower_count = greatest(follower_count + delta, 0)
  where id = coalesce(new.page_id, old.page_id);
  return null;
end;
$$;

create trigger page_followers_bump_count
  after insert or delete on public.page_followers
  for each row execute function public.bump_page_follower_count();

-- ---------------------------------------------------------------------------
-- Rework post/comment/reaction/media policies around can_view_post_id()
-- ---------------------------------------------------------------------------

drop policy "Posts are viewable according to visibility" on public.posts;
create policy "Posts are viewable according to visibility"
  on public.posts
  for select
  to authenticated
  using (public.can_view_post_id(id));

drop policy "Users can create their own posts" on public.posts;
create policy "Users can create their own posts"
  on public.posts
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    -- Group posts require active membership; group posts don't have a
    -- standalone visibility of their own beyond the group's privacy.
    and (group_id is null or public.is_group_member(group_id))
    -- Page posts may only be published by the page owner.
    and (
      page_id is null
      or exists (
        select 1 from public.pages pg
        where pg.id = page_id and pg.owner_id = auth.uid()
      )
    )
    and (
      shared_post_id is null
      or (
        group_id is null
        and page_id is null
        and exists (
          select 1
          from public.posts original
          where original.id = shared_post_id
            and original.shared_post_id is null
            and public.can_view_post_id(original.id)
        )
      )
    )
  );

drop policy "Media is viewable with its post" on public.post_media;
create policy "Media is viewable with its post"
  on public.post_media
  for select
  to authenticated
  using (public.can_view_post_id(post_id));

drop policy "Comments are viewable with their post" on public.comments;
create policy "Comments are viewable with their post"
  on public.comments
  for select
  to authenticated
  using (public.can_view_post_id(post_id));

drop policy "Users can comment on visible posts" on public.comments;
create policy "Users can comment on visible posts"
  on public.comments
  for insert
  to authenticated
  with check (author_id = auth.uid() and public.can_view_post_id(post_id));

drop policy "Reactions are viewable with their target" on public.reactions;
create policy "Reactions are viewable with their target"
  on public.reactions
  for select
  to authenticated
  using (
    (post_id is not null and public.can_view_post_id(post_id))
    or (
      comment_id is not null
      and exists (
        select 1 from public.comments c
        where c.id = comment_id and public.can_view_post_id(c.post_id)
      )
    )
  );

drop policy "Users can react to visible content" on public.reactions;
create policy "Users can react to visible content"
  on public.reactions
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      (post_id is not null and public.can_view_post_id(post_id))
      or (
        comment_id is not null
        and exists (
          select 1 from public.comments c
          where c.id = comment_id and public.can_view_post_id(c.post_id)
        )
      )
    )
  );

drop policy "Shares are viewable with the original post" on public.shares;
create policy "Shares are viewable with the original post"
  on public.shares
  for select
  to authenticated
  using (public.can_view_post_id(original_post_id));

-- ---------------------------------------------------------------------------
-- Row Level Security — new tables
-- ---------------------------------------------------------------------------

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.pages enable row level security;
alter table public.page_followers enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.stories enable row level security;
alter table public.story_views enable row level security;

-- Groups: discoverable by everyone (private groups hide their FEED, not
-- their existence); owners manage the group row.
create policy "Groups are viewable by authenticated users"
  on public.groups
  for select
  to authenticated
  using (true);

create policy "Users can create groups"
  on public.groups
  for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owners can update their groups"
  on public.groups
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners can delete their groups"
  on public.groups
  for delete
  to authenticated
  using (owner_id = auth.uid());

-- Group members: memberships are visible to authenticated users (needed to
-- render member lists and join states); joining is self-service — public
-- groups join as active, private groups as pending. Admins manage members.
create policy "Group memberships are viewable by authenticated users"
  on public.group_members
  for select
  to authenticated
  using (true);

create policy "Users can join groups"
  on public.group_members
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and role = 'member'
    and status = (
      case
        when (select g.privacy from public.groups g where g.id = group_id)
             = 'public'
          then 'active'
        else 'pending'
      end
    )::public.group_member_status
  );

create policy "Admins can manage group members"
  on public.group_members
  for update
  to authenticated
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

create policy "Members can leave and admins can remove"
  on public.group_members
  for delete
  to authenticated
  using (user_id = auth.uid() or public.is_group_admin(group_id));

-- Pages: public directory; owner manages.
create policy "Pages are viewable by authenticated users"
  on public.pages
  for select
  to authenticated
  using (true);

create policy "Users can create pages"
  on public.pages
  for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owners can update their pages"
  on public.pages
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners can delete their pages"
  on public.pages
  for delete
  to authenticated
  using (owner_id = auth.uid());

create policy "Page follows are viewable by authenticated users"
  on public.page_followers
  for select
  to authenticated
  using (true);

create policy "Users can follow pages"
  on public.page_followers
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can unfollow pages"
  on public.page_followers
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Conversations: participants only. Creation goes through a SECURITY
-- DEFINER RPC (below) so the conversation and its participants are created
-- atomically.
create policy "Participants can view their conversations"
  on public.conversations
  for select
  to authenticated
  using (public.is_conversation_participant(id));

create policy "Participants can view participant lists"
  on public.conversation_participants
  for select
  to authenticated
  using (public.is_conversation_participant(conversation_id));

create policy "Participants can update their own read state"
  on public.conversation_participants
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Participants can view messages"
  on public.messages
  for select
  to authenticated
  using (public.is_conversation_participant(conversation_id));

create policy "Participants can send messages"
  on public.messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
  );

create policy "Senders can delete their messages"
  on public.messages
  for delete
  to authenticated
  using (sender_id = auth.uid());

-- Stories: visible while unexpired to the author, their friends and
-- followers; author manages their own stories.
create policy "Stories are viewable by friends and followers"
  on public.stories
  for select
  to authenticated
  using (
    expires_at > now()
    and (
      author_id = auth.uid()
      or public.are_friends(auth.uid(), author_id)
      or exists (
        select 1 from public.follows f
        where f.follower_id = auth.uid() and f.followee_id = author_id
      )
    )
  );

create policy "Users can create their own stories"
  on public.stories
  for insert
  to authenticated
  with check (author_id = auth.uid());

create policy "Authors can delete their own stories"
  on public.stories
  for delete
  to authenticated
  using (author_id = auth.uid());

-- Story views: authors see who viewed; viewers record their own views.
create policy "Authors and viewers can see story views"
  on public.story_views
  for select
  to authenticated
  using (
    viewer_id = auth.uid()
    or exists (
      select 1 from public.stories s
      where s.id = story_id and s.author_id = auth.uid()
    )
  );

create policy "Viewers can record story views"
  on public.story_views
  for insert
  to authenticated
  with check (viewer_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Find or create the 1-1 conversation between the caller and another user.
-- SECURITY DEFINER: inserts the conversation and both participant rows
-- atomically (clients cannot insert into conversations directly).
create or replace function public.get_or_create_direct_conversation(
  other_user uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  key text;
  conv uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if other_user = me then
    raise exception 'Cannot start a conversation with yourself';
  end if;
  if not exists (select 1 from public.profiles where id = other_user) then
    raise exception 'User not found';
  end if;

  key := least(me, other_user)::text || ':' || greatest(me, other_user)::text;

  select id into conv from public.conversations where direct_key = key;
  if conv is not null then
    return conv;
  end if;

  insert into public.conversations (is_group, direct_key, created_by)
  values (false, key, me)
  returning id into conv;

  insert into public.conversation_participants (conversation_id, user_id)
  values (conv, me), (conv, other_user);

  return conv;
end;
$$;

-- Group creation: creates the group and makes the owner an active admin
-- member in one call.
create or replace function public.create_group_with_owner(
  group_name text,
  group_slug text,
  group_description text,
  group_privacy public.group_privacy
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  gid uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.groups (name, slug, description, privacy, owner_id)
  values (group_name, group_slug, group_description, group_privacy, me)
  returning id into gid;

  insert into public.group_members (group_id, user_id, role, status)
  values (gid, me, 'admin', 'active');

  return gid;
end;
$$;
