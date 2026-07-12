import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PostJobForm } from "@/components/jobs/post-job-form";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";

export const metadata = { title: "Post a job" };
export const dynamic = "force-dynamic";

export default async function NewJobPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="space-y-4">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> အလုပ်များ ဆီ ပြန်သွားရန်
      </Link>
      <h1 className="text-xl font-bold">အလုပ်ခေါ်ရန် (Post a job)</h1>
      <Card>
        <CardContent className="p-4">
          <PostJobForm />
        </CardContent>
      </Card>
    </div>
  );
}
