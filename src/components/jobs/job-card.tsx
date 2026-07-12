import Link from "next/link";
import { Briefcase, Clock, MapPin } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { timeAgo } from "@/lib/format";
import { employmentTypeLabel, jobCategory } from "@/lib/jobs";
import type { JobWithEmployer } from "@/lib/db/jobs";

export function formatSalary(job: {
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
}): string | null {
  const { salary_min: lo, salary_max: hi, salary_currency: cur } = job;
  if (lo == null && hi == null) return null;
  const fmt = (n: number) => n.toLocaleString("en-US");
  if (lo != null && hi != null) return `${fmt(lo)}–${fmt(hi)} ${cur}`;
  if (lo != null) return `${fmt(lo)}+ ${cur}`;
  return `≤ ${fmt(hi as number)} ${cur}`;
}

/** A single job listing row/card, linking to its detail page. */
export function JobCard({ job }: { job: JobWithEmployer }) {
  const cat = jobCategory(job.category);
  const salary = formatSalary(job);
  const employer =
    job.company || job.employer?.full_name || job.employer?.username || "—";

  return (
    <Link href={`/jobs/${job.id}`} className="block">
      <Card className="h-full transition-colors hover:bg-muted/50">
        <CardContent className="flex items-start gap-3 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg">
            {cat?.emoji ?? "💼"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold leading-tight">{job.title}</p>
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                {employmentTypeLabel(job.employment_type)}
              </span>
            </div>
            <p className="truncate text-sm text-muted-foreground">{employer}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Briefcase className="h-3 w-3" /> {cat?.label ?? job.category}
              </span>
              {job.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {job.location}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> {timeAgo(job.created_at)}
              </span>
            </div>
            {salary ? (
              <p className="mt-1 text-sm font-semibold text-primary">{salary}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
