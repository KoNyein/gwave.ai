-- ================================================================
-- Messenger — voice messages patch
-- Copy into the Supabase SQL Editor and click "Run" (idempotent).
-- Lets file_kind be 'audio' and adds duration_seconds, so a voice note
-- can be sent as an attachment and its length shown before it downloads.
-- ================================================================

alter table public.messages
  add column if not exists duration_seconds integer
    check (
      duration_seconds is null
      or (duration_seconds > 0 and duration_seconds <= 600)
    );

alter table public.messages drop constraint if exists messages_file_kind_check;
alter table public.messages add constraint messages_file_kind_check check (
  file_kind is null or file_kind in ('video', 'file', 'audio')
);

alter table public.messages drop constraint if exists message_audio_duration;
alter table public.messages add constraint message_audio_duration check (
  (file_kind = 'audio') = (duration_seconds is not null)
);
