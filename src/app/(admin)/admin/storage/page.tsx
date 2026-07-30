import { Database, HardDrive, Layers, TriangleAlert } from "lucide-react";

import { StorageTables } from "@/components/admin/storage-tables";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatBytes,
  getDatabaseStorage,
  getS3Storage,
} from "@/lib/db/storage-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Storage — Admin" };

const num = new Intl.NumberFormat("en-US");

/**
 * System storage: how much data Gwave holds and where it sits.
 *
 * Split by where it is billed, because that is the decision the numbers are
 * for — Postgres rows on RDS versus uploaded bytes on S3. The AWS cost page
 * turns the same two numbers into money.
 */
export default async function AdminStoragePage() {
  const [db, s3] = await Promise.all([getDatabaseStorage(), getS3Storage()]);
  const grandTotal = db.totalBytes + s3.totalBytes;

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <HardDrive className="h-5 w-5 text-primary" />
          Storage — စနစ်တစ်ခုလုံး၏ Data
        </h1>
        <p className="text-sm text-muted-foreground">
          Database (RDS) နှင့် ဖိုင်သိမ်းဆည်းမှု (S3) — ဘယ်နေရာမှာ ဘယ်လောက်
          ရှိသလဲ။ ကုန်ကျစရိတ်ကို{" "}
          <a href="/admin/aws" className="text-primary hover:underline">
            AWS ကုန်ကျစရိတ်
          </a>{" "}
          စာမျက်နှာမှာ ကြည့်ပါ။
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "စုစုပေါင်း သိမ်းဆည်းမှု",
            value: formatBytes(grandTotal),
            hint: "RDS + S3",
          },
          {
            label: "Database (RDS)",
            value: formatBytes(db.totalBytes),
            hint: `${num.format(db.tableCount)} table · ${num.format(db.indexCount)} index`,
          },
          {
            label: "ဖိုင်များ (S3)",
            value: s3.error ? "–" : formatBytes(s3.totalBytes),
            hint: s3.error
              ? "CloudWatch ခွင့်ပြုချက် လိုအပ်သည်"
              : `${num.format(Math.round(s3.totalObjects))} object`,
          },
          {
            label: "အကြီးဆုံး table",
            value: db.largestTable ?? "–",
            hint: formatBytes(db.largestTableBytes),
          },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="truncate text-lg font-bold tabular-nums">
                {c.value}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {c.hint}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {db.error ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-400 bg-amber-500/10 p-3 text-sm">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-700 dark:text-amber-400">
              Database အရွယ်အစား မဖတ်နိုင်သေးပါ
            </p>
            <p className="text-muted-foreground">{db.error}</p>
          </div>
        </div>
      ) : null}

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 px-1 text-sm font-semibold">
          <Layers className="h-4 w-4 text-primary" /> ဖိုင်သိမ်းဆည်းမှု (S3
          bucket များ)
        </h2>
        {s3.error ? (
          <div className="rounded-xl border p-3 text-sm">
            <p className="font-semibold">
              CloudWatch metric မဖတ်နိုင်ပါ — IAM ခွင့်ပြုချက် ထည့်ရန် လိုသည်
            </p>
            <p className="mb-2 text-xs text-muted-foreground">{s3.error}</p>
            <pre className="overflow-x-auto rounded-lg bg-muted p-2 text-[11px] leading-relaxed">
              {`{
  "Effect": "Allow",
  "Action": ["cloudwatch:GetMetricData"],
  "Resource": "*"
}`}
            </pre>
            <p className="mt-2 text-[11px] text-muted-foreground">
              EC2 instance role တွင် ဤ policy ထည့်ပါ။ S3 object များကို
              စာရင်းလိုက်ရေတွက်တာထက် CloudWatch metric ကို သုံးရတာက စာမျက်နှာ
              တစ်ခါဖွင့်တိုင်း API call ထောင်ချီ မဖြစ်စေရန်ဖြစ်သည်။
            </p>
          </div>
        ) : s3.buckets.length === 0 ? (
          <p className="rounded-xl border p-3 text-sm text-muted-foreground">
            S3 bucket env မသတ်မှတ်ရသေးပါ (AWS_S3_MEDIA_BUCKET စသည်)။
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {s3.buckets.map((b) => (
              <Card key={b.bucket}>
                <CardContent className="space-y-1 p-3">
                  <p className="truncate font-mono text-xs font-semibold">
                    {b.bucket}
                  </p>
                  <p className="text-lg font-bold tabular-nums">
                    {formatBytes(b.bytes)}
                    {b.objects != null ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {num.format(Math.round(b.objects))} object
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {b.purpose}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
          S3 ၏ အရွယ်အစား metric ကို AWS က တစ်ရက်တစ်ကြိမ်သာ ထုတ်ပေးသဖြင့် ဤ
          ကိန်းဂဏန်းများသည် ၂၄ နာရီအထိ နောက်ကျနိုင်ပါသည်။ အခုမှ တင်လိုက်တဲ့ ဖိုင်
          ချက်ချင်း မပေါ်ပါ။
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 px-1 text-sm font-semibold">
          <Database className="h-4 w-4 text-primary" /> Database — table
          အလိုက် အသေးစိတ်
        </h2>
        <StorageTables rows={db.tables} dbBytes={db.totalBytes} />
      </section>

      <details className="rounded-xl border">
        <summary className="cursor-pointer px-4 py-2 text-sm font-semibold">
          ❓ ဤကိန်းဂဏန်းများ ဘာကို ဆိုလိုသလဲ
        </summary>
        <div className="space-y-2 px-4 pb-3 text-xs leading-relaxed text-muted-foreground">
          <p>
            <strong>Rows</strong> — Postgres planner ၏ ခန့်မှန်းချက် (reltuples)
            ဖြစ်သည်။ တိကျစွာ ရေတွက်ရန်ဆိုလျှင် table တစ်ခုလုံးကို scan
            လုပ်ရမည်ဖြစ်၍ စာမျက်နှာ ဖွင့်တိုင်း နှေးသွားပါလိမ့်မယ်။ ANALYZE
            ပြီးတိုင်း ပြန်လည် မှန်ကန်လာပါသည်။
          </p>
          <p>
            <strong>Data / Index / TOAST</strong> — Data က row များကိုယ်တိုင်၊
            Index က ရှာဖွေမှုကို မြန်စေရန် ထပ်ဆောင်း သိမ်းထားသည့် အရာ၊ TOAST က
            စာသားရှည်နှင့် array ကဲ့သို့ ကြီးမားသော တန်ဖိုးများကို သီးသန့်
            သိမ်းထားရာ နေရာ ဖြစ်သည်။ Index က Data ထက် များနေလျှင် index
            အလွန်အကျွံ ရှိနေခြင်း ဖြစ်တတ်သည်။
          </p>
          <p>
            <strong>Database စုစုပေါင်း</strong> — table အားလုံး၏ ပေါင်းလဒ်ထက်
            အနည်းငယ် ပိုနိုင်သည် (system catalog များ ပါဝင်သောကြောင့်)။
          </p>
        </div>
      </details>
    </div>
  );
}
