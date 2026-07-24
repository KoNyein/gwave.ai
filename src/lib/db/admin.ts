import "server-only";

import { createAdminClient } from "@/lib/data/admin";
import { createAnonClient } from "@/lib/data/anon";
import { createClient } from "@/lib/data/server";
import { DEFAULT_THEME, isSiteTheme, type SiteTheme } from "@/lib/theme";
import type { AuditLog, Profile, Report } from "@/types/database";
import type { AuthorSummary } from "@/types/social";

export interface AdminStats {
  totalUsers: number;
  newUsers7d: number;
  totalPosts: number;
  activeMembers: number;
  signupsByDay: { day: string; count: number }[];
  postsByDay: { day: string; count: number }[];
}

export interface AdminActivityStats {
  dau: number;
  wau: number;
  mau: number;
  total_orders: number;
  orders_30d: number;
  delivered_orders: number;
  lessons_completed: number;
  certificates_issued: number;
  active_learners_30d: number;
}

/** Engagement + commerce metrics (admin-only RPC). */
export async function getAdminActivityStats(): Promise<AdminActivityStats> {
  const db = await createClient();
  const { data } = await db.rpc("admin_activity_stats");
  const d = (data as Partial<AdminActivityStats> | null) ?? {};
  return {
    dau: d.dau ?? 0,
    wau: d.wau ?? 0,
    mau: d.mau ?? 0,
    total_orders: d.total_orders ?? 0,
    orders_30d: d.orders_30d ?? 0,
    delivered_orders: d.delivered_orders ?? 0,
    lessons_completed: d.lessons_completed ?? 0,
    certificates_issued: d.certificates_issued ?? 0,
    active_learners_30d: d.active_learners_30d ?? 0,
  };
}

function bucketByDay(rows: { created_at: string }[], days: number) {
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    buckets.set(date.toISOString().slice(0, 10), 0);
  }
  for (const row of rows) {
    const day = row.created_at.slice(0, 10);
    if (buckets.has(day)) buckets.set(day, (buckets.get(day) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([day, count]) => ({ day, count }));
}

export async function getAdminStats(): Promise<AdminStats> {
  const db = await createClient();
  const since14 = new Date();
  since14.setDate(since14.getDate() - 13);
  const since7 = new Date();
  since7.setDate(since7.getDate() - 7);

  const [usersRes, postsRes, membersRes, recentUsersRes, recentPostsRes] =
    await Promise.all([
      db.from("profiles").select("id", { count: "exact", head: true }),
      db.from("posts").select("id", { count: "exact", head: true }),
      db
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      db
        .from("profiles")
        .select("created_at")
        .gte("created_at", since14.toISOString())
        .limit(5000),
      db
        .from("posts")
        .select("created_at")
        .gte("created_at", since14.toISOString())
        .limit(5000),
    ]);

  const signups = recentUsersRes.data ?? [];
  return {
    totalUsers: usersRes.count ?? 0,
    newUsers7d: signups.filter(
      (row) => row.created_at >= since7.toISOString(),
    ).length,
    totalPosts: postsRes.count ?? 0,
    activeMembers: membersRes.count ?? 0,
    signupsByDay: bucketByDay(signups, 14),
    postsByDay: bucketByDay(recentPostsRes.data ?? [], 14),
  };
}

export async function getUsers(search?: string): Promise<Profile[]> {
  const db = await createClient();
  let query = db
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (search && search.trim().length >= 2) {
    const pattern = `%${search.trim().replace(/[%_\\]/g, "\\$&")}%`;
    query = query.or(
      `username.ilike.${pattern},full_name.ilike.${pattern}`,
    );
  }
  const { data } = await query;
  return data ?? [];
}

export interface AdminUserLocation {
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  role: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  updatedAt: string;
}

/**
 * Latest shared location per user, for the admin map. Flat queries only (no
 * PostgREST embeds) — read the locations, then the matching profiles, and
 * assemble in code. Only users who opted into location sharing appear here.
 */
export async function getUserLocations(
  limit = 500,
): Promise<AdminUserLocation[]> {
  const db = await createClient();
  const { data: locs } = await db
    .from("member_locations")
    .select("user_id, latitude, longitude, accuracy, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (!locs || locs.length === 0) return [];

  // De-dupe to the newest row per user (already ordered newest-first).
  const seen = new Set<string>();
  const latest = locs.filter((l) => {
    const id = l.user_id as string;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const ids = latest.map((l) => l.user_id as string);
  const { data: profiles } = await db
    .from("profiles")
    .select("id, username, full_name, avatar_url, role")
    .in("id", ids);
  const byId = new Map(
    (profiles ?? []).map((p) => [p.id as string, p]),
  );

  return latest
    .map((l) => {
      const p = byId.get(l.user_id as string);
      return {
        userId: l.user_id as string,
        name:
          (p?.full_name as string) ||
          (p?.username as string) ||
          "Gwave user",
        username: (p?.username as string) ?? null,
        avatarUrl: (p?.avatar_url as string) ?? null,
        role: (p?.role as string) ?? "user",
        latitude: l.latitude as number,
        longitude: l.longitude as number,
        accuracy: (l.accuracy as number) ?? null,
        updatedAt: l.updated_at as string,
      };
    })
    .filter(
      (u) =>
        typeof u.latitude === "number" && typeof u.longitude === "number",
    );
}

export interface ReportWithContext extends Report {
  reporter: AuthorSummary;
  post: { id: string; content: string; author: AuthorSummary } | null;
  comment: { id: string; content: string; author: AuthorSummary } | null;
  profile: AuthorSummary | null;
}

export async function getPendingReports(): Promise<ReportWithContext[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("reports")
    .select(
      `*,
       reporter:profiles!reports_reporter_id_fkey(id, username, full_name, avatar_url),
       post:posts!reports_post_id_fkey(id, content, author:profiles!posts_author_id_fkey(id, username, full_name, avatar_url)),
       comment:comments!reports_comment_id_fkey(id, content, author:profiles!comments_author_id_fkey(id, username, full_name, avatar_url)),
       profile:profiles!reports_profile_id_fkey(id, username, full_name, avatar_url)`,
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50)
    .returns<ReportWithContext[]>();
  // A swallowed error would render an empty moderation queue during a failure —
  // indistinguishable from "no pending reports", so a moderator sees nothing to
  // do while reports pile up. Throw so the /admin error boundary shows a retry.
  // A genuinely empty queue is `data: []` with no error and still renders empty.
  if (error) throw new Error(`Failed to load pending reports: ${error.message}`);
  return data ?? [];
}

export async function getAuditLogs(limit = 100): Promise<
  (AuditLog & { actor: AuthorSummary | null })[]
> {
  const db = await createClient();
  const { data } = await db
    .from("audit_logs")
    .select(
      "*, actor:profiles!audit_logs_actor_id_fkey(id, username, full_name, avatar_url)",
    )
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<(AuditLog & { actor: AuthorSummary | null })[]>();
  return data ?? [];
}

/**
 * The active site template. Uses the cookie-less anon client so the root
 * layout can call it anywhere (site_settings is publicly readable), and
 * falls back to the default theme when the database is unreachable
 * (e.g. during builds with placeholder env).
 */
export async function getSiteTheme(): Promise<SiteTheme> {
  try {
    const db = createAnonClient();
    const { data } = await db
      .from("site_settings")
      .select("value")
      .eq("key", "appearance")
      .maybeSingle();
    const theme = (data?.value as { theme?: string })?.theme;
    return isSiteTheme(theme) ? theme : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export async function getSiteName(): Promise<string> {
  const db = await createClient();
  const { data } = await db
    .from("site_settings")
    .select("value")
    .eq("key", "general")
    .maybeSingle();
  return (data?.value as { site_name?: string })?.site_name ?? "Gwave";
}

export interface DemographicRow {
  label: string;
  count: number;
}

/** User age distribution by band (admin-only RPC). */
export async function getDemographicsAge(): Promise<DemographicRow[]> {
  const db = await createClient();
  const { data } = await db.rpc("demographics_age");
  return ((data as { band: string; count: number }[] | null) ?? []).map((r) => ({
    label: r.band,
    count: Number(r.count),
  }));
}

/** User region distribution by timezone (admin-only RPC). */
export async function getDemographicsRegion(): Promise<DemographicRow[]> {
  const db = await createClient();
  const { data } = await db.rpc("demographics_region");
  return ((data as { region: string; count: number }[] | null) ?? []).map((r) => ({
    label: r.region,
    count: Number(r.count),
  }));
}

// ---------------------------------------------------------------------------
// System-wide module metrics — a per-feature data breakdown for the admin
// "Modules" dashboard. Uses the privileged admin client (BYPASSRLS) so counts
// reflect the whole system, and counts each table defensively: a table that
// doesn't exist yet returns `null` (shown as "n/a") instead of throwing.
// ---------------------------------------------------------------------------

export interface ModuleMetric {
  label: string;
  value: number | null;
  recent?: number | null; // last-7-day count, when meaningful
}

export interface ModuleSection {
  title: string;
  hint: string;
  metrics: ModuleMetric[];
}

/** A narrowly-typed view of the PostgREST client for dynamic head-counts. */
interface CountResult {
  count: number | null;
  error: unknown;
}
interface CountQuery extends PromiseLike<CountResult> {
  gte(column: string, value: string): CountQuery;
  eq(column: string, value: string): CountQuery;
}
interface CountClient {
  from(relation: string): {
    select(columns: string, opts: { count: "exact"; head: true }): CountQuery;
  };
}

type Filter = (q: CountQuery) => CountQuery;

async function countTable(
  sb: CountClient,
  table: string,
  filter?: Filter,
): Promise<number | null> {
  try {
    let q = sb.from(table).select("*", { count: "exact", head: true });
    if (filter) q = filter(q);
    const { count, error } = await q;
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

export async function getModuleMetrics(): Promise<ModuleSection[]> {
  const sb = createAdminClient() as unknown as CountClient;
  const since7 = new Date();
  since7.setDate(since7.getDate() - 7);
  const iso7 = since7.toISOString();
  const recent: Filter = (q) => q.gte("created_at", iso7);

  // [label, table, filter?, recentTrue?]
  type Spec = [string, string, Filter?, boolean?];
  const sections: { title: string; hint: string; specs: Spec[] }[] = [
    {
      title: "👥 Social",
      hint: "Feed, friends, groups, pages, stories, chat",
      specs: [
        ["Users", "profiles", undefined, true],
        ["Posts", "posts", undefined, true],
        ["Comments", "comments", undefined, true],
        ["Reactions", "reactions"],
        ["Shares", "shares"],
        ["Follows", "follows"],
        ["Friendships", "friendships"],
        ["Groups", "groups"],
        ["Group members", "group_members"],
        ["Pages", "pages"],
        ["Page followers", "page_followers"],
        ["Stories", "stories"],
        ["Conversations", "conversations"],
        ["Messages", "messages", undefined, true],
        ["Notifications", "notifications"],
      ],
    },
    {
      title: "📺 Live & media",
      hint: "Broadcasts, live chat, post media & views",
      specs: [
        ["Live streams", "live_streams", undefined, true],
        ["Live now", "live_streams", (q) => q.eq("status", "live")],
        ["Live chat", "live_chat_messages"],
        ["Live reactions", "live_reactions"],
        ["Post media", "post_media"],
        ["Post views", "post_views"],
      ],
    },
    {
      title: "🎓 Learning",
      hint: "Lesson progress, projects, points, teachers",
      specs: [
        ["Lesson progress", "lesson_progress", undefined, true],
        ["Member projects", "member_projects"],
        ["Learning points", "learning_points"],
        ["Teacher applications", "teacher_applications"],
        ["Certificates", "certificates"],
      ],
    },
    {
      title: "🛒 Commerce (POS / Shop)",
      hint: "Stores, products, sales, inventory",
      specs: [
        ["Stores", "stores"],
        ["Store members", "store_members"],
        ["Products", "pos_products"],
        ["Categories", "pos_categories"],
        ["Customers", "pos_customers"],
        ["Sales", "sales", undefined, true],
        ["Sale items", "sale_items"],
        ["Shifts", "shifts"],
        ["Stock movements", "stock_movements"],
        ["Orders", "orders", undefined, true],
        ["Marketplace listings", "marketplace_listings"],
        ["Reviews", "reviews"],
      ],
    },
    {
      title: "💳 Finance & membership",
      hint: "Subscriptions, payments, wallet",
      specs: [
        ["Subscriptions", "subscriptions"],
        ["Active members", "subscriptions", (q) => q.eq("status", "active")],
        ["Payments", "payments", undefined, true],
        ["Invoices", "invoices"],
        ["Membership plans", "membership_plans"],
        ["Boost campaigns", "boost_campaigns"],
        ["Wallets", "gpay_wallets"],
      ],
    },
    {
      title: "🌱 Farm & IoT",
      hint: "Devices, sensors, automation",
      specs: [
        ["Devices", "devices"],
        ["Sensor readings", "sensor_readings", undefined, true],
        ["Automation rules", "automation_rules"],
        ["Alerts", "alerts"],
        ["Scenes", "scenes"],
        ["Scheduled scenes", "scene_schedules"],
        ["Device commands", "device_commands"],
      ],
    },
    {
      title: "❤️ Health & safety",
      hint: "Vitals, activity journal, locations, moderation",
      specs: [
        ["Health vitals", "health_vitals", undefined, true],
        ["Activity events", "health_events"],
        ["Shared locations", "member_locations"],
        ["Reports", "reports", undefined, true],
        ["Blocks", "blocks"],
        ["Deletion requests", "deletion_requests"],
        ["Consents", "consents"],
      ],
    },
    {
      title: "🧩 Content & games",
      hint: "Knowledge base, games, wellness",
      specs: [
        ["Strains", "strains"],
        ["Minerals", "minerals"],
        ["Wellness items", "wellness_items"],
        ["Games", "games"],
        ["Dating matches", "matches"],
        ["Jobs", "jobs"],
      ],
    },
    {
      title: "🛠 Developer",
      hint: "API keys, logs, webhooks, flags",
      specs: [
        ["API keys", "api_keys"],
        ["API logs", "api_logs", undefined, true],
        ["Webhooks", "webhooks"],
        ["Webhook deliveries", "webhook_deliveries"],
        ["Feature flags", "feature_flags"],
        ["Audit logs", "audit_logs", undefined, true],
      ],
    },
  ];

  return Promise.all(
    sections.map(async (sec) => ({
      title: sec.title,
      hint: sec.hint,
      metrics: await Promise.all(
        sec.specs.map(async ([label, table, filter, wantRecent]) => ({
          label,
          value: await countTable(sb, table, filter),
          recent: wantRecent ? await countTable(sb, table, recent) : undefined,
        })),
      ),
    })),
  );
}
