-- ---------------------------------------------------------------------------
-- Private bucket for chat attachments.
--
-- Photos, documents and voice notes sent in the messenger lived in the public
-- "media" bucket alongside posts, avatars and reels: readable by anyone with the
-- URL, with no auth at all. The bucket can't simply be flipped to private —
-- posts/avatars/reels resolve through it app-wide — and the key layout carries
-- no feature prefix (everything is <userId>/<uuid>.<ext>), so chat objects can't
-- be separated by path either. They CAN be enumerated from the database, via
-- messages.image_path / messages.file_path, which is what the backfill uses.
--
-- New home: a private "chat-media" bucket with the same <userId>/<uuid>.<ext>
-- key shape, so a path already stored on a messages row resolves unchanged.
-- Reads go through /api/media/chat/[...path], which authorizes the caller and
-- redirects to a short-lived signed URL. Same model the private "slips" bucket
-- already uses (see 20260705150000_membership.sql).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', false)
on conflict (id) do nothing;

-- Every chat attachment load looks a path up in messages. Without these it is a
-- sequential scan of the whole table, per image. Partial: the overwhelming
-- majority of messages are plain text and carry neither column.
create index if not exists messages_image_path_idx
  on public.messages (image_path) where image_path is not null;
create index if not exists messages_file_path_idx
  on public.messages (file_path) where file_path is not null;

-- Authorize one chat object, in one indexed query, and hand back what the read
-- route needs to serve it: the kind (which picks the signature lifetime) and the
-- original filename (for Content-Disposition on downloads). Zero rows means "not
-- authorized" and "no such attachment" alike — the route answers 404 to both
-- rather than confirming that a path exists.
create or replace function public.chat_object_meta(p_path text)
returns table (kind text, file_name text)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(m.file_kind, 'image') as kind,
    m.file_name
  from public.messages m
  join public.conversation_participants cp
    on cp.conversation_id = m.conversation_id
  where cp.user_id = auth.uid()
    -- The object's owner folder must be the message's sender. messages.image_path
    -- and messages.file_path are never validated on insert, so *without this line*
    -- anyone who learns a path can self-authorize: send yourself a message quoting
    -- someone else's path and the join above would happily match it. Requiring the
    -- folder to equal the sender means a user can only ever claim their own objects.
    and m.sender_id::text = split_part(p_path, '/', 1)
    and (m.image_path = p_path or m.file_path = p_path)
  limit 1;
$$;

create or replace function public.can_read_chat_object(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.chat_object_meta(p_path));
$$;

-- These SECURITY DEFINER functions must not be callable by the `anon` role over
-- /rest/v1/rpc. They return nothing for an anonymous caller (auth.uid() is null →
-- the participant join matches no rows), but lock them down anyway. Note Supabase
-- sets a default privilege granting EXECUTE on new public functions to anon
-- DIRECTLY, so revoking from PUBLIC alone leaves anon with access — revoke it too.
revoke execute on function public.chat_object_meta(text) from public, anon;
revoke execute on function public.can_read_chat_object(text) from public, anon;
grant execute on function public.chat_object_meta(text) to authenticated;
grant execute on function public.can_read_chat_object(text) to authenticated;

-- Some hosted Supabase projects do not grant migrations ownership of
-- storage.objects; in that case create these three policies from the dashboard
-- instead (Storage → chat-media → Policies). Same guard as the media/slips blocks.
-- drop-if-exists before each create so this block is re-runnable: on a project
-- where migrations DO own storage.objects the policies may already exist, and a
-- bare create would error "policy already exists" (not caught by the handler).
do $$
begin
  drop policy if exists "Users can upload chat media into their own folder" on storage.objects;
  create policy "Users can upload chat media into their own folder"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'chat-media'
      and (storage.foldername(name))[1] = auth.uid()::text
    );

  -- Load-bearing, not decorative: createSignedUrl() only succeeds if the caller
  -- can SELECT the object, so this policy IS the authorization check behind the
  -- read route. Both call the same function, so they cannot drift apart.
  drop policy if exists "Conversation participants can read chat media" on storage.objects;
  create policy "Conversation participants can read chat media"
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'chat-media'
      and public.can_read_chat_object(name)
    );

  drop policy if exists "Users can delete their own chat media" on storage.objects;
  create policy "Users can delete their own chat media"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'chat-media'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
exception
  when insufficient_privilege then
    raise notice 'Skipped storage.objects chat-media policies (insufficient privilege); create them via the dashboard.';
end;
$$;
