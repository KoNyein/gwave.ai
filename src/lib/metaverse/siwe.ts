/// Wallet ချိတ်ဆက်ရာမှာ လက်မှတ်ထိုးရမယ့် စာ (Phase W2)。
///
/// ★ Client နဲ့ server **တစ်လုံးမကျန် တူညီရမယ်** — space တစ်ခု ကွာရုံနဲ့
///   signature က မကိုက်တော့ဘူး။ ဒါကြောင့် ၂ ဘက်စလုံးက ဒီ function
///   တစ်ခုတည်းကို သုံးတယ်၊ တစ်ဘက်စီ ကိုယ့်ဘာသာ မရေးရ။
/// ★ စာထဲမှာ **ဘာလုပ်မှာလဲ** ကို ရှင်းရှင်းရေးထားရမယ် — wallet က ဒီစာကို
///   အတိုင်း ပြတယ်။ နားမလည်တဲ့ hex တစ်တန်းကို sign ခိုင်းတာက user ကို
///   အန္တရာယ်ရှိတဲ့ အလေ့အထ သင်ပေးရာ ရောက်တယ်။
/// ★ **Domain နဲ့ chain မဖြစ်မနေ ပါရမယ်** — မပါရင် တခြား site တစ်ခုက
///   ဒီစာအတိုင်း sign ခိုင်းပြီး ရလာတဲ့ signature ကို gwave မှာ ပြန်သုံးလို့
///   ရသွားမယ် (phishing)。 User က စာကို ဖတ်ရုံနဲ့ ဘယ် site အတွက်လဲ သိရမယ်။

/// Signature တစ်ခုကို ဒီ domain အတွက်သာ အသုံးပြုလို့ရအောင်။
export const SIWE_DOMAIN = "gwave.cc";

/// Base mainnet။ Testnet မှာ စမ်းချင်ရင် `NEXT_PUBLIC_WEB3_CHAIN_ID=84532`。
export const DEFAULT_CHAIN_ID = 8453;

/// ★ Chain id ကို **server ဘက်က ဆုံးဖြတ်တယ်** — client ပို့လာတာကို
///   မယုံရ။ မဟုတ်ရင် attacker က chain id ကို ပြောင်းပြီး တခြားနေရာမှာ
///   ရထားတဲ့ signature ကို ကိုက်အောင် လုပ်လို့ရမယ်။
export function siweChainId(): number {
  const raw = process.env.NEXT_PUBLIC_WEB3_CHAIN_ID;
  const n = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CHAIN_ID;
}

export function siweMessage(params: {
  address: string;
  nonce: string;
  issuedAt: string;
  chainId: number;
}): string {
  return [
    `${SIWE_DOMAIN} သည် သင့်ပိုင်ဆိုင်မှုကို အကောင့်နှင့် ချိတ်ဆက်ရန် ခွင့်ပြုချက် တောင်းခံပါသည်။`,
    "",
    `Wallet: ${params.address}`,
    `Domain: ${SIWE_DOMAIN}`,
    `Chain: ${params.chainId}`,
    `Nonce: ${params.nonce}`,
    `အချိန်: ${params.issuedAt}`,
    "",
    // ★ ဒီစာကြောင်းက အရေးအကြီးဆုံး — user အများစုက "sign" ဆိုတာ
    //   ငွေထုတ်တာလို့ ထင်ပြီး ပယ်ဖျက်ကြတယ်။
    "★ ဤလက်မှတ်သည် ငွေကြေးလွှဲပြောင်းမှု မဟုတ်ပါ။ ကုန်ကျစရိတ် မရှိပါ။",
  ].join("\n");
}

/// `issuedAt` က nonce ထုတ်ချိန်နဲ့ ဘယ်လောက်ထိ ကွာလို့ရလဲ။
/// ★ Nonce ကိုယ်တိုင်က တစ်ခါသုံးဖြစ်လို့ replay ကို အဲဒါက တားပြီးသား —
///   ဒီစစ်ဆေးမှုက စာထဲက အချိန်ကို လိမ်ညာပြီး "အရင်နှစ်က ချိတ်ခဲ့တာ" လို
///   ပြသလို့ မရအောင်သာ။
export const ISSUED_AT_TOLERANCE_MS = 10 * 60 * 1000;

/// Nonce တစ်ခုရဲ့ သက်တမ်း (W2.5)。
/// ★ ၅ မိနစ်ကျော်တဲ့ nonce ကို လက်မခံရ — user က wallet app ကို
///   ဖွင့်ထားပြီး ထားသွားတာမျိုးမှာ signature က နာရီပေါင်းများစွာ
///   တရားဝင်နေမယ်။ ဖုန်းကို တစ်ယောက်ယောက် ကိုင်လိုက်ရင် အဲဒါနဲ့
///   wallet ချိတ်လို့ရသွားမယ်။
export const NONCE_TTL_MS = 5 * 60 * 1000;
