import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PostJobForm } from "@/components/jobs/post-job-form";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { getJob } from "@/lib/db/jobs";

export const metadata = { title: "Edit job" };
export const dynamic = "force-dynamic";

export default async function EditJobPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const job = await getJob(params.id);
  if (!job) notFound();
  if (job.employer_id !== profile.id) redirect(`/jobs/${job.id}`);

  return (
    <div className="space-y-4">
      <Link
        href="/jobs/manage"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> ကျွန်ုပ် အလုပ်များ ဆီ
      </Link>
      <h1 className="text-xl font-bold">အလုပ်ခေါ်စာ ပြင်ရန်</h1>
      <Card>
        <CardContent className="p-4">
          <PostJobForm job={job} />
        </CardContent>
      </Card>
    </div>
  );
}
