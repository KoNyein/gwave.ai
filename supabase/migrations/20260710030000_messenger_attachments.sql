-- Messenger: video and file attachments.
--
-- Messages already support text, an image (image_path) and a shared location
-- (latitude/longitude). This adds a generic attachment for a video or an
-- arbitrary file (document), stored in the same public "media" bucket. We keep
-- image_path for images and add file_path + file_kind + file_name for the rest,
-- so the client can render a <video> player or a download card.

alter table public.messages
  add column if not exists file_path text
    check (file_path is null or char_length(file_path) <= 500);

alter table public.messages
  add column if not exists file_kind text
    check (file_kind is null or file_kind in ('video', 'file'));

alter table public.messages
  add column if not exists file_name text
    check (file_name is null or char_length(file_name) <= 200);

-- A message is valid if it carries text, an image, a location, or an attachment.
alter table public.messages drop constraint if exists message_has_content;
alter table public.messages add constraint message_has_content check (
  char_length(content) > 0
  or image_path is not null
  or latitude is not null
  or file_path is not null
);

-- A file attachment must name its kind, and vice-versa.
alter table public.messages drop constraint if exists message_file_kind;
alter table public.messages add constraint message_file_kind check (
  (file_path is null) = (file_kind is null)
);
