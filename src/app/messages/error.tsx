"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * A client-side crash in the messenger used to leave a blank page — the user
 * simply "couldn't get into /messages", with nothing to report and nothing in
 * the server logs. Show them what happened, let them retry, and print the real
 * message so a bug report carries something useful.
 */
export default function MessagesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Messenger crashed:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div>
        <p className="text-lg font-semibold">Messenger ကို ဖွင့်၍ မရပါ</p>
        <p className="mt-1 text-sm text-muted-foreground">
          တစ်ခုခု မှားယွင်းသွားပါတယ်။ ထပ်ကြိုးစားကြည့်ပါ။
        </p>
      </div>

      <Button onClick={reset}>
        <RefreshCw className="mr-2 h-4 w-4" />
        ထပ်ကြိုးစားမည်
      </Button>

      <p className="max-w-md break-words rounded-lg bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
        {error.message}
        {error.digest ? ` (${error.digest})` : ""}
      </p>
    </div>
  );
}
