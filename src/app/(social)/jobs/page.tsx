import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, ListChecks, Plus, Search, Settings2 } from "lucide-react";

import { JobCard } from "@/components/jobs/job-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentProfile } from "@/lib/auth";
import { getJobs } from "@/lib/db/jobs";
import { JOB_CATEGORIES } from "@/lib/jobs";
import { cn } from "@/lib/utils";

export const metadata = { title: "Jobs" };
export const dynamic = "force-dynamic";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: { category?: string; q?: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const category = searchParams.category;
  const q = searchParams.q?.trim();
  const jobs = await getJobs({ category, q });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold">အလုပ်အကိုင် (Jobs)</h1>
            <p className="text-sm text-muted-foreground">
              အလုပ်ရှာ၊ လျှောက် — သို့မဟုတ် အလုပ်ခေါ်ပါ။
            </p>
          </div>
        </div>
        <Button asChild size="sm">
          <Link href="/jobs/new">
            <Plus className="mr-1 h-4 w-4" /> အလုပ်ခေါ်ရန်
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/jobs/applications">
            <ListChecks className="mr-1 h-4 w-4" /> ကျွန်ုပ် လျှောက်ထားမှုများ
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/jobs/manage">
            <Settings2 className="mr-1 h-4 w-4" /> ကျွန်ုပ် ခေါ်ထားသော အလုပ်များ
          </Link>
        </Button>
      </div>

      {/* Search */}
      <form action="/jobs" className="flex gap-2">
        {category ? (
          <input type="hidden" name="category" value={category} />
        ) : null}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="ရာထူး / keyword ရှာရန်…"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          ရှာ
        </Button>
      </form>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        <CategoryChip label="အားလုံး" href="/jobs" active={!category} />
        {JOB_CATEGORIES.map((c) => (
          <CategoryChip
            key={c.slug}
            label={`${c.emoji} ${c.label}`}
            href={`/jobs?category=${c.slug}`}
            active={category === c.slug}
          />
        ))}
      </div>

      {/* Listings */}
      {jobs.length === 0 ? (
        <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
          ဒီ category မှာ အလုပ်ခေါ်စာ မရှိသေးပါ။ ပထမဆုံး ခေါ်တဲ့သူ ဖြစ်လိုက်ပါ!
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </Link>
  );
}
