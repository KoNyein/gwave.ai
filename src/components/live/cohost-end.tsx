"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, PhoneOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { endCohostRoom } from "@/lib/actions/cohost";

/** Host control to end a co-host room (removes it from the live directory). */
export function CohostEnd({ code }: { code: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function end() {
    if (!window.confirm("Co-host Live ကို ပိတ်မှာ သေချာလား?")) return;
    setPending(true);
    await endCohostRoom(code);
    setPending(false);
    router.push("/live/cohost");
  }

  return (
    <Button size="sm" variant="destructive" onClick={end} disabled={pending}>
      {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <PhoneOff className="mr-1 h-4 w-4" />}
      Live ပိတ်မည်
    </Button>
  );
}
