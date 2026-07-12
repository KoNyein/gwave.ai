import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Truck } from "lucide-react";

import { getCurrentProfile } from "@/lib/auth";

export const metadata = { title: "Dropship guide" };

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h2 className="mb-2 font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-6 text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border px-4 py-3">
      <summary className="cursor-pointer list-none text-sm font-medium">
        <span className="mr-2 text-primary group-open:hidden">＋</span>
        <span className="mr-2 hidden text-primary group-open:inline">－</span>
        {q}
      </summary>
      <div className="mt-2 text-sm leading-6 text-muted-foreground">
        {children}
      </div>
    </details>
  );
}

/** In-depth Burmese walkthrough of the dropship workflow. */
export default async function DropshipGuidePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8">
      <Link
        href="/shop/guide"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> လမ်းညွှန် ပင်မ
      </Link>

      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Truck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold">🚚 Dropship — အသေးစိတ် လမ်းညွှန်</h1>
          <p className="text-sm text-muted-foreground">
            ပစ္စည်း မကိုင်ဘဲ ရောင်းပြီး margin ရယူနည်း — အစအဆုံး
          </p>
        </div>
      </div>

      <Section title="၁။ Dropship ဆိုတာ ဘာလဲ — ဘယ်လို အမြတ်ရလဲ">
        <p>
          Dropship ဆိုတာ — ကုန်ပစ္စည်းကို <b>ကိုယ်တိုင် ဝယ်သိုလှောင်စရာ မလိုဘဲ</b>{" "}
          ရောင်းတဲ့ နည်းလမ်းပါ။ ဖောက်သည် order တင်မှသာ supplier (ကုန်သည်ကြီး/
          စက်ရုံ/တရုတ်ဈေးကွက်) ဆီက ဝယ်ပြီး ဖောက်သည်ဆီ တိုက်ရိုက် ပို့ခိုင်းပါတယ်။
        </p>
        <p className="rounded-lg bg-muted p-3">
          <b>ဥပမာ တွက်နည်း:</b> Supplier ဈေး ၁၅,၀၀၀ ကျပ် + ပို့ခ ၃,၀၀၀ ကျပ် ={" "}
          <b>ကုန်ကျ ၁၈,၀၀၀ ကျပ်</b>။ သင့် shop မှာ <b>၂၅,၀၀၀ ကျပ်</b> နဲ့ တင်ရောင်းရင် —
          order တစ်ခုကို <b>အမြတ် ၇,၀၀၀ ကျပ်</b> ရပါတယ်။ ပုံမှန်အားဖြင့် ကုန်ကျစရိတ်ရဲ့{" "}
          <b>30–50%</b> လောက် margin တင်လေ့ရှိပါတယ်။
        </p>
      </Section>

      <Section title="၂။ မစတင်ခင် ပြင်ဆင်စရာ">
        <p>
          <b>(က) Supplier ရွေးပါ</b> — အချိန်မီ ပို့နိုင်တဲ့၊ ပစ္စည်းအရည်အသွေး မှန်တဲ့
          supplier ကို အရင် စမ်းဝယ်ကြည့်ပြီးမှ ချိတ်ပါ။ ပြည်တွင်း ကုန်သည်ကြီး၊
          လက်ကား ဈေးကွက်၊ online supplier — ဘယ်သူမဆို ရပါတယ်။
        </p>
        <p>
          <b>(ခ) ဈေး တွက်ပါ</b> — supplier ဈေး + ပို့ခ + မမျှော်လင့်စရိတ် (ပစ္စည်းပြန်၊
          ပျက်စီး ~5%) အားလုံးပေါင်းပြီးမှ margin တင်ပါ။ ဈေးနှုန်း ကွက်တိ တင်ပါ —
          နောက်မှ ဈေးတိုးရင် ဖောက်သည် ယုံကြည်မှု ကျပါတယ်။
        </p>
        <p>
          <b>(ဂ) ပို့ဆောင်ချိန် သိထားပါ</b> — supplier က ဘယ်နှရက်နဲ့ ပို့နိုင်လဲ မေးထားပြီး
          listing မှာ ရိုးသားစွာ ရေးပါ (ဥပမာ “၃–၅ ရက်အတွင်း အရောက်ပို့”)။
        </p>
      </Section>

      <Section title="၃။ ကုန်ပစ္စည်း တင်နည်း (listing)">
        <p>
          <Link href="/shop/sell" className="text-primary underline">Shop → တင်ရန်</Link>{" "}
          မှာ အမျိုးအစား <b>Dropship</b> ရွေးပြီး —
        </p>
        <p>• <b>ခေါင်းစဉ်</b> — ရှာလို့လွယ်အောင် ပစ္စည်းနာမည် + အရွယ်/အရောင် ထည့်ပါ</p>
        <p>• <b>ဓာတ်ပုံ</b> — ကြည်လင်တဲ့ ပုံ ၃–၅ ပုံ (supplier ပုံ သုံးရင် အရည်အသွေး စစ်ပြီးမှ)</p>
        <p>• <b>ဈေးနှုန်း</b> — ဖောက်သည် ပေးရမယ့် စုစုပေါင်းဈေး (ပို့ခ ပါ/မပါ ရှင်းရှင်းရေး)</p>
        <p>• <b>ဖော်ပြချက်</b> — အရွယ်အစား၊ material၊ ပို့ဆောင်ချိန်၊ လဲလှယ်မူဝါဒ</p>
        <p>• <b>Source link</b> (ရွေးချယ်) — supplier link၊ ကိုယ့်မှတ်တမ်းအတွက်သာ၊ ဖောက်သည် မမြင်ရပါ</p>
      </Section>

      <Section title="၄။ Order ရလာရင် — အဆင့်လိုက် workflow">
        <p>
          <b>① Pending (စောင့်ဆိုင်း)</b> — ဖောက်သည် order တင်တာနဲ့{" "}
          <Link href="/shop/sales" className="text-primary underline">ရရှိသော order များ</Link>{" "}
          မှာ ပေါ်လာပြီး notification ရပါမယ်။ <b>၂၄ နာရီအတွင်း</b> ဆောင်ရွက်ပါ။
        </p>
        <p>
          <b>② Forwarded (supplier သို့ ပို့ပြီး)</b> — supplier ဆီ order တင်ပြီး
          ဖောက်သည်ရဲ့ နာမည်/ဖုန်း/လိပ်စာ ပေးပါ။ ပြီးရင် status ပြောင်းပါ —
          ဖောက်သည်ဘက်မှာ timeline တက်သွားပါမယ်။
        </p>
        <p>
          <b>③ Shipped (ပို့ဆောင်နေ)</b> — ပစ္စည်း ထွက်သွားတာနဲ့ ပြောင်းပါ။
          Tracking နံပါတ် ရရင် ဖောက်သည်ကို messenger နဲ့ ပို့ပေးပါ။
        </p>
        <p>
          <b>④ Delivered (အရောက်ပို့ပြီး)</b> — ဖောက်သည် လက်ခံရရှိကြောင်း သေချာမှ
          ပြောင်းပါ။ <b>ဒီအဆင့်ရောက်မှ ဝင်ငွေဇယားမှာ ရောင်းရငွေ တွက်ပါတယ်</b>။
          ဖောက်သည်ဆီ push notification လည်း အလိုအလျောက် သွားပါတယ်။
        </p>
      </Section>

      <Section title="၅။ ငွေကြေး စီမံနည်း">
        <p>
          gwave.ai က order ချိတ်ဆက်မှုသာ လုပ်ပေးပြီး — <b>ငွေကောက်ခံမှုက
          သင်နဲ့ ဖောက်သည်ကြား တိုက်ရိုက်</b> ဖြစ်ပါတယ် (COD၊ KPay/WavePay ကြိုလွှဲ၊
          G-Pay စသဖြင့်)။ အကြံပြုချက် —
        </p>
        <p>• ပစ္စည်းတန်ဖိုးများရင် <b>စရံ (deposit)</b> အနည်းဆုံး ၅၀% ကြိုတောင်းပါ</p>
        <p>• Supplier ကို ပေးချေတဲ့ ပြေစာ/screenshot များ သိမ်းထားပါ — အငြင်းပွားရင် အထောက်ထား</p>
        <p>
          •{" "}
          <Link href="/shop/dashboard" className="text-primary underline">
            Dashboard
          </Link>{" "}
          မှာ ရောင်းရငွေ၊ order အရေအတွက်၊ ပစ္စည်းအလိုက် စာရင်း ကြည့်နိုင်ပါတယ်
        </p>
      </Section>

      <div className="space-y-2">
        <h2 className="font-semibold">❓ မကြာခဏ မေးလေ့ရှိသော မေးခွန်းများ</h2>
        <Faq q="Supplier က ပစ္စည်း မပို့ / နောက်ကျရင် ဘာလုပ်မလဲ?">
          <p>
            ဖောက်သည်ကို ချက်ချင်း အကြောင်းကြားပြီး ရက်ရွှေ့ခွင့် တောင်းပါ။ supplier
            လုံးဝ မပို့နိုင်တော့ရင် ငွေအပြည့် ပြန်အမ်းပါ — ယုံကြည်မှုက ရေရှည်စီးပွားရေးရဲ့
            အဓိကပါ။ ဒီလို supplier ကို နောက်တစ်ခါ မသုံးပါနဲ့။
          </p>
        </Faq>
        <Faq q="ဖောက်သည်က ပစ္စည်း ပြန်လဲချင်ရင်?">
          <p>
            Listing မှာ လဲလှယ်မူဝါဒ ကြိုရေးထားပါ (ဥပမာ “ပစ္စည်းချို့ယွင်းမှသာ ၃ ရက်အတွင်း
            လဲပေးမည်”)။ ချို့ယွင်းချက် အစစ်ဆို supplier နဲ့ ညှိပြီး လဲပေး/ငွေပြန်အမ်းပါ။
          </p>
        </Faq>
        <Faq q="ဈေး ဘယ်လောက် တင်သင့်လဲ?">
          <p>
            စျေးကွက်ထဲက တူညီပစ္စည်းတွေရဲ့ ဈေးကို အရင်ကြည့်ပါ။ ကုန်ကျစရိတ် အားလုံးပေါင်း
            + 30–50% က စမှတ်ကောင်းပါ။ ဈေးအရမ်းတင်ရင် ရောင်းမထွက်၊ အရမ်းချရင်
            ပြဿနာတက်ချိန် အရှုံးခံရနိုင်ပါတယ်။
          </p>
        </Faq>
        <Faq q="Order များလာရင် ဘယ်လို စီမံမလဲ?">
          <p>
            နေ့တိုင်း သတ်မှတ်ချိန် ၂ ကြိမ် (မနက်/ည){" "}
            <Link href="/shop/sales" className="text-primary underline">order စာရင်း</Link>{" "}
            စစ်ပြီး status တွေ update လုပ်ပါ။ ပစ္စည်း ရောင်းအားကောင်းလာရင် 🚀{" "}
            <Link href="/boost" className="text-primary underline">Boost</Link> နဲ့
            ထပ်တွန်းနိုင်ပါတယ်။
          </p>
        </Faq>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted-foreground">
        ⚠️ <b>သတိ:</b> ဈေးနှုန်း/ပို့ချိန်ကို မှန်ကန်စွာ ဖော်ပြပါ။ လှည့်စားမှု တိုင်ကြားခံရရင်
        listing/account ပိတ်ခံရနိုင်ပါတယ်။ တားမြစ်ပစ္စည်းများ ရောင်းချခြင်း လုံးဝ တားမြစ်ပါတယ်။
      </div>

      <Link
        href="/shop/sell"
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        <Truck className="h-4 w-4" /> Dropship ပစ္စည်း စတင်တင်ရန်
      </Link>
    </div>
  );
}
