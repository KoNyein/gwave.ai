"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { CreateStoryDialog } from "@/components/stories/create-story-dialog";
import { StoryViewer } from "@/components/stories/story-viewer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { displayName, initials } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { AuthorSummary, StoryGroup } from "@/types/social";

export function StoryBar({
  groups,
  currentUser,
}: {
  groups: StoryGroup[];
  currentUser: AuthorSummary;
}) {
  const t = useTranslations("stories");
  const [viewerIndex, setViewerIndex] = React.useState<number | null>(null);

  return (
    <Card>
      <CardContent className="flex gap-2 overflow-x-auto p-3">
        {/* Create story tile */}
        <CreateStoryDialog currentUser={currentUser}>
          <button
            type="button"
            className="relative h-44 w-28 shrink-0 overflow-hidden rounded-xl border bg-muted transition-transform hover:scale-[1.02]"
          >
            <div className="flex h-2/3 items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
              <Avatar className="h-12 w-12">
                {currentUser.avatar_url ? (
                  <AvatarImage src={currentUser.avatar_url} alt="" />
                ) : null}
                <AvatarFallback>{initials(currentUser)}</AvatarFallback>
              </Avatar>
            </div>
            <div className="relative flex h-1/3 flex-col items-center justify-end bg-background pb-2">
              <span className="absolute -top-4 rounded-full border-4 border-background bg-primary p-1 text-primary-foreground">
                <Plus className="h-4 w-4" />
              </span>
              <span className="px-1 text-xs font-medium">
                {t("createStory")}
              </span>
            </div>
          </button>
        </CreateStoryDialog>

        {/* Story tiles */}
        {groups.map((group, index) => {
          const cover = group.stories[group.stories.length - 1];
          return (
            <button
              key={group.author.id}
              type="button"
              onClick={() => setViewerIndex(index)}
              className="relative h-44 w-28 shrink-0 overflow-hidden rounded-xl bg-muted transition-transform hover:scale-[1.02]"
            >
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl(cover.media_path)}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />
              <Avatar
                className={cn(
                  "absolute left-2 top-2 h-9 w-9 border-[3px]",
                  group.allViewed ? "border-muted" : "border-primary",
                )}
              >
                {group.author.avatar_url ? (
                  <AvatarImage src={group.author.avatar_url} alt="" />
                ) : null}
                <AvatarFallback>{initials(group.author)}</AvatarFallback>
              </Avatar>
              <span className="absolute inset-x-1.5 bottom-1.5 truncate text-left text-xs font-semibold text-white">
                {group.author.id === currentUser.id
                  ? t("yourStory")
                  : displayName(group.author)}
              </span>
            </button>
          );
        })}
      </CardContent>

      {viewerIndex !== null ? (
        <StoryViewer
          groups={groups}
          initialGroupIndex={viewerIndex}
          currentUserId={currentUser.id}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </Card>
  );
}
