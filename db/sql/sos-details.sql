-- Richer SOS alerts: why, a callback phone number, and an attached photo or
-- video (stored in the chat-media bucket). The app writes these best-effort,
-- so run this then: sudo docker restart postgrest
alter table public.sos_alerts add column if not exists reason text;
alter table public.sos_alerts add column if not exists phone text;
alter table public.sos_alerts add column if not exists media_path text;
alter table public.sos_alerts add column if not exists media_kind text;
