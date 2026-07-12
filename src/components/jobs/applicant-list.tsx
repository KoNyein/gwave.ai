"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { setApplicationStatus } from "@/lib/actions/jobs";
import { displayName, timeAgo } from "@/lib/format";
import { APPLICATION_STATUSES, applicationStatusMeta } from "@/lib/jobs";
import type { JobApplicationWithApplicant } from "@/lib/db/jobs";

/** Employer view of everyone who applied to a job, with pipeline controls. */
export function ApplicantList({
  applications,
}: {
  applications: JobApplicationWithApplicant[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function move(id: string, status: (typeof APPLICATION_STATUSES)[number]["value"]) {
    setBusy(id);
    await setApplicationStatus(id, status);
    setBusy(null);
    router.refresh();
  }

  if (applications.length === 0) {
    return (
      <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
        လျှောက်ထားသူ မရှိသေးပါ။
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {applications.map((a) => {
        const meta = applicationStatusMeta(a.status);
        return (
          <Card key={a.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{a.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.applicant ? `@${displayName(a.applicant)} · ` : ""}
                    {timeAgo(a.created_at)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.style}`}
                >
                  {meta.label}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {a.phone}
                </span>
                {a.email ? (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {a.email}
                  </span>
                ) : null}
                {a.experience_years != null ? (
                  <span>အတွေ့အကြုံ {a.experience_years} နှစ်</span>
                ) : null}
                {a.expected_salary != null ? (
                  <span>လစာ {Number(a.expected_salary).toLocaleString("en-US")}</span>
                ) : null}
              </div>

              {a.cover_letter ? (
                <p className="whitespace-pre-wrap rounded-lg bg-muted p-2 text-sm">
                  {a.cover_letter}
                </p>
              ) : null}

              {a.resume_url ? (
                <a
                  href={a.resume_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  CV / Resume ကြည့်ရန်
                </a>
              ) : null}

              {a.answers && a.answers.length > 0 ? (
                <div className="space-y-1.5 rounded-lg border p-2 text-sm">
                  {a.answers.map((qa, i) => (
                    <div key={i}>
                      <p className="text-xs font-medium text-muted-foreground">
                        {qa.q}
                      </p>
                      <p>{qa.a || "—"}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-1.5 border-t pt-2">
                {APPLICATION_STATUSES.map((s) => (
                  <Button
                    key={s.value}
                    size="sm"
                    variant={a.status === s.value ? "default" : "outline"}
                    disabled={busy === a.id || a.status === s.value}
                    onClick={() => move(a.id, s.value)}
                  >
                    {busy === a.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      s.label
                    )}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
