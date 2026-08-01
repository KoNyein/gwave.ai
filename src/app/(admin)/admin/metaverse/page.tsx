import { Card, CardContent } from "@/components/ui/card";
import { BuildReportActions } from "@/components/metaverse/build/report-actions";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/data/admin";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Metaverse moderation" };
export const dynamic = "force-dynamic";

/// ဆောက်လုပ်မှု တိုင်ကြားချက် queue (Phase 18.1)。
///
/// ★ User ကို content ဖန်တီးခွင့် ပေးတာနဲ့ moderation တာဝန် ပါလာတယ်။
///   ဒီစာမျက်နှာက အဲဒီတာဝန်ရဲ့ တစ်ဝက် — ကျန်တစ်ဝက်က လောကထဲက
///   "🚩 တိုင်ကြားမယ်" ခလုတ်ပါ။
/// ★ Spec က **၂၄ နာရီအတွင်း စစ်နိုင်ရမယ်** လို့ ဆိုတယ် — ဒါကြောင့်
///   ကြာနေတဲ့ report တွေကို အပေါ်မှာ အနီရောင်နဲ့ ပြတယ်။

type ReportRow = {
  id: number;
  plot_id: number;
  reporter: string;
  reason: string | null;
  created_at: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function AdminMetaversePage() {
  await requireRole("admin");

  const admin = createAdminClient();
  const { data } = await admin
    .from("mv_build_reports")
    .select("id, plot_id, reporter, reason, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(100);

  const reports = (data ?? []) as ReportRow[];

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">🏗 Metaverse ဆောက်လုပ်မှု တိုင်ကြားချက်များ</h1>
      <p className="text-sm text-muted-foreground">
        ဖျက်လိုက်ရင် အဲဒီကွက်ရဲ့ ဆောက်လုပ်မှု (build_data) ကိုသာ ဖျက်ပါတယ် —
        ကွက်ကို ပိုင်ရှင်ဆီက မယူပါ။
      </p>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            စောင့်ဆိုင်းနေတဲ့ တိုင်ကြားချက် မရှိပါ။
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => {
            const age = Date.now() - new Date(r.created_at).getTime();
            return (
              <Card key={r.id}>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      ကွက် #{r.plot_id}
                      {age > DAY_MS && (
                        // ★ ၂၄ နာရီ ကျော်သွားပြီ — spec ရဲ့ ကတိကို
                        // ချိုးဖောက်နေပြီ ဆိုတာ မြင်သာအောင်
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-800">
                          ၂၄ နာရီ ကျော်ပြီ
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {timeAgo(r.created_at)}
                      {r.reason ? ` · ${r.reason}` : ""}
                    </div>
                  </div>
                  <BuildReportActions plotId={r.plot_id} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
