import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Help & Guide" };

/** One Q/A row of the guide. */
function Item({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border px-4 py-3">
      <summary className="cursor-pointer list-none font-medium marker:hidden">
        <span className="mr-2 text-primary group-open:hidden">＋</span>
        <span className="mr-2 hidden text-primary group-open:inline">－</span>
        {q}
      </summary>
      <div className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
        {children}
      </div>
    </details>
  );
}

/**
 * Burmese-first user guide. Public — reachable logged-out so people locked
 * out of their account can still read the recovery steps.
 */
export default function HelpPage() {
  return (
    <div className="space-y-4 pb-8">
      <h1 className="text-xl font-bold">📖 အကူအညီနှင့် လမ်းညွှန် (Help &amp; Guide)</h1>
      <p className="text-sm text-muted-foreground">
        Gwave သုံးရာမှာ အခက်ခဲရှိရင် ဒီစာမျက်နှာက အဆင့်လိုက် ဖြေရှင်းနည်းများ။
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">🔑 အကောင့်နှင့် စကားဝှက်</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Item q="အကောင့် အသစ် ဘယ်လိုဖွင့်မလဲ?">
            <p>
              <Link href="/register" className="text-primary underline">စာရင်းသွင်းရန်</Link>{" "}
              စာမျက်နှာမှာ email နဲ့ စကားဝှက် (အနည်းဆုံး ၆ လုံး) ထည့်ပါ —
              ဒါမှမဟုတ် <b>Google နဲ့ ဆက်လုပ်ရန်</b> ခလုတ်နဲ့ တစ်ချက်တည်း ဖွင့်နိုင်ပါတယ်။
              ပြီးရင် နာမည်နဲ့ username ရွေးတဲ့ အဆင့် ဆက်သွားပါမယ်။
            </p>
          </Item>
          <Item q="စကားဝှက် မေ့သွားရင် ဘယ်လို ပြန်ရမလဲ?">
            <p>
              ၁။ Login စာမျက်နှာက <b>“စကားဝှက် မေ့နေပါသလား?”</b> ကို နှိပ်ပါ (ဒါမှမဟုတ်{" "}
              <Link href="/forgot-password" className="text-primary underline">ဒီမှာ</Link>)။
            </p>
            <p>၂။ အကောင့်ဖွင့်ထားတဲ့ email ရိုက်ထည့်ပြီး <b>Reset link ပို့မည်</b> နှိပ်ပါ။</p>
            <p>၃။ Email ထဲရောက်လာတဲ့ link ကို နှိပ်ပြီး စကားဝှက်အသစ် ၂ ခါရိုက် သတ်မှတ်ပါ။</p>
            <p>
              ⏳ <b>Email မရောက်ရင်</b> — (က) <b>Spam/Junk folder</b> စစ်ပါ၊
              (ခ) ၅ မိနစ်လောက် စောင့်ပါ၊ (ဂ) ရိုက်ထည့်တဲ့ email က အကောင့်ဖွင့်တုန်းက
              email ဟုတ်/မဟုတ် ပြန်စစ်ပါ၊ (ဃ) ဒါတွေအကုန်လုပ်လည်း မရရင် အောက်က
              “ဆက်သွယ်ရန်” အတိုင်း admin ကို အကြောင်းကြားပါ။
            </p>
          </Item>
          <Item q="Login ဝင်ထားရင်း စကားဝှက် ပြောင်းချင်ရင်?">
            <p>
              <Link href="/settings" className="text-primary underline">Settings</Link> →{" "}
              <b>🔐 Security</b> မှာ စကားဝှက်အသစ် ၂ ခါရိုက်ပြီး ပြောင်းနိုင်ပါတယ် —
              စကားဝှက်အဟောင်း မလိုပါ။
            </p>
          </Item>
          <Item q="Google နဲ့ ဝင်လို့ မရဖြစ်နေရင်?">
            <p>
              Browser ရဲ့ popup ပိတ်ထားတာ ဖြစ်နိုင်ပါတယ် — popup ခွင့်ပြုပြီး ပြန်စမ်းပါ။
              ဒါမှမဟုတ် email/စကားဝှက်နဲ့ ဝင်ပြီး Settings မှာ စကားဝှက် သတ်မှတ်ထားနိုင်ပါတယ်။
            </p>
          </Item>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">📝 Post နှင့် ဓာတ်ပုံ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Item q="Post ဘယ်လိုတင်မလဲ?">
            <p>
              Feed ထိပ်က <b>“ဘာတွေ စိတ်ကူးနေလဲ…”</b> အကွက်ကို နှိပ်ပြီး စာရေး၊
              ဓာတ်ပုံ (၁၀ ပုံအထိ) / video (၁ ခု) ထည့်၊ မြင်နိုင်သူ (အများ/မိတ်ဆွေ/ကိုယ်တိုင်)
              ရွေးပြီး <b>တင်မည်</b> နှိပ်ပါ။ တည်နေရာ check-in လည်း ထည့်လို့ရပါတယ်။
            </p>
          </Item>
          <Item q="ဓာတ်ပုံ တင်လို့ မရရင်?">
            <p>
              ပုံဆိုရင် အလိုအလျောက် ချုံ့ပေးလို့ အရွယ်အစား ပူစရာမလိုပါ။ Video ကတော့
              100 MB အောက် ဖြစ်ရပါမယ်။ Error စာသား ပေါ်ရင် — internet ပြန်စစ်ပြီး
              ထပ်စမ်းပါ၊ ဆက်မရရင် screenshot နဲ့ admin ကို ပို့ပေးပါ။
            </p>
          </Item>
          <Item q="Post ပြင်/ဖျက် ချင်ရင်?">
            <p>
              Post ရဲ့ ညာဘက်အပေါ် <b>⋯</b> ကို နှိပ်ပြီး ပြင်ရန်/ဖျက်ရန် ရွေးပါ —
              ကိုယ့် post ကိုသာ ပြင်/ဖျက် လို့ရပါတယ်။
            </p>
          </Item>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">📱 ဖုန်းမှာ App အနေနဲ့ သုံးရန်</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Item q="Home screen မှာ app အဖြစ် ထည့်နည်း (Android)">
            <p>
              Chrome နဲ့ site ဖွင့် → ညာဘက်အပေါ် <b>⋮</b> → <b>“Add to Home screen”</b> /
              <b>“Install app”</b> နှိပ်ပါ။ App icon ရောက်လာပြီး app လိုပဲ ဖွင့်သုံးလို့ရပါတယ်။
            </p>
          </Item>
          <Item q="iPhone မှာ ထည့်နည်း">
            <p>
              Safari နဲ့ ဖွင့် → အောက်က <b>Share</b> (⬆️) → <b>“Add to Home Screen”</b> နှိပ်ပါ။
            </p>
          </Item>
          <Item q="Notification (အသိပေးချက်) ဖွင့်နည်း">
            <p>
              <Link href="/settings" className="text-primary underline">Settings</Link> →
              🔔 Notifications → <b>ဖွင့်မည်</b> နှိပ်ပြီး browser က ခွင့်တောင်းရင် <b>Allow</b> ပေးပါ။
            </p>
          </Item>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">🛠 ပြဿနာ ဖြေရှင်းနည်း အထွေထွေ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Item q="စာမျက်နှာ မှားပြ/ဟောင်းနေရင် (update မမြင်ရရင်)">
            <p>
              <b>Hard refresh</b> လုပ်ပါ — ကွန်ပျူတာ: <b>Ctrl + Shift + R</b>။
              ဖုန်း: app/browser ကို လုံးဝပိတ်ပြီး ပြန်ဖွင့်ပါ။ ဆက်မရရင် browser ရဲ့
              Site settings → <b>Clear data</b> လုပ်ပြီး ပြန်ဝင်ပါ။
            </p>
          </Item>
          <Item q="Feed / စာမျက်နှာ error ပြနေရင်">
            <p>
              အင်တာနက် စစ်ပြီး refresh လုပ်ပါ။ ဆက်ဖြစ်နေရင် — ဘာလုပ်နေတုန်း
              ဘာ error ပေါ်လဲ screenshot ရိုက်ပြီး admin ကို ပို့ပေးပါ၊ အမြန်ဆုံး ပြင်ပေးပါမယ်။
            </p>
          </Item>
          <Item q="မသင့်တော်တဲ့ post/user ကို တိုင်ကြားချင်ရင်">
            <p>
              Post ရဲ့ <b>⋯</b> → <b>Report</b> ကို သုံးပါ။ Admin တွေ စစ်ဆေးပြီး
              လိုအပ်သလို ဆောင်ရွက်ပါမယ်။ မမြင်ချင်တဲ့သူဆို profile မှာ <b>Block</b> လုပ်နိုင်ပါတယ်။
            </p>
          </Item>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">💬 ဆက်သွယ်ရန်</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-6 text-muted-foreground">
          <p>
            ဒီလမ်းညွှန်နဲ့ မဖြေရှင်းနိုင်တဲ့ ပြဿနာရှိရင် —{" "}
            <a href="mailto:hello@gwave.ai" className="text-primary underline">
              hello@gwave.ai
            </a>{" "}
            ကို email ပို့ပါ ဒါမှမဟုတ် app ထဲက Messenger နဲ့ admin (Ko Nyein) ကို
            တိုက်ရိုက် စာပို့ပါ။ ဖြစ်နေတဲ့ ပြဿနာရဲ့ <b>screenshot</b> ပါ တွဲပို့ပေးရင်
            ပိုမြန်မြန် ကူညီပေးနိုင်ပါတယ်။
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
