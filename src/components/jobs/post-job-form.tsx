"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveJob } from "@/lib/actions/jobs";
import {
  EMPLOYMENT_TYPES,
  JOB_CATEGORIES,
  MAX_JOB_QUESTIONS,
} from "@/lib/jobs";
import type { Job } from "@/types/database";

/** Employer form to post a new vacancy or edit an existing one. */
export function PostJobForm({ job }: { job?: Job }) {
  const router = useRouter();
  const [questions, setQuestions] = React.useState<string[]>(
    job?.questions ?? [],
  );
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const num = (k: string) => {
      const raw = String(fd.get(k) ?? "").trim();
      return raw ? Number(raw) : null;
    };
    const res = await saveJob(
      {
        title: String(fd.get("title") ?? ""),
        category: String(fd.get("category") ?? ""),
        employmentType: String(fd.get("employmentType") ?? "full_time"),
        company: String(fd.get("company") ?? ""),
        location: String(fd.get("location") ?? ""),
        description: String(fd.get("description") ?? ""),
        requirements: String(fd.get("requirements") ?? ""),
        salaryMin: num("salaryMin"),
        salaryMax: num("salaryMax"),
        salaryCurrency: String(fd.get("salaryCurrency") ?? "MMK") || "MMK",
        contact: String(fd.get("contact") ?? ""),
        questions: questions.map((q) => q.trim()).filter(Boolean),
      },
      job?.id,
    );
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push("/jobs/manage");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field name="title" label="ရာထူး / အလုပ်အမည်" required
        defaultValue={job?.title} placeholder="ဥပမာ — စိုက်ပျိုးရေး ဝန်ထမ်း" />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="category">
            ကဏ္ဍ (Category) <span className="text-destructive">*</span>
          </Label>
          <select
            id="category"
            name="category"
            required
            defaultValue={job?.category ?? ""}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="" disabled>
              ရွေးပါ…
            </option>
            {JOB_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.emoji} {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="employmentType">အလုပ်အမျိုးအစား</Label>
          <select
            id="employmentType"
            name="employmentType"
            defaultValue={job?.employment_type ?? "full_time"}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="company" label="ကုမ္ပဏီ / အဖွဲ့အစည်း"
          defaultValue={job?.company ?? ""} />
        <Field name="location" label="တည်နေရာ" defaultValue={job?.location ?? ""}
          placeholder="ဥပမာ — ရန်ကုန်" />
      </div>

      <div className="space-y-1">
        <Label htmlFor="description">
          အလုပ်အကြောင်း အသေးစိတ် <span className="text-destructive">*</span>
        </Label>
        <Textarea id="description" name="description" required rows={5}
          defaultValue={job?.description}
          placeholder="တာဝန်များ၊ အလုပ်ချိန်၊ အကျိုးခံစားခွင့်…" />
      </div>

      <div className="space-y-1">
        <Label htmlFor="requirements">လိုအပ်ချက် / အရည်အချင်း</Label>
        <Textarea id="requirements" name="requirements" rows={3}
          defaultValue={job?.requirements ?? ""}
          placeholder="ပညာအရည်အချင်း၊ အတွေ့အကြုံ၊ ကျွမ်းကျင်မှု…" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field name="salaryMin" label="လစာ (အနည်းဆုံး)" type="number"
          defaultValue={job?.salary_min?.toString() ?? ""} />
        <Field name="salaryMax" label="လစာ (အများဆုံး)" type="number"
          defaultValue={job?.salary_max?.toString() ?? ""} />
        <Field name="salaryCurrency" label="ငွေကြေး"
          defaultValue={job?.salary_currency ?? "MMK"} />
      </div>

      <Field name="contact" label="ဆက်သွယ်ရန် (ဖုန်း / email — optional)"
        defaultValue={job?.contact ?? ""} />

      {/* Custom application questions */}
      <div className="space-y-2 rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <Label>လျှောက်သူကို မေးမည့် မေးခွန်းများ</Label>
          <span className="text-xs text-muted-foreground">
            {questions.length}/{MAX_JOB_QUESTIONS}
          </span>
        </div>
        {questions.map((qtext, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={qtext}
              onChange={(e) =>
                setQuestions((prev) =>
                  prev.map((v, idx) => (idx === i ? e.target.value : v)),
                )
              }
              placeholder={`မေးခွန်း ${i + 1}`}
              maxLength={200}
            />
            <Button type="button" variant="ghost" size="icon"
              onClick={() => setQuestions((prev) => prev.filter((_, idx) => idx !== i))}
              aria-label="ဖျက်">
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {questions.length < MAX_JOB_QUESTIONS ? (
          <Button type="button" variant="outline" size="sm"
            onClick={() => setQuestions((prev) => [...prev, ""])}>
            <Plus className="mr-1 h-4 w-4" /> မေးခွန်း ထည့်ရန်
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
        {job ? "အလုပ်ခေါ်စာ ပြင်မည်" : "အလုပ်ခေါ်စာ တင်မည်"}
      </Button>
    </form>
  );
}

function Field({
  name,
  label,
  required,
  type = "text",
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input id={name} name={name} type={type} required={required}
        defaultValue={defaultValue} placeholder={placeholder}
        step={type === "number" ? "any" : undefined}
        min={type === "number" ? "0" : undefined} />
    </div>
  );
}
