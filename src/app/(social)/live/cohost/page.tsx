import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Radio, Users } from "lucide-react";

import { CohostStart } from "@/components/live/cohost-start";
import { UserAvatar } from "@/components/social/user-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { getActiveCohostRooms } from "@/lib/db/cohost";
import { displayName, timeAgo } from "@/lib/format";

export const metadata = { title: "Co-host Live" };
export const dynamic = "force-dynamic";

export default async function CohostLobbyPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const rooms = await getActiveCohostRooms();

  return (
    <div className="space-y-4">
      <Link
        href="/live"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Live ဆီ ပြန်သွားရန်
      </Link>

      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Co-host Live 👥</h1>
          <p className="text-sm text-muted-foreground">
            လူများစွာ တစ်ပြိုင်နက် video grid ဖြင့် အတူ Live လွှင့်ပါ။
          </p>
        </div>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="space-y-2 p-4">
          <p className="text-sm font-semibold">ဘယ်လို အလုပ်လုပ်လဲ — ၃ ဆင့်</p>
          <ol className="space-y-1.5 text-sm text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">၁.</span> ခေါင်းစဉ်
              ထည့်ပြီး <span className="font-medium">“Live စတင်မည်”</span> နှိပ်ပါ။
              အခန်း ပွင့်သွားပါမယ်။
            </li>
            <li>
              <span className="font-semibold text-foreground">၂.</span> အခန်းထဲမှာ{" "}
              <span className="font-medium">“Link မျှဝေရန်”</span> နဲ့ လူခေါ်ပါ။
              ပြီးရင် <span className="font-medium">“Co-host ထည့်ရန်”</span> ကနေ
              နာမည်ရှာပြီး ဖိတ်ခေါ်လိုက်ပါ — သူတို့ ကင်မရာ ပွင့်လာပါမယ်။
            </li>
            <li>
              <span className="font-semibold text-foreground">၃.</span> ကြည့်နေသူက
              ကိုယ်တိုင် <span className="font-medium">“Co-host ဝင်ရန် တောင်းမည်”</span>{" "}
              (လက်ထောင်) လည်း နှိပ်လို့ရတယ် — သင်က ✓ ခွင့်ပြုပေးရုံပါပဲ။
            </li>
          </ol>
          <p className="text-xs text-muted-foreground">
            ကြည့်ရှုသူ အရေအတွက် ကန့်သတ်ချက် မရှိပါ။ ကင်မရာ ဖွင့်ခွင့်က host
            ခွင့်ပြုထားသူတွေ ပဲ ရပါတယ်။
          </p>
        </CardContent>
      </Card>

      <CohostStart />

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <Radio className="h-4 w-4 text-destructive" /> အခု Live ဖြစ်နေသော အခန်းများ
        </p>
        {rooms.length === 0 ? (
          <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
            အခု Live ဖြစ်နေတဲ့ co-host အခန်း မရှိသေးပါ။ ပထမဆုံး ဖွင့်လိုက်ပါ!
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {rooms.map((room) => (
              <Link key={room.id} href={`/live/cohost/${room.code}`} className="block">
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="flex items-center gap-3 p-4">
                    <UserAvatar profile={room.host} className="h-11 w-11" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{room.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {displayName(room.host)} · {timeAgo(room.created_at)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase text-destructive-foreground">
                      Live
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
