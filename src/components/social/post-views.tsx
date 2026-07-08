"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { UserAvatar } from "@/components/social/user-avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getPostViewers, recordPostView } from "@/lib/actions/posts";
import { displayName, timeAgo } from "@/lib/format";
import type { PostViewer } from "@/types/social";

/**
 * Fires recordPostView once when the post card has been at least half
 * visible for a second — a "view" in the Facebook sense, not an impression.
 * Renders nothing; skipped entirely on the viewer's own posts.
 */
export function PostViewTracker({ postId }: { postId: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const sent = React.useRef(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node || sent.current) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting ?? false;
        if (visible && !sent.current && timer === null) {
          timer = setTimeout(() => {
            sent.current = true;
            observer.disconnect();
            void recordPostView(postId);
          }, 1000);
        } else if (!visible && timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => {
      if (timer !== null) clearTimeout(timer);
      observer.disconnect();
    };
  }, [postId]);

  // 1px-tall strip at the card's vertical middle — zero-area elements never
  // cross a non-zero IntersectionObserver threshold.
  return (
    <span ref={ref} aria-hidden className="absolute inset-x-0 top-1/2 h-px" />
  );
}

/**
 * Author-only "N views" button + audience dialog: who saw the post, newest
 * first. The viewer list is loaded on demand and protected by RLS (only the
 * post's author ever receives it).
 */
export function PostViewsButton({
  postId,
  viewCount,
}: {
  postId: string;
  viewCount: number;
}) {
  const t = useTranslations("post");
  const [open, setOpen] = React.useState(false);
  const [viewers, setViewers] = React.useState<PostViewer[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function openDialog() {
    setOpen(true);
    if (viewers !== null) return;
    setLoading(true);
    const result = await getPostViewers(postId);
    setViewers(result.ok ? result.data : []);
    setLoading(false);
  }

  if (viewCount <= 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="flex items-center gap-1 hover:underline"
        aria-label={t("viewers")}
      >
        <Eye className="h-3.5 w-3.5" />
        {t("viewCount", { count: viewCount })}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" /> {t("viewers")}
            </DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {(viewers ?? []).map((entry) => (
                <li
                  key={entry.viewer.id}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted"
                >
                  <UserAvatar profile={entry.viewer} className="h-8 w-8" />
                  <div className="min-w-0 flex-1 leading-tight">
                    {entry.viewer.username ? (
                      <Link
                        href={`/u/${entry.viewer.username}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {displayName(entry.viewer)}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium">
                        {displayName(entry.viewer)}
                      </span>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {timeAgo(entry.viewed_at)}
                    </p>
                  </div>
                </li>
              ))}
              {viewers?.length === 0 ? (
                <li className="py-4 text-center text-sm text-muted-foreground">
                  {t("noViewersYet")}
                </li>
              ) : null}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
