-- Route single-broadcaster Live through the LiveKit SFU instead of Mux.
--
-- Originally each live_streams row was backed by a Mux live stream (RTMP ingest
-- from OBS -> HLS playback). LiveKit lets the host broadcast straight from the
-- browser (camera/mic) and fans the stream out to viewers via the SFU — the
-- same media server used by co-host Live — so no Mux account is needed.
--
-- A row is a LiveKit stream when livekit_room is set (mux_stream_id null); it is
-- a legacy Mux stream when mux_stream_id is set. Both can coexist.

alter table public.live_streams
  alter column mux_stream_id drop not null;

alter table public.live_streams
  add column livekit_room text unique;
