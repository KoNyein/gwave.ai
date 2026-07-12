"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { applyToJob } from "@/lib/actions/jobs";

/** Job-seeker application form: standard details + answers to the employer's
 *  custom questions. */
export function ApplyForm({
  jobId,
  questions,
  defaultName,
}: {
  jobId: string;
  questions: string[];
  defaultName: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = React.useState<string[]>(
    questions.map(() => ""),
  );
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const num = (k: string) => {
      const raw = String(fd.get(k) ?? "").trim();
      return raw ? Number(raw) : null;
    };
    const res = await applyToJob({
      jobId,
      fullName: String(fd.get("fullName") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? ""),
      coverLetter: String(fd.get("coverLetter") ?? ""),
      expectedSalary: num("expectedSalary"),
      experienceYears: num("experienceYears"),
      resumeUrl: String(fd.get("resumeUrl") ?? ""),
      answers: questions.map((q, i) => ({ q, a: answers[i] ?? "" })),
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-center">
        <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-primary" />
        <p className="font-semibold">လျှောက်လွှာ တင်ပြီးပါပြီ ✓</p>
        <p className="text-sm text-muted-foreground">
          အလုပ်ရှင်မှ သင့်လျှောက်လွှာကို ကြည့်ရှုပါလိမ့်မည်။
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="font-semibold">📝 လျှောက်ထားရန်</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="fullName">
            အမည် <span className="text-destructive">*</span>
          </Label>
          <Input id="fullName" name="fullName" required maxLength={120}
            defaultValue={defaultName} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="phone">
            ဖုန်း <span className="text-destructive">*</span>
          </Label>
          <Input id="phone" name="phone" required maxLength={40}
            placeholder="09xxxxxxxxx" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="email">အီးမေးလ်</Label>
          <Input id="email" name="email" type="email" maxLength={160} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="resumeUrl">CV / Resume link</Label>
          <Input id="resumeUrl" name="resumeUrl" placeholder="https://…" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="experienceYears">အတွေ့အကြုံ (နှစ်)</Label>
          <Input id="experienceYears" name="experienceYears" type="number"
            min="0" max="80" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="expectedSalary">မျှော်မှန်း လစာ</Label>
          <Input id="expectedSalary" name="expectedSalary" type="number"
            min="0" step="any" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="coverLetter">မိတ်ဆက် / ဘာကြောင့် သင့်တော်ကြောင်း</Label>
        <Textarea id="coverLetter" name="coverLetter" rows={3} maxLength={3000} />
      </div>

      {/* Employer's custom questions */}
      {questions.length > 0 ? (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-sm font-medium">အလုပ်ရှင်၏ မေးခွန်းများ</p>
          {questions.map((q, i) => (
            <div key={i} className="space-y-1">
              <Label htmlFor={`q-${i}`}>
                {i + 1}. {q}
              </Label>
              <Textarea
                id={`q-${i}`}
                rows={2}
                maxLength={1000}
                value={answers[i] ?? ""}
                onChange={(e) =>
                  setAnswers((prev) =>
                    prev.map((v, idx) => (idx === i ? e.target.value : v)),
                  )
                }
              />
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={pending} className="w-full gap-2">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        လျှောက်လွှာ တင်မည်
      </Button>
    </form>
  );
}
