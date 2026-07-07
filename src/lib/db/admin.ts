import "server-only";

import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  const since14 = new Date();
  since14.setDate(since14.getDate() - 13);
  const since7 = new Date();
  since7.setDate(since7.getDate() - 7);

  const [usersRes, postsRes, membersRes, recentUsersRes, recentPostsRes] =
    await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("posts").select("id", { count: "exact", head: true }),
      supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("profiles")
        .select("created_at")
        .gte("created_at", since14.toISOString())
        .limit(5000),
      supabase
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
  const supabase = await createClient();
  let query = supabase
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

export interface ReportWithContext extends Report {
  reporter: AuthorSummary;
  post: { id: string; content: string; author: AuthorSummary } | null;
  comment: { id: string; content: string; author: AuthorSummary } | null;
}

export async function getPendingReports(): Promise<ReportWithContext[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select(
      `*,
       reporter:profiles!reports_reporter_id_fkey(id, username, full_name, avatar_url),
       post:posts!reports_post_id_fkey(id, content, author:profiles!posts_author_id_fkey(id, username, full_name, avatar_url)),
       comment:comments!reports_comment_id_fkey(id, content, author:profiles!comments_author_id_fkey(id, username, full_name, avatar_url))`,
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50)
    .returns<ReportWithContext[]>();
  return data ?? [];
}

export async function getAuditLogs(limit = 100): Promise<
  (AuditLog & { actor: AuthorSummary | null })[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select(
      "*, actor:profiles!audit_logs_actor_id_fkey(id, username, full_name, avatar_url)",
    )
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<(AuditLog & { actor: AuthorSummary | null })[]>();
  return data ?? [];
}

export async function getSiteName(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "general")
    .maybeSingle();
  return (data?.value as { site_name?: string })?.site_name ?? "gwave.ai";
}
