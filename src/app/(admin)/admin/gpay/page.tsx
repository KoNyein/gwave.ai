import { Banknote, Users, Wallet } from "lucide-react";

import { GpayLedger } from "@/components/admin/gpay-ledger";
import { WagerDisputes } from "@/components/admin/wager-disputes";
import { getAllGpayAccounts, getAllGpayTransactions } from "@/lib/db/gpay";
import { getDisputedWagersWithPlayers } from "@/lib/db/wagers";

export const metadata = { title: "G-Pay ledger" };
export const dynamic = "force-dynamic";

function mmk(n: number): string {
  return `${Math.round(n).toLocaleString("en-US")} Ks`;
}

export default async function AdminGpayPage() {
  const [accounts, transactions, disputes] = await Promise.all([
    getAllGpayAccounts(),
    getAllGpayTransactions(500),
    getDisputedWagersWithPlayers(),
  ]);

  const active = accounts.filter((a) => a.status === "active").length;
  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance ?? 0), 0);

  const cards = [
    { icon: <Users className="h-4 w-4" />, label: "Account", value: String(accounts.length), hint: `${active} active` },
    { icon: <Wallet className="h-4 w-4" />, label: "စုစုပေါင်း လက်ကျန်", value: mmk(totalBalance) },
    { icon: <Banknote className="h-4 w-4" />, label: "မှတ်တမ်း (နောက်ဆုံး)", value: transactions.length.toLocaleString("en-US") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Wallet className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold">💳 G-Pay — ငွေလွှဲ မှတ်တမ်း</h1>
          <p className="text-sm text-muted-foreground">
            user များ၏ ငွေကြေး လှုပ်ရှားမှု အသေးစိတ် (admin)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {c.icon}
              <span>{c.label}</span>
            </div>
            <p className="mt-1 text-xl font-bold">{c.value}</p>
            {c.hint ? <p className="text-[11px] text-muted-foreground">{c.hint}</p> : null}
          </div>
        ))}
      </div>

      <WagerDisputes wagers={disputes} />

      <GpayLedger transactions={transactions} />
    </div>
  );
}
