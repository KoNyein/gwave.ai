"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Award, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { claimCertificate } from "@/lib/actions/certificates";

/**
 * Shown on a track page once every lesson is completed: claims (or opens)
 * the course-completion certificate.
 */
export function CertificateClaim({
  trackSlug,
  certificateId,
}: {
  trackSlug: string;
  certificateId: string | null;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  if (certificateId) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href={`/learn/certificate/${certificateId}`}>
          <Award className="mr-1.5 h-4 w-4 text-amber-500" />
          🎓 လက်မှတ် ကြည့်ရန်
        </Link>
      </Button>
    );
  }

  function claim() {
    setError(null);
    startTransition(async () => {
      const result = await claimCertificate(trackSlug);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/learn/certificate/${result.data.certificateId}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={claim} disabled={pending}>
        {pending ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Award className="mr-1.5 h-4 w-4" />
        )}
        🎓 လက်မှတ် ထုတ်ယူမည်
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
