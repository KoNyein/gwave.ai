import Link from "next/link";
import { redirect } from "next/navigation";
import { Gem, Leaf } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { UserAvatar } from "@/components/social/user-avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { quickSearchKnowledge } from "@/lib/db/knowledge";
import { displayName, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { AuthorSummary } from "@/types/social";

interface PostResult {
  id: string;
  content: string;
  created_at: string;
  author: AuthorSummary;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const t = await getTranslations("search");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const query = (searchParams.q ?? "").trim().slice(0, 100);

  let users: AuthorSummary[] = [];
  let posts: PostResult[] = [];
  let knowledge: Awaited<ReturnType<typeof quickSearchKnowledge>> = {
    strains: [],
    minerals: [],
  };

  if (query.length >= 2) {
    knowledge = await quickSearchKnowledge(query, 6);
    const supabase = await createClient();
    // Escape LIKE wildcards so user input is matched literally.
    const escaped = query.replace(/[%_\\]/g, "\\$&");
    const pattern = `%${escaped}%`;

    const [usersRes, postsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .or(`username.ilike.${pattern},full_name.ilike.${pattern}`)
        .not("username", "is", null)
        .limit(10),
      supabase
        .from("posts")
        .select(
          "id, content, created_at, author:profiles!posts_author_id_fkey(id, username, full_name, avatar_url)",
        )
        .ilike("content", pattern)
        .order("created_at", { ascending: false })
        .limit(10)
        .returns<PostResult[]>(),
    ]);
    users = usersRes.data ?? [];
    posts = postsRes.data ?? [];
  }

  return (
    <div className="space-y-4">
      <h1 className="px-1 text-xl font-bold">
        {query ? t("resultsFor", { query }) : t("title")}
      </h1>

      {query.length < 2 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            {t("hint")}
          </CardContent>
        </Card>
      ) : (
        <>
          {knowledge.strains.length > 0 || knowledge.minerals.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t("knowledge")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {knowledge.strains.map((strain) => (
                  <Link
                    key={strain.slug}
                    href={`/strains/${strain.slug}`}
                    className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
                  >
                    <Leaf className="h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {strain.name}
                      </p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {strain.type}
                        {strain.thc ? ` · THC ${strain.thc}%` : ""}
                      </p>
                    </div>
                  </Link>
                ))}
                {knowledge.minerals.map((mineral) => (
                  <Link
                    key={mineral.slug}
                    href={`/minerals/${mineral.slug}`}
                    className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
                  >
                    <Gem className="h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {mineral.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {mineral.category}
                        {mineral.symbol ? ` · ${mineral.symbol}` : ""}
                      </p>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("people")}</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {users.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {t("noResults")}
                </p>
              ) : (
                users.map((user) => (
                  <Link
                    key={user.id}
                    href={user.username ? `/u/${user.username}` : "#"}
                    className="flex items-center gap-3 py-2"
                  >
                    <UserAvatar profile={user} linked={false} />
                    <div>
                      <p className="text-sm font-semibold">
                        {displayName(user)}
                      </p>
                      {user.username ? (
                        <p className="text-xs text-muted-foreground">
                          @{user.username}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("posts")}</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {posts.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {t("noResults")}
                </p>
              ) : (
                posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/p/${post.id}`}
                    className="flex items-start gap-3 py-3"
                  >
                    <UserAvatar profile={post.author} linked={false} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {displayName(post.author)}{" "}
                        <span className="font-normal text-muted-foreground">
                          · {timeAgo(post.created_at)}
                        </span>
                      </p>
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {post.content}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
