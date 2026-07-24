-- Which APK build each user's phone runs, reported by the app's heartbeat.
-- Lets support see instantly whether a user is on an outdated version.
alter table public.profiles
  add column if not exists app_build integer;
