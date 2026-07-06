"use client";

import { useRouter } from "next/navigation";

import { PostCard } from "@/components/social/post-card";
import type { AuthorSummary, FeedPost } from "@/types/social";

export function SinglePost({
  post,
  currentUser,
}: {
  post: FeedPost;
  currentUser: AuthorSummary;
}) {
  const router = useRouter();

  return (
    <PostCard
      post={post}
      currentUser={currentUser}
      onDeleted={() => router.push("/feed")}
      onShared={() => router.refresh()}
    />
  );
}
