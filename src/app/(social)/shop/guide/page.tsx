import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  ExternalLink,
  Link2,
  PackageCheck,
  ScrollText,
  ShieldAlert,
  Truck,
} from "lucide-react";

import { getCurrentProfile } from "@/lib/auth";

export const metadata = { title: "Shop guide" };

interface Step {
  n: number;
  title: string;
  body: string;
}

const DROPSHIP_STEPS: Step[] = [
  {
    n: 1,
    title: "ကုန်ပစ္စည်း တင်ပါ",
    body: "Shop → “တင်ရန်” → အမျိုးအစား Dropship ကို ရွေးပါ။ ခေါင်းစဉ်၊ ဓာတ်ပုံ၊ ဈေးနှုန်း (ဖောက်သည်ပေးရမည့်ဈေး)၊ ဖော်ပြချက်နဲ့ supplier ရဲ့ source link (ရွေးချယ်) ဖြည့်ပါ။",
  },
  {
    n: 2,
    title: "ဖောက်သည် order တင်သည်",
    body: "ဝယ်သူက ပစ္စည်းစာမျက်နှာမှာ order form ဖြည့်ပြီး ပို့ဆောင်မည့် နာမည်/ဖုန်း/လိပ်စာနဲ့ အတည်ပြုသည်။ Order က “စောင့်ဆိုင်း (pending)” အဖြစ် သင့်ထံ ရောက်လာသည်။",
  },
  {
    n: 3,
    title: "Supplier ကို မှာယူပါ",
    body: "Order ကို supplier ဆီ လက်ဆင့်ကမ်း မှာယူပါ။ ဖောက်သည်ရဲ့ ပို့ဆောင်ရေး အချက်အလက်ကို supplier ထံ ပေးပြီး status ကို “supplier သို့ ပို့ပြီး (forwarded)” သို့ ပြောင်းပါ။",
  },
  {
    n: 4,
    title: "ပို့ဆောင် → အရောက်ပို့",
    body: "ပစ္စည်း ထွက်ခွာသွားရင် “ပို့ဆောင်နေ (shipped)”၊ ဖောက်သည်ထံ ရောက်ရင် “အရောက်ပို့ပြီး (delivered)” လုပ်ပါ။ delivered ဖြစ်မှ ဝင်ငွေ ဇယားမှာ တွက်ပါသည်။",
  },
];

const AFFILIATE_STEPS: Step[] = [
  {
    n: 1,
    title: "Affiliate link တင်ပါ",
    body: "Shop → “တင်ရန်” → အမျိုးအစား Affiliate ကို ရွေးပါ။ ခေါင်းစဉ်၊ ဓာတ်ပုံနဲ့ အရေးကြီးဆုံး — သင့် affiliate/referral link (merchant URL) ကို ထည့်ပါ။",
  },
  {
    n: 2,
    title: "မျှဝေ / boost လုပ်ပါ",
    body: "ပစ္စည်းကို feed မှာ share ပါ (သို့) 🚀 Boost နဲ့ တွန်းတင်ပါ။ လူများများ မြင်လေ click များလေ ဖြစ်သည်။",
  },
  {
    n: 3,
    title: "Click တွေ မှတ်တမ်းတင်",
    body: "အသုံးပြုသူ “ဝယ်ယူရန်” ကို နှိပ်ရင် သင့် affiliate link သို့ သွားပြီး click ကို ရေတွက်သည်။ Dashboard မှာ ပစ္စည်းတစ်ခုချင်း click အရေအတွက် မြင်ရသည်။",
  },
  {
    n: 4,
    title: "Commission က merchant ဆီက",
    body: "ဝယ်ယူမှုအတွက် commission ကို သင် ချိတ်ဆက်ထားတဲ့ merchant/affiliate program ကနေ တိုက်ရိုက် ရသည်။ gwave.ai က click ချိတ်ဆက်ပေးရုံသာ — ငွေ merchant ဘက်က ပေးသည်။",
  },
];

const RULES: string[] = [
  "ကိုယ်ပိုင် (သို့) တရားဝင် ရောင်းချခွင့်ရှိသော ပစ္စည်း/link သာ တင်ပါ။ အတုအယောင်၊ သူတစ်ပါး ပိုင်ဆိုင်မှု ချိုးဖောက်မှု တားမြစ်။",
  "ဈေးနှုန်း၊ ပို့ဆောင်ချိန်နဲ့ ပစ္စည်းအခြေအနေကို မှန်ကန်စွာ ဖော်ပြပါ။ လှည့်စားမှု တွေ့ရှိပါက listing/account ပိတ်နိုင်သည်။",
  "Dropship — ဖောက်သည် order ကို အချိန်မီ supplier ဆီ ပို့ပြီး status ကို မှန်ကန်စွာ update လုပ်ရမည်။",
  "Affiliate — link သည် သင်ပိုင်ဆိုင်သော/တရားဝင် affiliate link ဖြစ်ရမည်။ ကိုယ်တိုင် click နှိပ်၍ commission လိမ်ခြင်း တားမြစ်။",
  "တားမြစ်ပစ္စည်း (တရားမဝင်၊ အန္တရာယ်ရှိ၊ အသက်အရွယ်ကန့်သတ်) များကို စည်းမျဉ်းအလိုက်သာ ရောင်းချရမည်။",
  "ဖောက်သည်နဲ့ အငြင်းပွားမှု ဖြစ်ပါက ရိုးသားစွာ ဖြေရှင်းပါ။ တိုင်ကြားမှုများပါက admin က ဝင်ရောက် စစ်ဆေးနိုင်သည်။",
];

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((s) => (
        <li key={s.n} className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {s.n}
          </span>
          <div>
            <p className="font-medium">{s.title}</p>
            <p className="text-sm text-muted-foreground">{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default async function ShopGuidePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/shop"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Shop
      </Link>

      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ScrollText className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold">📖 Dropship & Affiliate လမ်းညွှန်</h1>
          <p className="text-sm text-muted-foreground">
            ဘယ်လိုအလုပ်လုပ်လဲ၊ ဘယ်လိုစတင်ရမလဲ — အဆင့်ဆင့်
          </p>
        </div>
      </div>

      {/* What is what */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-1 flex items-center gap-1.5 font-semibold">
            <Truck className="h-4 w-4 text-primary" /> Dropship
          </div>
          <p className="text-sm text-muted-foreground">
            ကုန်ပစ္စည်းကို ကိုယ်တိုင် သိုလှောင်စရာမလို — ဖောက်သည် order တင်မှ supplier
            ဆီက တိုက်ရိုက် ပို့ပေးသည်။ သင်က ဈေးကွာဟမှု (margin) ကို ရသည်။
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-1 flex items-center gap-1.5 font-semibold">
            <Link2 className="h-4 w-4 text-primary" /> Affiliate
          </div>
          <p className="text-sm text-muted-foreground">
            ပစ္စည်းကို သင် မရောင်းဘဲ — merchant ရဲ့ link ကို မျှဝေပြီး၊ တစ်ဆင့်ဝင်
            ဝယ်ယူမှုအတွက် commission ရသည်။
          </p>
        </div>
      </div>

      {/* Dropship steps */}
      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-1.5 font-semibold">
          <Truck className="h-4 w-4 text-primary" /> Dropship — အဆင့်ဆင့်
        </h2>
        <StepList steps={DROPSHIP_STEPS} />
        <Link
          href="/shop/guide/dropship"
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          📖 Dropship အသေးစိတ် လမ်းညွှန် (ဈေးတွက်နည်း၊ FAQ) →
        </Link>
      </div>

      {/* Affiliate steps */}
      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-1.5 font-semibold">
          <Link2 className="h-4 w-4 text-primary" /> Affiliate — အဆင့်ဆင့်
        </h2>
        <StepList steps={AFFILIATE_STEPS} />
        <Link
          href="/shop/guide/affiliate"
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          📖 Affiliate အသေးစိတ် လမ်းညွှန် (link ရနည်း၊ FAQ) →
        </Link>
      </div>

      {/* Rules */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <h2 className="mb-2 flex items-center gap-1.5 font-semibold">
          <ShieldAlert className="h-4 w-4 text-amber-600" /> စည်းကမ်းချက် (Rules & Terms)
        </h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          {RULES.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/shop/sell"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <BadgeCheck className="h-4 w-4" /> ကုန်ပစ္စည်း တင်ရန်
        </Link>
        <Link
          href="/shop/dashboard"
          className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted/50"
        >
          <PackageCheck className="h-4 w-4" /> Dashboard
        </Link>
        <Link
          href="/shop/sales"
          className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted/50"
        >
          <ExternalLink className="h-4 w-4" /> ရရှိသော order များ
        </Link>
      </div>
    </div>
  );
}
