"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, LogIn } from "lucide-react";

import { createPttChannel, joinPttChannel } from "@/lib/actions/ptt";

export function TalkHome() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState<null | "create" | "join">(null);
  const [error, setError] = React.useState<string | null>(null);

  async function create() {
    if (!name.trim()) return;
    setBusy("create");
    setError(null);
    const res = await createPttChannel(name.trim());
    setBusy(null);
    if (res.ok) router.push(`/talk/${res.data.id}`);
    else setError(res.error);
  }

  async function join() {
    if (!code.trim()) return;
    setBusy("join");
    setError(null);
    const res = await joinPttChannel(code.trim());
    setBusy(null);
    if (res.ok) router.push(`/talk/${res.data.id}`);
    else setError(res.error);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2 rounded-xl border bg-card p-3">
        <p className="text-sm font-semibold">Channel အသစ် ဖွင့်ရန်</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="ဥပမာ — ရွာ အရေးပေါ်"
          className="w-full rounded-lg border bg-background p-2 text-sm"
        />
        <button
          type="button"
          onClick={create}
          disabled={busy !== null}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy === "create" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          ဖွင့်မယ်
        </button>
      </div>

      <div className="space-y-2 rounded-xl border bg-card p-3">
        <p className="text-sm font-semibold">Code နဲ့ ဝင်ရန်</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={12}
          placeholder="ABC123"
          className="w-full rounded-lg border bg-background p-2 font-mono text-sm uppercase"
        />
        <button
          type="button"
          onClick={join}
          disabled={busy !== null}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-60"
        >
          {busy === "join" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          ဝင်မယ်
        </button>
      </div>

      {error ? (
        <p className="text-sm text-destructive sm:col-span-2">❌ {error}</p>
      ) : null}
    </div>
  );
}
