"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star, Trash2 } from "lucide-react";

import { Stars } from "@/components/reviews/stars";
import { UserAvatar } from "@/components/social/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { deleteReview, upsertReview } from "@/lib/actions/reviews";
import { displayName, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Review, ReviewStats, ReviewSubject } from "@/types/database";
import type { AuthorSummary } from "@/types/social";

interface ReviewRow extends Review {
  author: AuthorSummary;
}

export function ReviewSection({
  subjectType,
  subjectId,
  stats,
  reviews,
  myReview,
  canReview,
}: {
  subjectType: ReviewSubject;
  subjectId: string;
  stats: ReviewStats;
  reviews: ReviewRow[];
  myReview: Review | null;
  /** False for the owner (can't review own item) or signed-out visitors. */
  canReview: boolean;
}) {
  const router = useRouter();
  const [rating, setRating] = React.useState(myReview?.rating ?? 0);
  const [hover, setHover] = React.useState(0);
  const [comment, setComment] = React.useState(myReview?.comment ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    if (busy || rating < 1) {
      setError("ကြယ် ၁–၅ ပေးပါ။");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await upsertReview({
      subject_type: subjectType,
      subject_id: subjectId,
      rating,
      comment: comment.trim() || null,
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else setError(res.error);
  }

  async function remove() {
    if (!myReview) return;
    setBusy(true);
    await deleteReview(myReview.id);
    setBusy(false);
    setRating(0);
    setComment("");
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="text-center">
          <p className="text-3xl font-bold leading-none">
            {stats.rating_avg.toFixed(1)}
          </p>
          <Stars value={stats.rating_avg} className="mt-1" />
          <p className="mt-0.5 text-xs text-muted-foreground">
            {stats.rating_count.toLocaleString("en-US")} အမှတ်ပေးမှု
          </p>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">⭐ အမှတ်ပေး / မှတ်ချက်</h3>
          <p className="text-xs text-muted-foreground">
            အသုံးပြုသူများ၏ တကယ့်အတွေ့အကြုံများ
          </p>
        </div>
      </div>

      {canReview ? (
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">
            {myReview ? "သင့် အမှတ်ပေးမှုကို ပြင်ရန်" : "အမှတ်ပေးရန်"}
          </p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setRating(i)}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(0)}
                aria-label={`${i} ကြယ်`}
              >
                <Star
                  className={cn(
                    "h-7 w-7 transition-colors",
                    (hover || rating) >= i
                      ? "fill-amber-400 text-amber-400"
                      : "fill-transparent text-muted-foreground/40",
                  )}
                />
              </button>
            ))}
          </div>
          <Textarea
            value={comment}
            maxLength={1000}
            placeholder="မှတ်ချက် (ရွေးချယ်နိုင်)…"
            onChange={(e) => setComment(e.target.value)}
            rows={2}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex gap-2">
            <Button onClick={submit} disabled={busy} size="sm">
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {myReview ? "ပြင်ဆင်ရန်" : "တင်ရန်"}
            </Button>
            {myReview ? (
              <Button onClick={remove} disabled={busy} size="sm" variant="ghost" className="text-destructive">
                <Trash2 className="mr-1 h-4 w-4" /> ဖျက်ရန်
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {reviews.length ? (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="border-t pt-3 first:border-0 first:pt-0">
              <div className="flex items-start gap-2">
                <UserAvatar profile={r.author} className="h-8 w-8" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{displayName(r.author)}</span>
                    <Stars value={r.rating} size={13} />
                    <span className="text-xs text-muted-foreground">{timeAgo(r.created_at)}</span>
                  </div>
                  {r.comment ? (
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{r.comment}</p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-2 text-center text-sm text-muted-foreground">
          အမှတ်ပေးမှု မရှိသေးပါ — ပထမဆုံး ဖြစ်လိုက်ပါ။
        </p>
      )}
    </div>
  );
}
