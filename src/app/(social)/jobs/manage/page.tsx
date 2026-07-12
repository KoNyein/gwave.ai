import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";

import { ManageJobList } from "@/components/jobs/manage-job-list";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { getMyJobs } from "@/lib/db/jobs";

export const metadata = { title: "Manage jobs" };
export const dynamic = "force-dynamic";

export default async function ManageJobsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const jobs = await getMyJobs();

  return (
    <div className="space-y-4">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> အလုပ်များ ဆီ ပြန်သွားရန်
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">ကျွန်ုပ် ခေါ်ထားသော အလုပ်များ</h1>
        <Button asChild size="sm">
          <Link href="/jobs/new">
            <Plus className="mr-1 h-4 w-4" /> အသစ်
          </Link>
        </Button>
      </div>
      <ManageJobList jobs={jobs} />
    </div>
  );
}
