import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Keyboard } from "lucide-react";

import { TypingTutor } from "@/components/learn/typing-tutor";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/data/server";

export const metadata = { title: "Typing Tutor" };
export const dynamic = "force-dynamic";

export default async function TypingTutorPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const db = await createClient();
  const { data } = await db
    .from("typing_scores")
    .select("wpm")
    .eq("user_id", profile.id)
    .order("wpm", { ascending: false })
    .limit(1)
    .maybeSingle<{ wpm: number }>();
  const bestWpm = data ? Number(data.wpm) : 0;

  return (
    <div className="space-y-5">
      <Link
        href="/learn/languages"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Languages
      </Link>

      <div className="flex items-center gap-2">
        <Keyboard className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Typing Tutor ⌨️</h1>
          <p className="text-sm text-muted-foreground">
            ထိုင်နည်း၊ လက်ချောင်း ၉ ချောင်း သုံးနည်းမှစ၍ WPM၊ တိကျမှု၊ combo စိန်ခေါ်မှုအထိ။
          </p>
        </div>
      </div>

      <TypingTutor initialBestWpm={bestWpm} />
    </div>
  );
}
