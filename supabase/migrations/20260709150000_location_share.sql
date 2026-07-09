-- Location sharing (Facebook-style).
--   * posts: optional check-in — a place name plus GPS coordinates, shown on
--     the post card with a map view.
--   * messages: share-current-location in the messenger — coordinates only,
--     rendered as a map bubble.
-- Coordinates are always user-initiated (the composer asks for GPS
-- permission); nothing is recorded automatically.

alter table public.posts
  add column location_name text
    check (location_name is null or char_length(location_name) <= 120),
  add column latitude double precision
    check (latitude is null or (latitude >= -90 and latitude <= 90)),
  add column longitude double precision
    check (longitude is null or (longitude >= -180 and longitude <= 180)),
  -- A check-in needs at least a name or coordinates, and coordinates come
  -- in pairs.
  add constraint posts_location_pair check (
    (latitude is null) = (longitude is null)
  );

alter table public.messages
  add column latitude double precision
    check (latitude is null or (latitude >= -90 and latitude <= 90)),
  add column longitude double precision
    check (longitude is null or (longitude >= -180 and longitude <= 180)),
  add constraint messages_location_pair check (
    (latitude is null) = (longitude is null)
  );
