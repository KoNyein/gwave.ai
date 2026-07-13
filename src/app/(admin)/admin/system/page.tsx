import { AlertTriangle, CheckCircle2, Database, XCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { getSystemStatus, probeDatabase } from "@/lib/system-status";

export const dynamic = "force-dynamic";

export const metadata = { title: "System Status" };

export default async function AdminSystemPage() {
  const [groups, database] = await Promise.all([
    Promise.resolve(getSystemStatus()),
    probeDatabase(),
  ]);
  const configured = groups.filter((g) => g.configured).length;
  const criticalMissing = groups.filter((g) => g.critical && !g.configured);

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-bold">System Status · စနစ်အခြေအနေ</h1>
        <p className="text-sm text-muted-foreground">
          Integration တစ်ခုချင်း သတ်မှတ်ပြီး/မပြီး ဒီမှာ ကြည့်ပါ။ secret တန်ဖိုးများ
          ကို <strong>မပြပါ</strong> — ရှိ/မရှိ သာ စစ်တာပါ။
        </p>
      </div>

      {/* Overview */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Integrations</p>
            <p className="text-2xl font-bold">
              {configured}/{groups.length}
            </p>
            <p className="text-[11px] text-muted-foreground">configured</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Database className="h-6 w-6 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Database</p>
              <p
                className={`text-lg font-bold ${
                  database === "ok" ? "text-emerald-600" : "text-destructive"
                }`}
              >
                {database}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={
            criticalMissing.length > 0 ? "border-destructive" : undefined
          }
        >
          <CardContent className="flex items-center gap-3 p-4">
            {criticalMissing.length > 0 ? (
              <AlertTriangle className="h-6 w-6 text-destructive" />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            )}
            <div>
              <p className="text-sm text-muted-foreground">Critical</p>
              <p className="text-lg font-bold">
                {criticalMissing.length > 0
                  ? `${criticalMissing.length} missing`
                  : "all set"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-integration checks */}
      <div className="space-y-3">
        {groups.map((g) => (
          <Card
            key={g.title}
            className={
              !g.configured && g.critical ? "border-destructive" : undefined
            }
          >
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    {g.configured ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    {g.title}
                    {g.critical ? (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                        critical
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">{g.enables}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    g.configured
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {g.configured ? "🟢 ready" : "🔴 setup needed"}
                </span>
              </div>

              {g.missing.length > 0 ? (
                <div className="rounded-lg bg-muted p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    ထည့်ရန် လိုအပ်သော env var:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.missing.map((name) => (
                      <code
                        key={name}
                        className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive"
                      >
                        {name}
                      </code>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {g.vars.map((v) => (
                    <code
                      key={v}
                      className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-[11px]"
                    >
                      {v}
                    </code>
                  ))}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="px-1 text-xs text-muted-foreground">
        env var တွေကို AWS server <code>.env</code> မှာ ထည့်ပြီး{" "}
        <code>bash deploy/server-deploy.sh</code> နဲ့ redeploy လုပ်ပါ။
        <code>NEXT_PUBLIC_*</code> ပြင်ရင် rebuild လိုပါတယ်။
      </p>
    </div>
  );
}
