import { redirect } from "next/navigation";

import { PostFeed } from "@/components/social/post-feed";
import { getCurrentProfile } from "@/lib/auth";
import { getFeed } from "@/lib/db/posts";

export default async function FeedPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  if (!profile.username) {
    redirect("/onboarding");
  }

  const initialPage = await getFeed(profile.id);

  return (
    <PostFeed
      initialPage={initialPage}
      currentUser={{
        id: profile.id,
        username: profile.username,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
      }}
      scope="feed"
      showComposer
    />
  );
}
