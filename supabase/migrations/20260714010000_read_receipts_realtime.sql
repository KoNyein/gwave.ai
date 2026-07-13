-- Read receipts never moved without a reload.
--
-- messenger.tsx subscribes to postgres_changes UPDATE on conversation_participants
-- to learn when the other person read the thread ("seen"), but the table was never
-- added to the supabase_realtime publication — so the subscription was silently
-- dead and the tick only appeared on a page refresh. The SELECT policy already
-- lets a participant see the other participant's row, so Realtime can deliver it.
do $$
begin
  alter publication supabase_realtime add table public.conversation_participants;
exception
  when duplicate_object then null;
end $$;
