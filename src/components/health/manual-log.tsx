"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, PencilLine } from "lucide-react";

import { logManualMetric } from "@/lib/actions/health";
import { useLocale } from "next-intl";
import { prefersMyanmarScript } from "@/i18n/config";

const METRICS = [
  { type: "steps", en: "Steps", my: "ခြေလှမ်း" },
  { type: "sleep", en: "Sleep (min)", my: "အိပ်ချိန် (မိနစ်)" },
  { type: "calories", en: "Calories", my: "ကယ်လိုရီ" },
  { type: "heart_rate", en: "Heart rate (bpm)", my: "နှလုံးခုန် (bpm)" },
  { type: "screen_time", en: "Screen time (min)", my: "Screen time (မိနစ်)" },
] as const;

/**
 * Account-free entry: type today's steps / sleep / calories / heart rate by
 * hand. Works on any phone with no device or sign-up — the fastest way to see
 * the dashboard fill in.
 */
export function ManualLog() {
  const mm = prefersMyanmarScript(useLocale());
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
      setMsg(mm ? "မှတ်တမ်းတင်ပြီးပါပြီ။" : "Logged.");
      router.refresh();
    } else {
      setMsg(res.error);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <PencilLine className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">{mm ? "ကိုယ်တိုင် မှတ်တမ်းတင်" : "Manual log"}</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        {mm
          ? "စက်မလိုဘဲ ဒီနေ့ data ကို ကိုယ်တိုင် ထည့်ပါ (ဖုန်းတိုင်း အလုပ်လုပ်သည်)။"
          : "No device needed — enter today's data yourself (works on any phone)."}
      </p>
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-lg border bg-background px-2 py-2 text-sm"
        >
          {METRICS.map((m) => (
            <option key={m.type} value={m.type}>
              {mm ? m.my : m.en}
            </option>
          ))}
        </select>
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={mm ? "တန်ဖိုး" : "Value"}
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
