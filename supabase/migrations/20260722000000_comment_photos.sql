-- Photo comments: comments can carry one attached image, mirroring how
-- messenger messages do it (messages.image_path). Purely additive.
alter table public.comments
  add column if not exists image_path text
    check (image_path is null or char_length(image_path) <= 500);

-- A comment may now be photo-only, so "content must be 1..4000 chars" becomes
-- "content is capped at 4000 chars, and a comment needs text OR a photo".
alter table public.comments
  drop constraint if exists comment_content_length;
alter table public.comments
  add constraint comment_content_length
    check (
      char_length(content) <= 4000
      and (char_length(content) >= 1 or image_path is not null)
    );
