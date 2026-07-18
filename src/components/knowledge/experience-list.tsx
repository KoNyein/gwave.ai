"use client";

import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { useLocale } from "next-intl";

import { UserAvatar } from "@/components/social/user-avatar";
import type { ExperiencePost } from "@/lib/db/experiences";
import { displayName, timeAgo } from "@/lib/format";
import { mediaUrl } from "@/lib/media-url";
import { prefersMyanmarScript } from "@/i18n/config";

/**
 * Community experiences for a knowledge item, rendered comment-style under
 * the share box: avatar, name, time, text (without the canonical back-link
 * line the share box appends) and photo thumbnails, each linking to the full
 * post.
 */
export function ExperienceList({ posts }: { posts: ExperiencePost[] }) {
  const mm = prefersMyanmarScript(useLocale());
  if (posts.length === 0) return null;

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <p className="flex items-center gap-1.5 font-semibold">
        <MessagesSquare className="h-4 w-4 text-primary" />
        {mm
          ? `အတွေ့အကြုံများ (${posts.length})`
          : `Experiences (${posts.length})`}
      </p>
      <ul className="space-y-3">
        {posts.map((post) => {
          // Drop the "📌 <name> — https://gwave.cc/..." marker line — it's
          // the join key, not part of what the person wrote.
          const text = post.content
            .split("\n")
            .filter((line) => !line.includes("gwave.cc/"))
            .join("\n")
            .trim();
          const images = post.media.filter((m) => m.media_type === "image");
          return (
            <li key={post.id} className="flex gap-2.5">
              {post.author ? (
                <UserAvatar profile={post.author} className="h-8 w-8" />
              ) : null}
              <div className="min-w-0 flex-1 rounded-xl bg-muted/50 px-3 py-2">
                <p className="text-sm font-semibold">
                  {post.author ? displayName(post.author) : "—"}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {timeAgo(post.created_at)}
                  </span>
                </p>
                {text ? (
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {text}
                  </p>
                ) : null}
                {images.length > 0 ? (
                  <div className="mt-1.5 flex gap-1.5 overflow-x-auto">
                    {images.slice(0, 4).map((item) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={item.id}
                        src={mediaUrl(item.storage_path)}
                        alt=""
                        loading="lazy"
                        className="h-20 w-20 shrink-0 rounded-lg border object-cover"
                      />
                    ))}
                  </div>
                ) : null}
                <Link
                  href={`/p/${post.id}`}
                  className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
                >
                  {mm ? "Post အပြည့်ကြည့်ရန် →" : "View post →"}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
