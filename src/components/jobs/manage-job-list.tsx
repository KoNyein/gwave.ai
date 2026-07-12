"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Loader2, Pencil, Power, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { deleteJob, setJobStatus } from "@/lib/actions/jobs";
import { timeAgo } from "@/lib/format";
import { employmentTypeLabel, jobCategory } from "@/lib/jobs";
import type { Job } from "@/types/database";

/** Employer's own postings with open/close, edit, delete and an applicants link. */
export function ManageJobList({ jobs }: { jobs: Job[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function toggle(job: Job) {
    setBusy(job.id);
    await setJobStatus(job.id, job.status === "open" ? "closed" : "open");
    setBusy(null);
    router.refresh();
  }

  async function remove(job: Job) {
    if (!window.confirm("ဒီအလုပ်ခေါ်စာကို ဖျက်မှာ သေချာလား?")) return;
    setBusy(job.id);
    await deleteJob(job.id);
    setBusy(null);
    router.refresh();
  }

  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
        သင် ခေါ်ထားတဲ့ အလုပ် မရှိသေးပါ။
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => {
        const cat = jobCategory(job.category);
        return (
          <Card key={job.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {cat?.emoji} {job.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {cat?.label} · {employmentTypeLabel(job.employment_type)} ·{" "}
                    {timeAgo(job.created_at)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    job.status === "open"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {job.status === "open" ? "ဖွင့်ထား" : "ပိတ်ထား"}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/jobs/manage/${job.id}`}>
                    <Users className="mr-1 h-3.5 w-3.5" /> လျှောက်သူများ
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/jobs/${job.id}`}>
                    <Eye className="mr-1 h-3.5 w-3.5" /> ကြည့်
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/jobs/${job.id}/edit`}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> ပြင်
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === job.id}
                  onClick={() => toggle(job)}
                >
                  {busy === job.id ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Power className="mr-1 h-3.5 w-3.5" />
                  )}
                  {job.status === "open" ? "ပိတ်" : "ဖွင့်"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === job.id}
                  onClick={() => remove(job)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> ဖျက်
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
