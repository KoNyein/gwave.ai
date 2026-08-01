"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/// Admin ရဲ့ "ဖျက်မယ်" ခလုတ် (Phase 18.1)。
///
/// ★ တစ်ချက်နှိပ်ရုံနဲ့ မဖျက်ဘူး — အတည်ပြုချက် တောင်းတယ်။ ဖျက်တာက
///   ပြန်ပြင်လို့မရဘူး (build_data က null ဖြစ်သွားမယ်)。
export function BuildReportActions({ plotId }: { plotId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/metaverse/plot/${plotId}/report`, {
        method: "DELETE",
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  if (!confirming) {
    return (
      <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
        ဖျက်မယ်
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      <Button variant="destructive" size="sm" disabled={busy} onClick={() => void remove()}>
        {busy ? "ဖျက်နေသည်…" : "အတည်ပြုမယ်"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        မလုပ်တော့
      </Button>
    </div>
  );
}
