-- Messenger group chats.
--
-- The schema already models them (`conversations.is_group` + `title`, and
-- `conversation_participants` is a plain membership table) — what was missing
-- is a safe way to CREATE one. A client cannot do it directly: inserting the
-- conversation and its participant rows are two statements, and the RLS
-- policies only admit someone who is already a participant, so the first
-- insert would lock the creator out of the second.
--
-- These are security-definer RPCs, mirroring get_or_create_direct_conversation.
--
-- Run in the SQL editor / dockerised psql, then: sudo docker restart postgrest

-- Create a group with the caller as a member. `members` are added alongside;
-- the caller is always included even if omitted. Returns the conversation id.
create or replace function public.create_group_conversation(
  group_title text,
  members uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  conv uuid;
  clean_title text;
  ids uuid[];
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  clean_title := nullif(btrim(coalesce(group_title, '')), '');
  if clean_title is null then
    raise exception 'A group needs a name';
  end if;
  if char_length(clean_title) > 80 then
    raise exception 'Group name is too long';
  end if;

  -- Caller always belongs; drop duplicates, self and unknown profiles. Cap the
  -- size so one call can't fan a conversation out to the whole user table.
  select array_agg(distinct p.id) into ids
  from public.profiles p
  where p.id = any(coalesce(members, '{}'::uuid[]))
    and p.id <> me;

  ids := coalesce(ids, '{}'::uuid[]);
  if array_length(ids, 1) is null then
    raise exception 'Add at least one other member';
  end if;
  if array_length(ids, 1) > 100 then
    raise exception 'Too many members';
  end if;

  insert into public.conversations (is_group, title, created_by)
  values (true, clean_title, me)
  returning id into conv;

  insert into public.conversation_participants (conversation_id, user_id)
  select conv, u from unnest(ids || me) as u
  on conflict do nothing;

  return conv;
end;
$$;

-- Add members to an existing group. Only a current participant may invite, and
-- only to a group (a direct 1-1 thread must stay a pair).
create or replace function public.add_group_members(
  conversation uuid,
  members uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  added integer := 0;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (
    select 1 from public.conversation_participants
    where conversation_id = conversation and user_id = me
  ) then
    raise exception 'Not a member of this conversation';
  end if;
  if not exists (
    select 1 from public.conversations
    where id = conversation and is_group
  ) then
    raise exception 'Not a group conversation';
  end if;

  with wanted as (
    select p.id from public.profiles p
    where p.id = any(coalesce(members, '{}'::uuid[]))
  ), ins as (
    insert into public.conversation_participants (conversation_id, user_id)
    select conversation, id from wanted
    on conflict do nothing
    returning 1
  )
  select count(*) into added from ins;

  return added;
end;
$$;

-- Leave a group. Direct threads can't be left (there'd be nobody to talk to);
-- the last member leaving takes the conversation with them.
create or replace function public.leave_group_conversation(conversation uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  remaining integer;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (
    select 1 from public.conversations where id = conversation and is_group
  ) then
    raise exception 'Not a group conversation';
  end if;

  delete from public.conversation_participants
  where conversation_id = conversation and user_id = me;

  select count(*) into remaining
  from public.conversation_participants
  where conversation_id = conversation;

  if remaining = 0 then
    delete from public.conversations where id = conversation;
  end if;
end;
$$;

grant execute on function public.create_group_conversation(text, uuid[]) to authenticated;
grant execute on function public.add_group_members(uuid, uuid[]) to authenticated;
grant execute on function public.leave_group_conversation(uuid) to authenticated;

select 'messenger-groups: done' as status;
