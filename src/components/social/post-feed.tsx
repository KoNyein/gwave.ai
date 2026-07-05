"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { PostCard } from "@/components/social/post-card";
import { PostComposer } from "@/components/social/post-composer";
import { Card, CardContent } from "@/components/ui/card";
import type { AuthorSummary, FeedPage, FeedPost } from "@/types/social";

type FeedScope = "feed" | "profile" | "group" | "page";

interface PostFeedProps {
  initialPage: FeedPage;
  currentUser: AuthorSummary;
  scope: FeedScope;
  /** Profile id / group id / page id, depending on scope. */
  contextId?: string;
  /** Show the composer above the feed (feed, own profile, joined group…). */
  showComposer?: boolean;
  /** Where the composer publishes to (group/page feeds). */
  composerContext?: { groupId?: string; pageId?: string };
}

function buildUrl(
  scope: FeedScope,
  contextId: string | undefined,
  cursor: string | null,
): string {
  const params = new URLSearchParams({ scope });
  if (contextId) {
    const key =
      scope === "profile" ? "author" : scope === "group" ? "group" : "page";
    params.set(key, contextId);
  }
  if (cursor) params.set("cursor", cursor);
  return `/api/posts?${params.toString()}`;
}

export function PostFeed({
  initialPage,
  currentUser,
  scope,
  contextId,
  showComposer = false,
  composerContext,
}: PostFeedProps) {
  const t = useTranslations("feed");
  const [posts, setPosts] = React.useState<FeedPost[]>(initialPage.posts);
  const [nextCursor, setNextCursor] = React.useState<string | null>(
    initialPage.nextCursor,
  );
  const [loadingMore, setLoadingMore] = React.useState(false);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const loadingRef = React.useRef(false);

  const loadMore = React.useCallback(async () => {
    if (loadingRef.current || !nextCursor) return;
    loadingRef.current = true;
    setLoadingMore(true);
    try {
      const response = await fetch(buildUrl(scope, contextId, nextCursor));
      if (!response.ok) return;
      const page: FeedPage = await response.json();
      setPosts((previous) => {
        const seen = new Set(previous.map((p) => p.id));
        return [...previous, ...page.posts.filter((p) => !seen.has(p.id))];
      });
      setNextCursor(page.nextCursor);
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [nextCursor, scope, contextId]);

  // Refetch the first page (after creating or sharing a post).
  const refresh = React.useCallback(async () => {
    const response = await fetch(buildUrl(scope, contextId, null));
    if (!response.ok) return;
    const page: FeedPage = await response.json();
    setPosts(page.posts);
    setNextCursor(page.nextCursor);
  }, [scope, contextId]);

  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !nextCursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "600px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, nextCursor]);

  return (
    <div className="space-y-4">
      {showComposer ? (
        <PostComposer
          currentUser={currentUser}
          onCreated={refresh}
          context={composerContext}
        />
      ) : null}

      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUser={currentUser}
          onDeleted={(postId) =>
            setPosts((previous) => previous.filter((p) => p.id !== postId))
          }
          onShared={refresh}
        />
      ))}

      {posts.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            {t("empty")}
          </CardContent>
        </Card>
      ) : null}

      <div ref={sentinelRef} />
      {loadingMore ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}
    </div>
  );
}
