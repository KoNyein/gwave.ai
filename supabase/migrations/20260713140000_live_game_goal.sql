-- International-grade game live streaming: tag a stream with the game being
-- played and set a support goal (a donation/gift target with a progress bar,
-- like the fundraising bars on TikTok/Bigo game streams). Gift totals already
-- come from live_gift_events; these columns add the game label + goal.

-- (The gifter leaderboard already exists via getTopGifters / live_gift_events;
-- these columns add the game tag and the support-goal bar.)
alter table public.live_streams
  add column if not exists game_name text
    check (game_name is null or char_length(game_name) <= 60),
  add column if not exists goal_amount numeric(14, 2)
    check (goal_amount is null or goal_amount >= 0),
  add column if not exists goal_label text
    check (goal_label is null or char_length(goal_label) <= 80);

-- Total G-Pay gifted to a stream — drives the goal progress bar.
create or replace function public.live_gift_total(p_stream uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount_mmk), 0)::numeric
  from public.live_gift_events
  where stream_id = p_stream;
$$;

grant execute on function public.live_gift_total(uuid) to authenticated;
