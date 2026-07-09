"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Ban,
  Flag,
  Globe,
  Lock,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { CommentSection } from "@/components/social/comment-section";
import { LocationMap } from "@/components/social/location-map";
import { MediaGrid } from "@/components/social/media-grid";
import { MemberBadge } from "@/components/social/member-badge";
import {
  PostViewsButton,
  PostViewTracker,
} from "@/components/social/post-views";
import { ReactionButton } from "@/components/social/reaction-button";
import { REACTIONS } from "@/components/social/reactions";
import { ReportDialog } from "@/components/social/report-dialog";
import { ShareDialog } from "@/components/social/share-dialog";
import { UserAvatar } from "@/components/social/user-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { blockUser } from "@/lib/actions/moderation";
import { deletePost, setReaction } from "@/lib/actions/posts";
import { displayName, timeAgo } from "@/lib/format";
import type { PostVisibility, ReactionType } from "@/types/database";
import type { AuthorSummary, FeedPost } from "@/types/social";

const VISIBILITY_ICONS: Record<PostVisibility, typeof Globe> = {
  public: Globe,
  friends: Users,
  only_me: Lock,
  members: BadgeCheck,
};

export function PostCard({
  post,
  currentUser,
  onDeleted,
  onShared,
}: {
  post: FeedPost;
  currentUser: AuthorSummary;
  onDeleted: (postId: string) => void;
  onShared: () => void;
}) {
  const t = useTranslations("post");
  const router = useRouter();
  const [, startBlock] = React.useTransition();
  const [myReaction, setMyReaction] = React.useState<ReactionType | null>(
    post.my_reaction[0]?.type ?? null,
  );
  const [reactionCount, setReactionCount] = React.useState(
    post.reaction_count,
  );
  const [commentCount, setCommentCount] = React.useState(post.comment_count);
  const [commentsOpen, setCommentsOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [mapOpen, setMapOpen] = React.useState(false);

  const VisibilityIcon = VISIBILITY_ICONS[post.visibility];
  const isOwn = post.author_id === currentUser.id;

  async function handleReactionChange(next: ReactionType | null) {
    const previous = myReaction;
    setMyReaction(next);
    setReactionCount((count) =>
      Math.max(
        0,
        count + (next === null ? -1 : previous === null ? 1 : 0),
      ),
    );
    const result = await setReaction({ postId: post.id }, next);
    if (!result.ok) {
      setMyReaction(previous);
      setReactionCount((count) =>
        Math.max(
          0,
          count + (next === null ? 1 : previous === null ? -1 : 0),
        ),
      );
    }
  }

  async function handleDelete() {
    onDeleted(post.id);
    await deletePost(post.id);
  }

  return (
    <Card className="relative overflow-hidden">
      {/* Views are only recorded on other people's posts. */}
      {!isOwn ? <PostViewTracker postId={post.id} /> : null}
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-3">
        <div className="flex items-center gap-3">
          <UserAvatar profile={post.author} />
          <div className="leading-tight">
            {post.author.username ? (
              <Link
                href={`/u/${post.author.username}`}
                className="text-sm font-semibold hover:underline"
              >
                {displayName(post.author)}
              </Link>
            ) : (
              <span className="text-sm font-semibold">
                {displayName(post.author)}
              </span>
            )}{" "}
            <MemberBadge role={post.author.role} />
            {post.shared_post ? (
              <span className="text-sm text-muted-foreground">
                {" "}
                {t("sharedAPost")}
              </span>
            ) : null}
            {post.group ? (
              <span className="text-sm text-muted-foreground">
                {" ▸ "}
                <Link
                  href={`/groups/${post.group.slug}`}
                  className="font-semibold text-foreground hover:underline"
                >
                  {post.group.name}
                </Link>
              </span>
            ) : null}
            {post.page ? (
              <span className="text-sm text-muted-foreground">
                {" ▸ "}
                <Link
                  href={`/pages/${post.page.slug}`}
                  className="font-semibold text-foreground hover:underline"
                >
                  {post.page.name}
                </Link>
              </span>
            ) : null}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{timeAgo(post.created_at)}</span>
              <span>·</span>
              <VisibilityIcon className="h-3 w-3" />
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              aria-label={t("postMenu")}
            >
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isOwn ? (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={handleDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("delete")}
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem onSelect={() => setReportOpen(true)}>
                  <Flag className="mr-2 h-4 w-4" />
                  {t("report")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => {
                    startBlock(async () => {
                      await blockUser(post.author.id);
                      router.refresh();
                    });
                  }}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  {t("block")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Location check-in */}
      {post.latitude != null && post.longitude != null ? (
        <button
          type="button"
          onClick={() => setMapOpen((open) => !open)}
          className="flex items-center gap-1 px-4 pt-2 text-xs text-muted-foreground hover:underline"
        >
          <MapPin className="h-3.5 w-3.5 text-destructive" />
          {post.location_name || t("atALocation")}
        </button>
      ) : null}

      {/* Content */}
      {post.content ? (
        <p className="whitespace-pre-wrap break-words px-4 py-2 text-sm">
          {post.content}
        </p>
      ) : (
        <div className="pt-2" />
      )}

      {mapOpen && post.latitude != null && post.longitude != null ? (
        <div className="mx-4 mb-2">
          <LocationMap latitude={post.latitude} longitude={post.longitude} />
        </div>
      ) : null}

      {/* Media / shared post */}
      {post.shared_post ? (
        <div className="mx-4 mb-2 overflow-hidden rounded-lg border">
          <MediaGrid media={post.shared_post.media} />
          <div className="p-3">
            <div className="flex items-center gap-2">
              <UserAvatar
                profile={post.shared_post.author}
                className="h-8 w-8"
              />
              <div className="leading-tight">
                {post.shared_post.author.username ? (
                  <Link
                    href={`/u/${post.shared_post.author.username}`}
                    className="text-sm font-semibold hover:underline"
                  >
                    {displayName(post.shared_post.author)}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold">
                    {displayName(post.shared_post.author)}
                  </span>
                )}
                <p className="text-xs text-muted-foreground">
                  {timeAgo(post.shared_post.created_at)}
                </p>
              </div>
            </div>
            {post.shared_post.content ? (
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                {post.shared_post.content}
              </p>
            ) : null}
          </div>
        </div>
      ) : post.shared_post_id ? (
        <div className="mx-4 mb-2 rounded-lg border p-4 text-sm text-muted-foreground">
          {t("originalUnavailable")}
        </div>
      ) : (
        <MediaGrid media={post.media} />
      )}

      {/* Counts */}
      {reactionCount > 0 ||
      commentCount > 0 ||
      post.share_count > 0 ||
      (isOwn && post.view_count > 0) ? (
        <div className="flex items-center justify-between px-4 py-2 text-sm text-muted-foreground">
          <span>
            {reactionCount > 0 ? (
              <>
                <span className="mr-1">
                  {myReaction ? REACTIONS[myReaction].emoji : "👍"}
                </span>
                {reactionCount}
              </>
            ) : null}
          </span>
          <span className="flex items-center gap-3">
            {/* Only the author sees how many people viewed the post. */}
            {isOwn ? (
              <PostViewsButton postId={post.id} viewCount={post.view_count} />
            ) : null}
            {commentCount > 0 ? (
              <button
                type="button"
                className="hover:underline"
                onClick={() => setCommentsOpen(true)}
              >
                {t("commentCount", { count: commentCount })}
              </button>
            ) : null}
            {post.share_count > 0 ? (
              <span>{t("shareCount", { count: post.share_count })}</span>
            ) : null}
          </span>
        </div>
      ) : null}

      {/* Action bar */}
      <div className="mx-4 flex border-t py-1">
        <ReactionButton current={myReaction} onChange={handleReactionChange} />
        <button
          type="button"
          onClick={() => setCommentsOpen((open) => !open)}
          className="flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          <MessageCircle className="h-4 w-4" />
          {t("comment")}
        </button>
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          <Share2 className="h-4 w-4" />
          {t("share")}
        </button>
      </div>

      {commentsOpen ? (
        <CommentSection
          postId={post.id}
          currentUser={currentUser}
          onCountChange={(delta) =>
            setCommentCount((count) => Math.max(0, count + delta))
          }
        />
      ) : null}

      <ShareDialog
        post={post}
        currentUser={currentUser}
        open={shareOpen}
        onOpenChange={setShareOpen}
        onShared={onShared}
      />
      <ReportDialog
        target={{ postId: post.id }}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />
    </Card>
  );
}
