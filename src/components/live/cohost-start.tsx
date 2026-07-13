"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createCohostRoom } from "@/lib/actions/cohost";

/** Opens a new multi-guest co-host Live room and jumps into the grid. */
export function CohostStart() {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function start() {
    if (!title.trim()) {
      setError("ခေါင်းစဉ် ထည့်ပါ။");
      return;
    }
    setPending(true);
    setError(null);
    const res = await createCohostRoom(title.trim());
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(`/live/cohost/${res.data.code}`);
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="space-y-3 p-4">
        <p className="flex items-center gap-1.5 font-semibold">
          <Users className="h-4 w-4 text-primary" /> Co-host Live ဖွင့်ရန်
        </p>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="ခေါင်းစဉ် — ဥပမာ: စိုက်ပျိုးရေး ဆွေးနွေးပွဲ"
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button onClick={start} disabled={pending} className="w-full">
          {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Video className="mr-1.5 h-4 w-4" />}
          Live စတင်မည်
        </Button>
        <p className="text-[11px] text-muted-foreground">
          💡 co-host ~၆ ဦးအထိ တစ်ပြိုင်နက် video grid (mesh)။ ကင်မရာ/မိုက် ခွင့်ပြုချက် လိုအပ်သည်။
        </p>
      </CardContent>
    </Card>
  );
}
