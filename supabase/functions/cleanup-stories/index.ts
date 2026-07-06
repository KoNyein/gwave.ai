// Scheduled cleanup for expired stories: deletes story rows past their
// 24h expiry and removes their media from the "media" storage bucket.
//
// Deploy:  supabase functions deploy cleanup-stories
// Schedule (hourly) via the dashboard, or:
//   supabase functions schedule create cleanup-stories --cron "0 * * * *"

// @ts-expect-error -- Deno remote import, resolved at deploy time.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: expired, error } = await supabase
    .from("stories")
    .select("id, media_path")
    .lt("expires_at", new Date().toISOString())
    .limit(500);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!expired || expired.length === 0) {
    return new Response(JSON.stringify({ deleted: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const paths = expired
    .map((story: { media_path: string | null }) => story.media_path)
    .filter((path: string | null): path is string => Boolean(path));
  if (paths.length > 0) {
    await supabase.storage.from("media").remove(paths);
  }

  const ids = expired.map((story: { id: string }) => story.id);
  const { error: deleteError } = await supabase
    .from("stories")
    .delete()
    .in("id", ids);

  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ deleted: ids.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
