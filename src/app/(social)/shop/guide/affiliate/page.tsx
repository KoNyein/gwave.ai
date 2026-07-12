import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Link2 } from "lucide-react";

import { getCurrentProfile } from "@/lib/auth";

export const metadata = { title: "Affiliate guide" };

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

/** In-depth Burmese walkthrough of affiliate marketing on gwave. */
export default async function AffiliateGuidePage() {
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
          <Link2 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold">🔗 Affiliate — အသေးစိတ် လမ်းညွှန်</h1>
          <p className="text-sm text-muted-foreground">
            Link မျှဝေရုံနဲ့ commission ရယူနည်း — အစအဆုံး
          </p>
        </div>
      </div>

      <Section title="၁။ Affiliate ဆိုတာ ဘာလဲ — ငွေ ဘယ်ကရလဲ">
        <p>
          Affiliate marketing ဆိုတာ — <b>သူများရဲ့ ပစ္စည်းကို ကိုယ့် link နဲ့
          ညွှန်းပေး</b>ပြီး၊ အဲဒီ link ကနေ ဝယ်ယူမှုဖြစ်ရင် merchant (ရောင်းသူ) ဆီက{" "}
          <b>commission (ရာခိုင်နှုန်း)</b> ရတဲ့ နည်းလမ်းပါ။ ပစ္စည်း သိုလှောင်စရာ၊
          ပို့ဆောင်စရာ လုံးဝ မလိုပါ။
        </p>
        <p className="rounded-lg bg-muted p-3">
          <b>ဥပမာ:</b> Commission 8% ပေးတဲ့ ၅၀,၀၀၀ ကျပ်တန် ပစ္စည်း link ကို မျှဝေထားပြီး
          တစ်လကို ၁၀ ယောက် ဝယ်ရင် — ၅၀,၀၀၀ × 8% × ၁၀ = <b>တစ်လ ၄၀,၀၀၀ ကျပ်</b>။
          <br />
          ⚠️ Commission ကို <b>merchant ဘက်က တိုက်ရိုက် ပေး</b>ပါတယ် — gwave.ai က
          click ချိတ်ဆက်ပေး/ရေတွက်ပေးရုံသာ ဖြစ်ပါတယ်။
        </p>
      </Section>

      <Section title="၂။ Affiliate link ဘယ်လိုရမလဲ">
        <p>
          Merchant တွေရဲ့ affiliate program မှာ အရင် အကောင့်ဖွင့်ရပါမယ် —
        </p>
        <p>
          • <b>Shopee / Lazada Affiliate</b> — သူတို့ရဲ့ affiliate portal မှာ
          စာရင်းသွင်း → ပစ္စည်းရွေး → ကိုယ်ပိုင် link ထုတ်
        </p>
        <p>
          • <b>Amazon Associates</b> — နိုင်ငံတကာ ပစ္စည်းများအတွက်
        </p>
        <p>
          • <b>ပြည်တွင်း ဆိုင်/brand များ</b> — တိုက်ရိုက် ညှိနှိုင်းပြီး ကိုယ်ပိုင်
          referral code/link တောင်းလို့ရပါတယ် (ဥပမာ “ဒီ code နဲ့ဝယ်ရင် ကျွန်တော့ကို 5%”)
        </p>
        <p>
          Link ထုတ်ပြီးရင် — အဲဒီ link က <b>သင့် ID ပါတဲ့ link ဟုတ်/မဟုတ်</b> သေချာစစ်ပါ။
          ID မပါရင် commission မရပါ။
        </p>
      </Section>

      <Section title="၃။ gwave မှာ တင်နည်း (listing)">
        <p>
          <Link href="/shop/sell" className="text-primary underline">Shop → တင်ရန်</Link>{" "}
          မှာ အမျိုးအစား <b>Affiliate</b> ရွေးပြီး —
        </p>
        <p>• <b>ခေါင်းစဉ်</b> — ပစ္စည်းနာမည် + ဆွဲဆောင်တဲ့ အချက် (ဥပမာ “လျှော့ဈေး 30%”)</p>
        <p>• <b>ဓာတ်ပုံ</b> — ပစ္စည်းပုံ ကြည်ကြည်လင်လင်</p>
        <p>• <b>Affiliate link</b> — အရေးကြီးဆုံး! သင့် ID ပါတဲ့ URL အပြည့် ထည့်ပါ</p>
        <p>• <b>ဖော်ပြချက်</b> — ဘာကောင်းလဲ၊ ဘယ်သူတွေနဲ့ သင့်တော်လဲ ရိုးသားစွာရေးပါ</p>
        <p>
          ဝယ်သူက “ဝယ်ယူရန်” နှိပ်ရင် — သင့် link သို့ တိုက်ရိုက် ရောက်သွားပြီး{" "}
          <b>click တစ်ခု အလိုအလျောက် မှတ်</b>ပါတယ်။
        </p>
      </Section>

      <Section title="၄။ Click များအောင် မျှဝေနည်း (strategy)">
        <p>
          • <b>Feed မှာ share</b> — ပစ္စည်းစာမျက်နှာက share ခလုတ်နဲ့ ကိုယ့် feed/
          group တွေမှာ မျှဝေပါ။ ကိုယ်တိုင် သုံးဖူးတဲ့ ခံစားချက် ရေးရင် ပိုယုံကြည်ရပါတယ်။
        </p>
        <p>
          • <b>သက်ဆိုင်တဲ့ group တွေမှာ</b> — စိုက်ပျိုးရေးပစ္စည်းဆို စိုက်ပျိုးရေး group၊
          spam မဖြစ်အောင် တန်ဖိုးရှိတဲ့ အကြောင်းအရာနဲ့ တွဲတင်ပါ။
        </p>
        <p>
          • <b>🚀 Boost</b> —{" "}
          <Link href="/boost" className="text-primary underline">Boost</Link> နဲ့
          ကြော်ငြာတွန်းရင် feed ထဲ Sponsored အဖြစ် ပေါ်ပြီး လူများများ မြင်ပါတယ်။
        </p>
        <p>
          • <b>အချိန်ကိုက် တင်</b> — promotion/လျှော့ဈေး ကာလတွေမှာ click အများဆုံး ရပါတယ်။
        </p>
      </Section>

      <Section title="၅။ ရလဒ် စောင့်ကြည့်နည်း">
        <p>
          <Link href="/shop/dashboard" className="text-primary underline">
            Seller Dashboard
          </Link>{" "}
          မှာ ပစ္စည်းတစ်ခုချင်းရဲ့ <b>click အရေအတွက်</b> မြင်ရပါတယ်။ Click များပြီး
          commission နည်းရင် — ပစ္စည်းက ဈေးကြီးလွန်း/စိတ်ဝင်စားစရာ မကောင်းတာ
          ဖြစ်နိုင်လို့ တခြားပစ္စည်း ပြောင်းစမ်းပါ။ Merchant ရဲ့ affiliate portal
          ဘက်မှာတော့ ဝယ်ယူမှုနဲ့ commission အတိအကျ ကြည့်ပါ။
        </p>
      </Section>

      <div className="space-y-2">
        <h2 className="font-semibold">❓ မကြာခဏ မေးလေ့ရှိသော မေးခွန်းများ</h2>
        <Faq q="Click တွေရှိပြီး commission မရဘူး — ဘာလို့လဲ?">
          <p>
            (၁) Link ထဲ သင့် affiliate ID ပါ/မပါ ပြန်စစ်ပါ။ (၂) ဝယ်သူက click နှိပ်ပြီး
            ချက်ချင်း မဝယ်ရင် merchant ရဲ့ cookie သက်တမ်း (ပုံမှန် ၇–၃၀ ရက်) ကျော်သွား
            နိုင်ပါတယ်။ (၃) Click ရှိတိုင်း ဝယ်တာ မဟုတ်ပါ — ပုံမှန် conversion က
            click ၁၀၀ မှာ ၁–၅ ခုလောက်ပါ။
          </p>
        </Faq>
        <Faq q="ကိုယ့် link ကို ကိုယ်တိုင် click နှိပ်လို့ ရလား?">
          <p>
            <b>မရပါ</b> — merchant တွေက self-click/self-purchase ကို fraud အဖြစ်
            သတ်မှတ်ပြီး အကောင့်ပိတ်တတ်ပါတယ်။ gwave စည်းကမ်းအရလည်း တားမြစ်ပါတယ်။
          </p>
        </Faq>
        <Faq q="Link ပျက်သွားရင် / promotion ကုန်သွားရင်?">
          <p>
            Listing ကို ပြင်ပြီး link အသစ် ထည့်ပါ ဒါမှမဟုတ် ဖျက်ပါ။ ပျက်နေတဲ့ link
            ကို ဆက်ထားရင် ဝယ်သူ စိတ်ပျက်ပြီး သင့် listing တွေကို ယုံကြည်မှု ကျပါမယ်။
          </p>
        </Faq>
        <Faq q="ဘယ်ပစ္စည်းမျိုး ရွေးသင့်လဲ?">
          <p>
            ကိုယ့် follower/group တွေ စိတ်ဝင်စားတဲ့ ပစ္စည်း (စိုက်ပျိုးရေး ကိရိယာ၊
            မျိုးစေ့၊ နည်းပညာပစ္စည်း) + commission 5% အထက် + ဝယ်ရလွယ်တဲ့ merchant
            — ဒီ ၃ ချက် ညီရင် အကောင်းဆုံးပါ။ ကိုယ်တိုင် သုံးဖူး/ယုံကြည်တဲ့ ပစ္စည်းဆိုရင်
            ပိုရောင်းရပါတယ်။
          </p>
        </Faq>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted-foreground">
        ⚠️ <b>သတိ:</b> တရားဝင် affiliate link သာ တင်ပါ။ လူတစ်ပါး link ခိုးသုံးခြင်း၊
        self-click လိမ်ခြင်း၊ လှည့်စားကြော်ငြာခြင်း တွေ့ရှိရင် listing/account
        ပိတ်ခံရနိုင်ပါတယ်။
      </div>

      <Link
        href="/shop/sell"
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        <Link2 className="h-4 w-4" /> Affiliate link စတင်တင်ရန်
      </Link>
    </div>
  );
}
