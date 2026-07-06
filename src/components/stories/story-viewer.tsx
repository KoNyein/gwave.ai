"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { UserAvatar } from "@/components/social/user-avatar";
import { deleteStory, markStoryViewed } from "@/lib/actions/stories";
import { displayName, timeAgo } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { StoryGroup } from "@/types/social";

const STORY_DURATION_MS = 5000;

/**
 * Full-screen story viewer with progress bars, tap/arrow navigation and
 * auto-advance across authors.
 */
export function StoryViewer({
  groups,
  initialGroupIndex,
  currentUserId,
  onClose,
}: {
  groups: StoryGroup[];
  initialGroupIndex: number;
  currentUserId: string;
  onClose: () => void;
}) {
  const t = useTranslations("stories");
  const [groupIndex, setGroupIndex] = React.useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = React.useState(0);
  const [progressKey, setProgressKey] = React.useState(0);

  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];

  const goNext = React.useCallback(() => {
    const currentGroup = groups[groupIndex];
    if (!currentGroup) return;
    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex((i) => i + 1);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((i) => i + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
    setProgressKey((k) => k + 1);
  }, [groups, groupIndex, storyIndex, onClose]);

  const goPrev = React.useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
    } else if (groupIndex > 0) {
      const previousGroup = groups[groupIndex - 1];
      setGroupIndex((i) => i - 1);
      setStoryIndex(Math.max(0, (previousGroup?.stories.length ?? 1) - 1));
    }
    setProgressKey((k) => k + 1);
  }, [groups, groupIndex, storyIndex]);

  // Auto-advance + view tracking.
  React.useEffect(() => {
    if (!story) return;
    if (story.author_id !== currentUserId) {
      void markStoryViewed(story.id);
    }
    const timer = setTimeout(goNext, STORY_DURATION_MS);
    return () => clearTimeout(timer);
  }, [story, currentUserId, goNext]);

  // Keyboard navigation.
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") goNext();
      if (event.key === "ArrowLeft") goPrev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goNext, goPrev]);

  if (!group || !story) return null;

  async function handleDelete() {
    if (!story) return;
    onClose();
    await deleteStory(story.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95">
      <button
        type="button"
        onClick={onClose}
        aria-label={t("close")}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      {groupIndex > 0 || storyIndex > 0 ? (
        <button
          type="button"
          onClick={goPrev}
          aria-label={t("previous")}
          className="absolute left-2 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:left-6"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      ) : null}
      <button
        type="button"
        onClick={goNext}
        aria-label={t("next")}
        className="absolute right-2 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:right-6"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      <div className="relative aspect-[9/16] h-full max-h-[92vh] w-auto max-w-full overflow-hidden bg-black sm:rounded-xl">
        {/* Progress bars */}
        <div className="absolute inset-x-2 top-2 z-10 flex gap-1">
          {group.stories.map((s, index) => (
            <div
              key={s.id}
              className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30"
            >
              <div
                key={index === storyIndex ? progressKey : undefined}
                className={cn(
                  "h-full bg-white",
                  index < storyIndex && "w-full",
                  index > storyIndex && "w-0",
                  index === storyIndex && "animate-story-progress",
                )}
                style={
                  index === storyIndex
                    ? { animationDuration: `${STORY_DURATION_MS}ms` }
                    : undefined
                }
              />
            </div>
          ))}
        </div>

        {/* Author header */}
        <div className="absolute inset-x-2 top-5 z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserAvatar
              profile={group.author}
              linked={false}
              className="h-9 w-9 border-2 border-white"
            />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-white">
                {displayName(group.author)}
              </p>
              <p className="text-xs text-white/70">
                {timeAgo(story.created_at)}
              </p>
            </div>
          </div>
          {story.author_id === currentUserId ? (
            <button
              type="button"
              onClick={handleDelete}
              aria-label={t("delete")}
              className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {/* Media */}
        {story.media_type === "video" ? (
          <video
            src={mediaUrl(story.media_path)}
            autoPlay
            muted
            playsInline
            className="h-full w-full object-contain"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(story.media_path)}
            alt=""
            className="h-full w-full object-contain"
          />
        )}

        {story.text_overlay ? (
          <p className="absolute inset-x-4 bottom-10 text-center text-xl font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            {story.text_overlay}
          </p>
        ) : null}
      </div>
    </div>
  );
}
