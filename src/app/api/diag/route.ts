import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/diag — schema self-check. Probes the specific tables/columns the
 * data-heavy pages rely on and reports which ones the live database is
 * missing, so a page that renders "Something went wrong" can be pinned to an
 * unapplied migration without server-log access. Signed-in only; leaks only
 * whether a column exists, never data.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "sign in first" }, { status: 401 });
  }

  // Each probe selects one column/table with limit 0 — an error means the
  // column or table is missing (the message names it).
  const probes: { name: string; table: string; select: string }[] = [
    { name: "messages.latitude (location share)", table: "messages", select: "latitude" },
    { name: "messages.file_kind (attachments)", table: "messages", select: "file_kind" },
    { name: "messages.file_path (attachments)", table: "messages", select: "file_path" },
    { name: "posts.latitude (location share)", table: "posts", select: "latitude" },
    { name: "profiles.timezone (demographics)", table: "profiles", select: "timezone" },
    { name: "profiles.presence_status", table: "profiles", select: "presence_status" },
    { name: "lesson_comments (lesson comments)", table: "lesson_comments", select: "id" },
    { name: "conversations", table: "conversations", select: "id" },
  ];

  const results: Record<string, string> = {};
  const missing: string[] = [];
  for (const probe of probes) {
    const { error } = await supabase
      .from(probe.table)
      .select(probe.select)
      .limit(0);
    if (error) {
      results[probe.name] = `MISSING — ${error.message}`;
      missing.push(probe.name);
    } else {
      results[probe.name] = "ok";
    }
  }

  return NextResponse.json({
    ok: missing.length === 0,
    missing,
    hint:
      missing.length === 0
        ? "All probed columns/tables exist. The crash is elsewhere."
        : "Run the migration(s) that add the MISSING columns/tables in the Supabase SQL editor.",
    results,
  });
}
