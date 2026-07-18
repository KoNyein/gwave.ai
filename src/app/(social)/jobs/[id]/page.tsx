import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Briefcase, Building2, Clock, MapPin, Phone } from "lucide-react";

import { ApplyForm } from "@/components/jobs/apply-form";
import { formatSalary } from "@/components/jobs/job-card";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { getJob, getMyApplicationForJob } from "@/lib/db/jobs";
import { displayName, timeAgo } from "@/lib/format";
import { employmentTypeLabel, jobCategory } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const job = await getJob(params.id);
  return { title: job?.title ?? "Job" };
}

export default async function JobDetailPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const job = await getJob(params.id);
  if (!job) notFound();

  const isOwner = job.employer_id === profile.id;
  const cat = jobCategory(job.category);
  const salary = formatSalary(job);
  const alreadyApplied = isOwner ? null : await getMyApplicationForJob(job.id);
  const defaultName = displayName(profile) || "";

  return (
    <div className="space-y-4">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> အလုပ်များ ဆီ ပြန်သွားရန်
      </Link>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl">
              {cat?.emoji ?? "💼"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold">{job.title}</h1>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                  {employmentTypeLabel(job.employment_type)}
                </span>
                {job.status === "closed" ? (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                    ပိတ်ထားသည်
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Briefcase className="h-3 w-3" /> {cat?.label ?? job.category}
                </span>
                {job.company ? (
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> {job.company}
                  </span>
                ) : null}
                {job.location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {job.location}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {timeAgo(job.created_at)}
                </span>
              </div>
            </div>
          </div>

          {salary ? (
            <p className="text-lg font-bold text-primary">{salary}</p>
          ) : null}

          <div>
            <h2 className="mb-1 text-sm font-semibold">အလုပ်အကြောင်း</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {job.description}
            </p>
          </div>

          {job.requirements ? (
            <div>
              <h2 className="mb-1 text-sm font-semibold">လိုအပ်ချက်</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {job.requirements}
              </p>
            </div>
          ) : null}

          {job.contact ? (
            <p className="inline-flex items-center gap-1.5 text-sm">
              <Phone className="h-4 w-4 text-primary" />
              <span className="font-medium">{job.contact}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Apply / status */}
      {isOwner ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between gap-2 p-4 text-sm">
            <span>ဒါက သင် ခေါ်ထားတဲ့ အလုပ်ဖြစ်ပါတယ်။</span>
            <Link
              href="/jobs/manage"
              className="font-medium text-primary hover:underline"
            >
              လျှောက်သူများ ကြည့်ရန်
            </Link>
          </CardContent>
        </Card>
      ) : job.status === "closed" ? (
        <Card>
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            ဒီအလုပ်ခေါ်စာ ပိတ်ထားပြီ ဖြစ်ပါသည်။
          </CardContent>
        </Card>
      ) : alreadyApplied ? (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4 text-center text-sm">
            ✓ သင် ဒီအလုပ်ကို လျှောက်ထားပြီး ဖြစ်ပါသည်။{" "}
            <Link
              href="/jobs/applications"
              className="font-medium text-primary hover:underline"
            >
              လျှောက်ထားမှုများ ကြည့်ရန်
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <ApplyForm
              jobId={job.id}
              questions={job.questions ?? []}
              defaultName={defaultName}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
