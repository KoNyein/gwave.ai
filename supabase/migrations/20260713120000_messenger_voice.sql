-- Messenger: voice messages.
--
-- Reuses the existing attachment columns (file_path / file_kind / file_name)
-- rather than adding a parallel set: a voice note is just an attachment whose
-- kind is 'audio'. The only genuinely new fact is how long it runs — the client
-- needs that to draw the bubble ("0:14") before anything is downloaded, so it is
-- stored rather than probed.
--
-- file_kind's original CHECK was created inline with the column, so it carries
-- the auto-generated name messages_file_kind_check; widen it by replacing it.

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

-- A voice note has no text and no name to show — only a duration. Keep the two
-- honest about each other: audio must say how long it is, and nothing else may.
alter table public.messages drop constraint if exists message_audio_duration;
alter table public.messages add constraint message_audio_duration check (
  (file_kind = 'audio') = (duration_seconds is not null)
);
