import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { MyApplications } from "@/components/jobs/my-applications";
import { getCurrentProfile } from "@/lib/auth";
import { getMyApplications } from "@/lib/db/jobs";

export const metadata = { title: "My applications" };
export const dynamic = "force-dynamic";

export default async function MyApplicationsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const applications = await getMyApplications();

  return (
    <div className="space-y-4">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> အလုပ်များ ဆီ ပြန်သွားရန်
      </Link>
      <h1 className="text-xl font-bold">ကျွန်ုပ် လျှောက်ထားမှုများ</h1>
      <MyApplications applications={applications} />
    </div>
  );
}
