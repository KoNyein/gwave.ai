"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { withdrawApplication } from "@/lib/actions/jobs";
import { timeAgo } from "@/lib/format";
import { applicationStatusMeta, jobCategory } from "@/lib/jobs";
import type { MyApplication } from "@/lib/db/jobs";

/** Job-seeker's own applications, each showing its status; can be withdrawn. */
export function MyApplications({ applications }: { applications: MyApplication[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function withdraw(id: string) {
    if (!window.confirm("လျှောက်လွှာ ပြန်ရုပ်သိမ်းမှာ သေချာလား?")) return;
    setBusy(id);
    await withdrawApplication(id);
    setBusy(null);
    router.refresh();
  }

  if (applications.length === 0) {
    return (
      <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
        သင် လျှောက်ထားတဲ့ အလုပ် မရှိသေးပါ။{" "}
        <Link href="/jobs" className="font-medium text-primary hover:underline">
          အလုပ်များ ရှာရန်
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {applications.map((a) => {
        const meta = applicationStatusMeta(a.status);
        const cat = a.job ? jobCategory(a.job.category) : undefined;
        return (
          <Card key={a.id}>
            <CardContent className="flex items-center justify-between gap-2 p-4">
              <div className="min-w-0">
                {a.job ? (
                  <Link
                    href={`/jobs/${a.job.id}`}
                    className="font-semibold hover:underline"
                  >
                    {cat?.emoji} {a.job.title}
                  </Link>
                ) : (
                  <p className="font-semibold text-muted-foreground">
                    (ဖျက်လိုက်သော အလုပ်)
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {timeAgo(a.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.style}`}
                >
                  {meta.label}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={busy === a.id}
                  onClick={() => withdraw(a.id)}
                  aria-label="ရုပ်သိမ်း"
                  className="text-destructive hover:text-destructive"
                >
                  {busy === a.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
