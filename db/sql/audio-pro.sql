-- Music store "pro" upgrade: musical metadata (key / tempo / time-signature /
-- mood / year) on tracks, plus a lyrics store (plain or time-synced LRC for a
-- karaoke highlight). Apply on EC2 + `sudo docker restart postgrest`.

alter table public.audio_tracks
  add column if not exists bpm         integer,          -- tempo
  add column if not exists music_key   text,             -- e.g. "C minor"
  add column if not exists time_sig    text,             -- e.g. "4/4"
  add column if not exists mood        text,             -- e.g. "Uplifting"
  add column if not exists release_year integer;

-- One lyrics document per track. `synced` = the text is LRC ([mm:ss.xx] lines),
-- so the player can karaoke-highlight the current line; otherwise it's plain.
create table if not exists public.audio_lyrics (
  track_id   uuid primary key references public.audio_tracks(id) on delete cascade,
  lyrics     text not null,
  synced     boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.audio_lyrics enable row level security;
drop policy if exists audio_lyrics_read on public.audio_lyrics;
create policy audio_lyrics_read on public.audio_lyrics for select using (true);
grant select on public.audio_lyrics to authenticated, anon;
