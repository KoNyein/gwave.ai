import { Cloud, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";

import { CostRefreshButton } from "@/components/admin/cost-refresh-button";
import { Card, CardContent } from "@/components/ui/card";
import { costNote, getAwsCostReport } from "@/lib/aws/cost";

export const dynamic = "force-dynamic";
export const metadata = { title: "AWS cost — Admin" };

function usd(n: number): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: n < 10 ? 2 : 0,
    maximumFractionDigits: n < 10 ? 2 : 0,
  })}`;
}

/**
 * AWS ကုန်ကျစရိတ် — ဘယ်ဝန်ဆောင်မှုက ဘယ်လောက်၊ ဘာကြောင့်။
 *
 * The console can already show what you were charged. What it can't tell you is
 * why *this* app is charged for *that* service, which is the thing you need in
 * order to decide whether a line is worth paying. Every service row here
 * carries what Gwave runs on it, what the meter actually counts, and the one
 * lever that would move it.
 */
export default async function AdminAwsPage() {
  const report = await getAwsCostReport();
  const maxService = Math.max(0.01, ...report.services.map((s) => s.amount));
  const maxDay = Math.max(0.01, ...report.daily.map((d) => d.amount));
  const delta =
    report.previousMonth > 0
      ? ((report.monthToDate - report.previousMonth) / report.previousMonth) *
        100
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2 px-1">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Cloud className="h-5 w-5 text-primary" />
            AWS ကုန်ကျစရိတ်
          </h1>
          <p className="text-sm text-muted-foreground">
            ဘယ်ဝန်ဆောင်မှုတွေကို အခပေးနေရလဲ၊ ဘာကြောင့်လဲ — Cost Explorer မှ
            တိုက်ရိုက်၊ credit မခုနှိမ်မီ တကယ့်သုံးစွဲမှုအတိုင်း။ Data အရွယ်အစားကို{" "}
            <a href="/admin/storage" className="text-primary hover:underline">
              Storage
            </a>{" "}
            စာမျက်နှာမှာ ကြည့်ပါ။
          </p>
        </div>
        <CostRefreshButton fetchedAt={report.fetchedAt} />
      </div>

      {report.error ? (
        <div className="space-y-2 rounded-xl border border-amber-400 bg-amber-500/10 p-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-400">
            <TriangleAlert className="h-4 w-4" /> Cost Explorer ကို မဖတ်နိုင်ပါ
          </p>
          <p className="text-xs text-muted-foreground">{report.error}</p>
          <p className="text-xs">
            EC2 instance role တွင် အောက်ပါ policy ထည့်ပါ။ ထို့အပြင် AWS
            console → Billing → Cost Explorer ကို တစ်ကြိမ် ဖွင့်ပေးရပါမည်
            (ပထမဆုံး ဖွင့်ပြီး ၂၄ နာရီအတွင်း data စတင် ရရှိပါသည်)၊ management
            account မဟုတ်လျှင် <em>Billing access for IAM users</em> ကိုလည်း
            ဖွင့်ရပါမည်။
          </p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-2 text-[11px] leading-relaxed">
            {`{
  "Effect": "Allow",
  "Action": [
    "ce:GetCostAndUsage",
    "ce:GetCostForecast"
  ],
  "Resource": "*"
}`}
          </pre>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">
              တကယ့်သုံးစွဲမှု ({report.monthLabel})
            </p>
            <p className="text-xl font-bold tabular-nums">
              {usd(report.monthToDate)}
            </p>
            {delta != null ? (
              <p
                className={`flex items-center gap-1 text-[11px] ${
                  delta >= 0 ? "text-red-600" : "text-emerald-600"
                }`}
              >
                {delta >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                ပြီးခဲ့သောလနှင့် {delta >= 0 ? "+" : ""}
                {delta.toFixed(0)}%
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">ပြီးခဲ့သောလ</p>
            <p className="text-xl font-bold tabular-nums">
              {usd(report.previousMonth)}
            </p>
            <p className="text-[11px] text-muted-foreground">လအပြည့်</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">ဤလ ခန့်မှန်းချက်</p>
            <p className="text-xl font-bold tabular-nums">
              {report.forecast != null ? usd(report.forecast) : "–"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              AWS forecast (လကုန်အထိ)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">အမှန်တကယ် ပေးရမည့်ငွေ</p>
            <p className="text-xl font-bold tabular-nums">
              {usd(report.netPayable)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              credit ${report.credits.toFixed(0)} ခုနှိမ်ပြီး
            </p>
          </CardContent>
        </Card>
      </div>

      {report.credits > 0 ? (
        <div className="space-y-1 rounded-xl border-2 border-amber-500 bg-amber-500/10 p-3 text-sm">
          <p className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400">
            <TriangleAlert className="h-4 w-4" /> Credit က တကယ့်ကုန်ကျစရိတ်ကို
            ဖုံးထားပါသည်
          </p>
          <p className="leading-relaxed">
            ဤလ တကယ်သုံးထားသည်မှာ{" "}
            <strong className="tabular-nums">{usd(report.monthToDate)}</strong>{" "}
            ဖြစ်ပြီး AWS credit{" "}
            <strong className="tabular-nums">{usd(report.credits)}</strong> က
            ခုနှိမ်ပေးထားသဖြင့် ယခု{" "}
            <strong className="tabular-nums">{usd(report.netPayable)}</strong>{" "}
            သာ ပေးနေရပါသည်။{" "}
            <strong>
              Credit ကုန်သည့်နေ့တွင် ငွေတောင်းခံလွှာသည်{" "}
              {report.previousMonth > 0
                ? `တစ်လလျှင် ${usd(report.monthToDate)} ခန့်သို့ `
                : ""}
              ရုတ်တရက် တက်လာပါလိမ့်မည်။
            </strong>{" "}
            ကျန်ရှိသော credit နှင့် သက်တမ်းကုန်ရက်ကို AWS console → Billing →
            Credits တွင် ကြည့်ပါ။
          </p>
          <p className="text-xs text-muted-foreground">
            အောက်ပါ ဇယားသည် <strong>credit မခုနှိမ်မီ</strong> တကယ့်သုံးစွဲမှု
            ဖြစ်သည် — ဘယ်ဝန်ဆောင်မှုက တကယ် ငွေကုန်နေလဲ သိရန် ဤဂဏန်းကသာ
            အသုံးဝင်ပါသည်။
          </p>
        </div>
      ) : null}

      {report.daily.length > 0 ? (
        <Card>
          <CardContent className="p-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              နေ့စဉ် ကုန်ကျစရိတ် (နောက်ဆုံး ရက် ၃၀)
            </p>
            {/* Bars, not a line: daily AWS spend is a set of discrete
                buckets, and a spike day is the thing worth spotting. */}
            <div className="flex h-24 items-end gap-[2px]">
              {report.daily.map((d) => (
                <div
                  key={d.date}
                  title={`${d.date} · ${usd(d.amount)}`}
                  className="flex-1 rounded-t bg-primary/70 transition-colors hover:bg-primary"
                  style={{
                    height: `${Math.max((d.amount / maxDay) * 100, 2)}%`,
                  }}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>{report.daily[0]?.date}</span>
              <span>အမြင့်ဆုံး {usd(maxDay)}</span>
              <span>{report.daily[report.daily.length - 1]?.date}</span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold">
          ဝန်ဆောင်မှုအလိုက် — ဘာကြောင့် ကျသင့်သလဲ
        </h2>
        {report.services.length === 0 ? (
          <p className="rounded-xl border p-4 text-sm text-muted-foreground">
            ဤလအတွက် ကုန်ကျစရိတ် မရှိသေးပါ (သို့) Cost Explorer မဖတ်နိုင်သေးပါ။
          </p>
        ) : (
          report.services.map((s) => {
            const note = costNote(s.service);
            const share = (s.amount / Math.max(report.monthToDate, 0.01)) * 100;
            const change =
              s.previous > 0
                ? ((s.amount - s.previous) / s.previous) * 100
                : null;
            return (
              <details key={s.service} className="rounded-xl border">
                <summary className="cursor-pointer list-none px-3 py-2">
                  <span className="flex items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {s.service}
                      </span>
                      <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{
                            width: `${Math.max((s.amount / maxService) * 100, 1)}%`,
                          }}
                        />
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-bold tabular-nums">
                        {usd(s.amount)}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {share.toFixed(0)}%
                        {change != null ? (
                          <span
                            className={
                              change >= 0
                                ? " text-red-600"
                                : " text-emerald-600"
                            }
                          >
                            {" "}
                            {change >= 0 ? "+" : ""}
                            {change.toFixed(0)}%
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </span>
                </summary>
                <div className="space-y-1.5 border-t px-3 py-2 text-xs leading-relaxed">
                  {note ? (
                    <>
                      <p>
                        <strong>ဘာအတွက်လဲ — </strong>
                        {note.what}
                      </p>
                      <p>
                        <strong>ဘယ်လို တွက်လဲ — </strong>
                        {note.billedFor}
                      </p>
                      <p className="text-muted-foreground">
                        <strong>လျှော့ချနည်း — </strong>
                        {note.lever}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      ဤဝန်ဆောင်မှုအတွက် ရှင်းလင်းချက် မထည့်ရသေးပါ။ AWS console
                      → Billing → Cost Explorer တွင် usage type အလိုက်
                      ခွဲကြည့်နိုင်ပါသည်။
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    ပြီးခဲ့သောလ: {usd(s.previous)}
                  </p>
                </div>
              </details>
            );
          })
        )}
      </section>

      <div className="rounded-xl border p-3 text-[11px] leading-relaxed text-muted-foreground">
        <p>
          <strong>ဤစာမျက်နှာကိုယ်တိုင် ငွေကုန်ပါသည်။</strong> AWS Cost Explorer
          API သည် တစ်ခေါ်လျှင် $0.01 ကျသင့်သည်။ ထို့ကြောင့် အချက်အလက်များကို ၆
          နာရီ cache လုပ်ထားပြီး၊ တစ်ကြိမ် refresh လျှင် ခေါ်ဆိုမှု ၄ ခု (≈
          $0.04) သာ ဖြစ်ပါသည်။ လိုအပ်မှသာ refresh နှိပ်ပါ။
        </p>
        <p className="mt-1">
          ကိန်းဂဏန်းများသည် unblended cost ဖြစ်ပြီး credit/refund များ
          အပြည့်အဝ မပါဝင်နိုင်ပါ။ တရားဝင် ငွေတောင်းခံလွှာအတွက် AWS console →
          Billing → Bills ကို ကြည့်ပါ။
        </p>
      </div>
    </div>
  );
}
