"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, SendHorizonal, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { UserAvatar } from "@/components/social/user-avatar";
import { addComment, deleteComment, setReaction } from "@/lib/actions/posts";
import { displayName, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AuthorSummary, CommentWithAuthor } from "@/types/social";

interface CommentSectionProps {
  postId: string;
  currentUser: AuthorSummary;
  onCountChange: (delta: number) => void;
}

export function CommentSection({
  postId,
  currentUser,
  onCountChange,
}: CommentSectionProps) {
  const t = useTranslations("comments");
  const [comments, setComments] = React.useState<CommentWithAuthor[] | null>(
    null,
  );
  const [replyTo, setReplyTo] = React.useState<CommentWithAuthor | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/comments?post=${postId}`)
      .then((response) => response.json())
      .then((payload: { comments?: CommentWithAuthor[] }) => {
        if (!cancelled) setComments(payload.comments ?? []);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  async function submitComment(content: string) {
    const trimmed = content.trim();
    if (!trimmed) return;

    const parentId = replyTo ? (replyTo.parent_id ?? replyTo.id) : null;
    const optimistic: CommentWithAuthor = {
      id: `optimistic-${Date.now()}`,
      post_id: postId,
      author_id: currentUser.id,
      parent_id: parentId,
      content: trimmed,
      reaction_count: 0,
      reply_count: 0,
      removed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      author: currentUser,
      my_reaction: [],
    };
    setComments((previous) => [...(previous ?? []), optimistic]);
    setReplyTo(null);
    onCountChange(1);

    const result = await addComment({ postId, content: trimmed, parentId });
    setComments((previous) => {
      if (!previous) return previous;
      if (!result.ok) {
        onCountChange(-1);
        return previous.filter((c) => c.id !== optimistic.id);
      }
      return previous.map((c) =>
        c.id === optimistic.id ? { ...c, id: result.data.commentId } : c,
      );
    });
  }

  async function handleDelete(comment: CommentWithAuthor) {
    const removed = 1 + (comment.parent_id === null ? comment.reply_count : 0);
    setComments((previous) =>
      (previous ?? []).filter(
        (c) => c.id !== comment.id && c.parent_id !== comment.id,
      ),
    );
    onCountChange(-removed);
    await deleteComment(comment.id);
  }

  async function toggleLike(comment: CommentWithAuthor) {
    const liked = comment.my_reaction.length > 0;
    setComments((previous) =>
      (previous ?? []).map((c) =>
        c.id === comment.id
          ? {
              ...c,
              my_reaction: liked ? [] : [{ type: "like" as const }],
              reaction_count: Math.max(0, c.reaction_count + (liked ? -1 : 1)),
            }
          : c,
      ),
    );
    await setReaction({ commentId: comment.id }, liked ? null : "like");
  }

  if (comments === null) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const topLevel = comments.filter((c) => c.parent_id === null);
  const repliesByParent = new Map<string, CommentWithAuthor[]>();
  for (const comment of comments) {
    if (comment.parent_id) {
      const list = repliesByParent.get(comment.parent_id) ?? [];
      list.push(comment);
      repliesByParent.set(comment.parent_id, list);
    }
  }

  return (
    <div className="space-y-3 border-t px-4 py-3">
      {topLevel.map((comment) => (
        <div key={comment.id} className="space-y-2">
          <CommentItem
            comment={comment}
            currentUserId={currentUser.id}
            onReply={() => {
              setReplyTo(comment);
              inputRef.current?.focus();
            }}
            onDelete={() => handleDelete(comment)}
            onToggleLike={() => toggleLike(comment)}
            t={t}
          />
          {(repliesByParent.get(comment.id) ?? []).map((reply) => (
            <div key={reply.id} className="ml-10">
              <CommentItem
                comment={reply}
                currentUserId={currentUser.id}
                onReply={() => {
                  setReplyTo(reply);
                  inputRef.current?.focus();
                }}
                onDelete={() => handleDelete(reply)}
                onToggleLike={() => toggleLike(reply)}
                t={t}
              />
            </div>
          ))}
        </div>
      ))}

      {replyTo ? (
        <p className="text-xs text-muted-foreground">
          {t("replyingTo", { name: displayName(replyTo.author) })}{" "}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => setReplyTo(null)}
          >
            {t("cancel")}
          </button>
        </p>
      ) : null}

      <CommentInput
        currentUser={currentUser}
        placeholder={t("placeholder")}
        onSubmit={submitComment}
        inputRef={inputRef}
      />
    </div>
  );
}

function CommentItem({
  comment,
  currentUserId,
  onReply,
  onDelete,
  onToggleLike,
  t,
}: {
  comment: CommentWithAuthor;
  currentUserId: string;
  onReply: () => void;
  onDelete: () => void;
  onToggleLike: () => void;
  t: ReturnType<typeof useTranslations<"comments">>;
}) {
  const liked = comment.my_reaction.length > 0;

  return (
    <div className="flex gap-2">
      <UserAvatar profile={comment.author} className="h-8 w-8" />
      <div className="min-w-0 flex-1">
        <div className="inline-block max-w-full rounded-2xl bg-muted px-3 py-2">
          {comment.author.username ? (
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
            {comment.content}
          </p>
        </div>
        <div className="mt-0.5 flex items-center gap-3 px-3 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={onToggleLike}
            className={cn(
              "font-medium hover:underline",
              liked && "text-primary",
            )}
          >
            {t("like")}
          </button>
          <button
            type="button"
            onClick={onReply}
            className="font-medium hover:underline"
          >
            {t("reply")}
          </button>
          <span>{timeAgo(comment.created_at)}</span>
          {comment.reaction_count > 0 ? (
            <span>👍 {comment.reaction_count}</span>
          ) : null}
          {comment.author_id === currentUserId ? (
            <button
              type="button"
              onClick={onDelete}
              aria-label={t("delete")}
              className="hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CommentInput({
  currentUser,
  placeholder,
  onSubmit,
  inputRef,
}: {
  currentUser: AuthorSummary;
  placeholder: string;
  onSubmit: (content: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  const [value, setValue] = React.useState("");

  function submit() {
    if (!value.trim()) return;
    onSubmit(value);
    setValue("");
  }

  return (
    <div className="flex items-center gap-2">
      <UserAvatar profile={currentUser} className="h-8 w-8" linked={false} />
      <div className="relative flex-1">
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          maxLength={4000}
          className="w-full rounded-full bg-muted px-4 py-2 pr-10 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim()}
          aria-label="Send"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-primary disabled:opacity-40"
        >
          <SendHorizonal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
