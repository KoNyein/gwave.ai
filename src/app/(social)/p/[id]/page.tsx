import { notFound, redirect } from "next/navigation";

import { SinglePost } from "@/components/social/single-post";
import { getCurrentProfile } from "@/lib/auth";
import { getPost } from "@/lib/db/posts";

export default async function PostPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.username) redirect("/onboarding");

  const post = await getPost(params.id, profile.id);
  if (!post) notFound();

  return (
    <SinglePost
      post={post}
      currentUser={{
        id: profile.id,
        username: profile.username,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
      }}
    />
  );
}
