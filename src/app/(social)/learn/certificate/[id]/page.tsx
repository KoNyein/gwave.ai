import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Award, BadgeCheck } from "lucide-react";

import { PrintButton } from "@/components/learn/print-button";
import { ShareResultButton } from "@/components/tools/share-result-button";
import { getCertificate } from "@/lib/db/certificates";

export const metadata = { title: "Certificate" };
export const dynamic = "force-dynamic";

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cert = await getCertificate(id);
  if (!cert) notFound();

  const name = cert.owner_name ?? cert.owner_username ?? "Learner";
  const issued = new Date(cert.issued_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const shareText =
    `🎓 ${name} သည် gwave Learn ၏ "${cert.track_title}" သင်တန်း ` +
    `(သင်ခန်းစာ ${cert.lessons_completed} ခု) ကို အောင်မြင်စွာ ပြီးမြောက်ခဲ့ပါသည်!\n\n` +
    `လက်မှတ် စစ်ဆေးရန်: /learn/certificate/${cert.id}`;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/learn"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        <ArrowLeft className="h-4 w-4" /> Learn သို့ ပြန်သွားရန်
      </Link>

      {/* The certificate itself — print-friendly */}
      <div className="print-certificate rounded-2xl border-4 border-double border-amber-500/60 bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20">
          <Award className="h-9 w-9 text-amber-600" />
        </div>
        <p className="mt-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Certificate of Completion
        </p>
        <h1 className="mt-1 text-lg font-bold text-primary">
          🌱 gwave Learn — အောင်လက်မှတ်
        </h1>

        <p className="mt-6 text-sm text-muted-foreground">ဤလက်မှတ်ကို</p>
        <p className="mt-1 text-2xl font-bold">{name}</p>
        {cert.owner_username ? (
          <p className="text-sm text-muted-foreground">@{cert.owner_username}</p>
        ) : null}

        <p className="mt-4 text-sm text-muted-foreground">
          အား အောက်ပါ သင်တန်းကို ပြီးမြောက်အောင် သင်ယူခဲ့ခြင်းအတွက် ချီးမြှင့်ပါသည်
        </p>
        <p className="mt-2 text-xl font-bold">{cert.track_title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          သင်ခန်းစာ {cert.lessons_completed} ခု · {issued}
        </p>

        <div className="mx-auto mt-6 flex max-w-xs items-center justify-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">
          <BadgeCheck className="h-3.5 w-3.5 text-primary" />
          Certificate ID: {cert.id.slice(0, 13)}…
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <PrintButton />
        <ShareResultButton content={shareText} />
      </div>
    </div>
  );
}
