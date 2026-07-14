"use client";

import * as React from "react";
import Link from "next/link";
import { MessageSquare, SendHorizonal, Trash2 } from "lucide-react";

import { UserAvatar } from "@/components/social/user-avatar";
import { Card, CardContent } from "@/components/ui/card";
import {
  addLessonComment,
  deleteLessonComment,
} from "@/lib/actions/lesson-comments";
import type { LessonComment } from "@/lib/db/lesson-comments";
import { displayName, timeAgo } from "@/lib/format";
import type { AuthorSummary } from "@/types/social";

/**
 * Discussion thread below a lesson. Signed-in learners can post questions and
 * help each other — makes learning interactive and keeps students engaged.
 */
export function LessonComments({
  trackSlug,
  lessonSlug,
  currentUser,
  initialComments,
}: {
  trackSlug: string;
  lessonSlug: string;
  currentUser: AuthorSummary;
  initialComments: LessonComment[];
}) {
  const [comments, setComments] =
    React.useState<LessonComment[]>(initialComments);
  const [value, setValue] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function submit() {
    const body = value.trim();
    if (!body || pending) return;
    setPending(true);

    const optimistic: LessonComment = {
      id: `optimistic-${Date.now()}`,
      track_slug: trackSlug,
      lesson_slug: lessonSlug,
      author_id: currentUser.id,
      body,
      created_at: new Date().toISOString(),
      author: currentUser,
    };
    setComments((prev) => [optimistic, ...prev]);
    setValue("");

    const result = await addLessonComment({ trackSlug, lessonSlug, body });
    setComments((prev) => {
      if (!result.ok) return prev.filter((c) => c.id !== optimistic.id);
      return prev.map((c) =>
        c.id === optimistic.id ? { ...c, id: result.data.commentId } : c,
      );
    });
    setPending(false);
  }

  async function remove(comment: LessonComment) {
    setComments((prev) => prev.filter((c) => c.id !== comment.id));
    await deleteLessonComment(comment.id);
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <MessageSquare className="h-4 w-4 text-primary" />
          ဆွေးနွေးချက်များ
          {comments.length > 0 ? (
            <span className="text-sm font-normal text-muted-foreground">
              ({comments.length})
            </span>
          ) : null}
        </h2>

        {/* Composer */}
        <div className="flex items-start gap-2">
          <UserAvatar
            profile={currentUser}
            className="h-8 w-8"
            linked={false}
          />
          <div className="relative flex-1">
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder="မေးခွန်း မေးရန် / မှတ်ချက် ရေးရန်…"
              rows={2}
              maxLength={2000}
              className="w-full resize-none rounded-2xl bg-muted px-4 py-2 pr-10 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!value.trim() || pending}
              aria-label="ပို့ရန်"
              className="absolute right-2 top-2 text-primary disabled:opacity-40"
            >
              <SendHorizonal className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Thread */}
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            ပထမဆုံး မှတ်ချက်ရေးသူ ဖြစ်လိုက်ပါ။
          </p>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-2">
                <UserAvatar profile={comment.author} className="h-8 w-8" />
                <div className="min-w-0 flex-1">
                  <div className="inline-block max-w-full rounded-2xl bg-muted px-3 py-2">
                    {comment.author?.username ? (
                      <Link
                        href={`/u/${comment.author.username}`}
                        className="text-xs font-semibold hover:underline"
                      >
                        {displayName(comment.author)}
                      </Link>
                    ) : (
                      <span className="text-xs font-semibold">
                        {displayName(comment.author)}
                      </span>
                    )}
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {comment.body}
                    </p>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 px-3 text-xs text-muted-foreground">
                    <span>{timeAgo(comment.created_at)}</span>
                    {comment.author_id === currentUser.id ? (
                      <button
                        type="button"
                        onClick={() => void remove(comment)}
                        aria-label="ဖျက်ရန်"
                        className="hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
