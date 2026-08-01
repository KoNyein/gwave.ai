-- Where a composition's replay is being written, remembered while AWS will
-- still say.
--
-- IVS hands us the S3 recording prefix in the StartComposition response, and
-- then deletes the composition record shortly after the broadcast ends. The
-- code used to ask GetComposition for the prefix afterwards, which by then
-- answers:
--
--   Resource: arn:aws:ivs:ap-northeast-1:...:composition/tcs3RASP3Asy not found
--
-- Four broadcasts in a row were recorded correctly to S3 and still showed no
-- replay, because nothing could name the file. This column holds the prefix
-- from the moment the composition starts, so the replay is findable for as long
-- as it exists.
--
-- Idempotent: safe to re-run (files are piped straight into psql, no ledger).

alter table public.live_streams
  add column if not exists ivs_recording_prefix text;
