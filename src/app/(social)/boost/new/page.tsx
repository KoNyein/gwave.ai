import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Wallet } from "lucide-react";

import { BoostCreateForm } from "@/components/boost/boost-create-form";
import { getCurrentProfile } from "@/lib/auth";
import { getBoostableTargets } from "@/lib/db/boosts";
import { getMyGpayAccount } from "@/lib/db/gpay";
import type { BoostTarget } from "@/types/database";

export const metadata = { title: "Create boost" };
export const dynamic = "force-dynamic";

const VALID_TYPES: BoostTarget[] = ["post", "shop_product", "pos_product"];

export default async function NewBoostPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; id?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { type, id } = await searchParams;
  const [targets, account] = await Promise.all([
    getBoostableTargets(),
    getMyGpayAccount(),
  ]);

  const prefillType =
    type && VALID_TYPES.includes(type as BoostTarget)
      ? (type as BoostTarget)
      : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/boost"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> ကြော်ငြာများ
      </Link>

      {account && account.status === "active" ? (
        <BoostCreateForm
          targets={targets}
          balance={Number(account.balance ?? 0)}
          prefill={{ type: prefillType, id: id ?? null }}
        />
      ) : (
        <div className="rounded-xl border bg-card p-6 text-center">
          <Wallet className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            ကြော်ငြာ တွန်းတင်ရန် <b>active G-Pay account</b> လိုအပ်ပါသည်။
          </p>
          <Link
            href="/gpay"
            className="mt-3 inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Wallet className="h-4 w-4" /> G-Pay ဖွင့်ရန်
          </Link>
        </div>
      )}
    </div>
  );
}
