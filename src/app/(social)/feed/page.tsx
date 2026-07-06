import { redirect } from "next/navigation";

import { PostFeed } from "@/components/social/post-feed";
import { StoryBar } from "@/components/stories/story-bar";
import { getCurrentProfile } from "@/lib/auth";
import { getFeed } from "@/lib/db/posts";
import { getStoryGroups } from "@/lib/db/stories";

export default async function FeedPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  if (!profile.username) {
    redirect("/onboarding");
  }

  const [initialPage, storyGroups] = await Promise.all([
    getFeed(profile.id),
    getStoryGroups(profile.id),
  ]);

  const currentUser = {
    id: profile.id,
    username: profile.username,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
  };

  return (
    <div className="space-y-4">
      <StoryBar groups={storyGroups} currentUser={currentUser} />
      <PostFeed
        initialPage={initialPage}
        currentUser={currentUser}
        scope="feed"
        showComposer
      />
    </div>
  );
}
