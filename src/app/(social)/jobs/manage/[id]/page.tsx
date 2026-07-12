import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ApplicantList } from "@/components/jobs/applicant-list";
import { getCurrentProfile } from "@/lib/auth";
import { getJob, getJobApplications } from "@/lib/db/jobs";
import { jobCategory } from "@/lib/jobs";

export const metadata = { title: "Applicants" };
export const dynamic = "force-dynamic";

export default async function JobApplicantsPage({
  params,
}: {
  params: { id: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const job = await getJob(params.id);
  if (!job) notFound();
  // Only the employer (or admin) may review applicants.
  if (job.employer_id !== profile.id && profile.role !== "admin" && profile.role !== "super_admin") {
    redirect("/jobs");
  }

  const applications = await getJobApplications(job.id);
  const cat = jobCategory(job.category);

  return (
    <div className="space-y-4">
      <Link
        href="/jobs/manage"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> ကျွန်ုပ် အလုပ်များ ဆီ
      </Link>
      <div>
        <h1 className="text-xl font-bold">
          {cat?.emoji} {job.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          လျှောက်ထားသူ {applications.length} ဦး
        </p>
      </div>
      <ApplicantList applications={applications} />
    </div>
  );
}
