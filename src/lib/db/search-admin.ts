import { createAdminClient } from "@/lib/data/admin";

/**
 * Admin-only reads over the search keyword log.
 *
 * search_queries is RLS-sealed with zero policies, so everything here goes
 * through the service-role client. Callers are admin pages behind
 * requireRole("admin") — that role check IS the gate; never import this from a
 * public route.
 *
 * Grouping happens in code because PostgREST has no GROUP BY. 30 days of
 * queries is small enough to fold in memory at this scale, and doing it here
 * keeps one query instead of a view that would need its own migration.
 */

export interface KeywordRow {
  q: string;
  count: number;
  /** How many of those searches came back empty. */
  zero: number;
  lastAt: string;
}

export interface SearchOverview {
  total: number;
  unique: number;
  searchers: number;
  zeroTotal: number;
  today: number;
  /** Searches per day, oldest first — the activity chart. */
  byDay: { day: string; count: number }[];
  /** Which box they searched from. */
  bySource: { label: string; count: number }[];
  /** Most-searched keywords. */
  top: KeywordRow[];
  /** Keywords that returned nothing — the gap list. */
  zeroResults: KeywordRow[];
  /** The raw tail, newest first, with who typed it. */
  recent: {
    q: string;
    source: string;
    resultCount: number;
    at: string;
    username: string | null;
    fullName: string | null;
  }[];
}

const DAYS = 30;

export async function getSearchOverview(): Promise<SearchOverview> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();

  const { data: rows } = await admin
    .from("search_queries")
    .select("user_id, q, source, result_count, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50_000)
    .returns<
      {
        user_id: string | null;
        q: string;
        source: string;
        result_count: number;
        created_at: string;
      }[]
    >();
  const queries = rows ?? [];

  // --- Per-day, zero-filled so the chart has no gaps.
  const dayCounts = new Map<string, number>();
  for (let i = DAYS - 1; i >= 0; i--) {
    dayCounts.set(
      new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10),
      0,
    );
  }
  const sources = new Map<string, number>();
  const byKeyword = new Map<string, { count: number; zero: number; last: string }>();
  const searchers = new Set<string>();

  for (const r of queries) {
    const day = r.created_at.slice(0, 10);
    if (dayCounts.has(day)) dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    sources.set(r.source, (sources.get(r.source) ?? 0) + 1);
    if (r.user_id) searchers.add(r.user_id);
    const k = byKeyword.get(r.q);
    if (!k) {
      // Rows are newest-first, so the first sighting is the latest.
      byKeyword.set(r.q, {
        count: 1,
        zero: r.result_count === 0 ? 1 : 0,
        last: r.created_at,
      });
    } else {
      k.count += 1;
      if (r.result_count === 0) k.zero += 1;
    }
  }

  const keywords: KeywordRow[] = [...byKeyword.entries()]
    .map(([q, v]) => ({ q, count: v.count, zero: v.zero, lastAt: v.last }))
    .sort((a, b) => b.count - a.count);

  // --- The recent tail gets names attached.
  const tail = queries.slice(0, 100);
  const ids = [...new Set(tail.map((r) => r.user_id).filter((v): v is string => Boolean(v)))];
  const profiles = ids.length
    ? (
        await admin
          .from("profiles")
          .select("id, username, full_name")
          .in("id", ids)
          .returns<{ id: string; username: string | null; full_name: string | null }[]>()
      ).data ?? []
    : [];
  const byId = new Map(profiles.map((p) => [p.id, p]));

  const today = new Date().toISOString().slice(0, 10);

  return {
    total: queries.length,
    unique: byKeyword.size,
    searchers: searchers.size,
    zeroTotal: queries.filter((r) => r.result_count === 0).length,
    today: queries.filter((r) => r.created_at.slice(0, 10) === today).length,
    byDay: [...dayCounts.entries()].map(([day, count]) => ({ day, count })),
    bySource: [...sources.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    top: keywords.slice(0, 100),
    zeroResults: keywords
      // Only keywords that ALWAYS came back empty are a real content gap;
      // one empty hit on a keyword that usually works is a typo.
      .filter((k) => k.zero === k.count)
      .slice(0, 100),
    recent: tail.map((r) => {
      const p = r.user_id ? byId.get(r.user_id) : undefined;
      return {
        q: r.q,
        source: r.source,
        resultCount: r.result_count,
        at: r.created_at,
        username: p?.username ?? null,
        fullName: p?.full_name ?? null,
      };
    }),
  };
}
