"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/** Simple room code — readable, unguessable enough for a class link. */
function newRoomCode() {
  const a = "bcdfghjklmnpqrstvwxyz";
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  return (
    Array.from({ length: 3 }, () => pick(a)).join("") +
    "-" +
    Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join("")
  );
}

export function MeetLobby() {
  const router = useRouter();
  const [code, setCode] = React.useState("");

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center gap-2">
        <Video className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Live Class Room 🎓</h1>
          <p className="text-sm text-muted-foreground">
            Zoom/Meet ပုံစံ — ဆရာနှင့် ကျောင်းသားများ တိုက်ရိုက် video ဖြင့် သင်ကြားပါ။
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="font-semibold">အခန်းသစ် ဖွင့်ရန်</p>
          <p className="text-sm text-muted-foreground">
            အခန်းတစ်ခု ဖွင့်ပြီး link ကို ကျောင်းသားများထံ မျှဝေပါ။ ဝင်လာသူတိုင်း
            video grid ထဲ ပေါ်လာမည်။ screen share လည်း လုပ်နိုင်သည်။
          </p>
          <Button
            className="w-full"
            onClick={() => router.push(`/meet/${newRoomCode()}`)}
          >
            <Video className="mr-1 h-4 w-4" /> အခန်းသစ် ဖွင့်မည်
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="font-semibold">အခန်းသို့ ဝင်ရန်</p>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.trim())}
              placeholder="Room code (ဥပမာ abc-1234)"
            />
            <Button
              disabled={!code}
              onClick={() => router.push(`/meet/${encodeURIComponent(code)}`)}
            >
              ဝင်မည်
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        💡 ကင်မရာ/မိုက် ခွင့်ပြုချက် လိုအပ်သည်။ အသုံးပြုသူ ~၆ ဦးအထိ အဆင်ပြေသည်
        (mesh)။ ပိုများပါက streaming (Live) function ကို သုံးပါ။
      </p>
    </div>
  );
}
