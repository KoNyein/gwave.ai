import Link from "next/link";
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
      {/* Gentle nudge instead of the old forced redirect: a username-less
          account can browse freely and finish onboarding when ready. */}
      {!profile.username ? (
        <Link
          href="/onboarding"
          className="flex items-center justify-between rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm transition-colors hover:bg-primary/10"
        >
          <span>
            👤 <b>Username သတ်မှတ်ရန် ကျန်နေပါသေးသည်</b> — profile ပြီးအောင်
            ဖြည့်ရန် နှိပ်ပါ
          </span>
          <span aria-hidden>→</span>
        </Link>
      ) : null}
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
