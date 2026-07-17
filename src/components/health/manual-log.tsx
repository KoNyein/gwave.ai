"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, PencilLine } from "lucide-react";

import { logManualMetric } from "@/lib/actions/health";

const METRICS = [
  { type: "steps", label: "ခြေလှမ်း", unit: "" },
  { type: "sleep", label: "အိပ်ချိန် (မိနစ်)", unit: "မိနစ်" },
  { type: "calories", label: "ကယ်လိုရီ", unit: "kcal" },
  { type: "heart_rate", label: "နှလုံးခုန် (bpm)", unit: "bpm" },
] as const;

/**
 * Account-free entry: type today's steps / sleep / calories / heart rate by
 * hand. Works on any phone with no device or sign-up — the fastest way to see
 * the dashboard fill in.
 */
export function ManualLog() {
  const router = useRouter();
  const [type, setType] = React.useState<string>("steps");
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return;
    setBusy(true);
    setMsg(null);
    const res = await logManualMetric({ metricType: type, value: num });
    setBusy(false);
    if (res.ok) {
      setValue("");
      setMsg("မှတ်တမ်းတင်ပြီးပါပြီ။");
      router.refresh();
    } else {
      setMsg(res.error);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <PencilLine className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">ကိုယ်တိုင် မှတ်တမ်းတင်</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        စက်မလိုဘဲ ဒီနေ့ data ကို ကိုယ်တိုင် ထည့်ပါ (ဖုန်းတိုင်း အလုပ်လုပ်သည်)။
      </p>
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-lg border bg-background px-2 py-2 text-sm"
        >
          {METRICS.map((m) => (
            <option key={m.type} value={m.type}>
              {m.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="တန်ဖိုး"
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy || value === ""}
          className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "ထည့်"}
        </button>
      </div>
      {msg ? <p className="text-sm text-primary">{msg}</p> : null}
    </form>
  );
}
