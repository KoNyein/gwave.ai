/// Wallet ချိတ်ဆက်ရာမှာ လက်မှတ်ထိုးရမယ့် စာ။
///
/// ★ Client နဲ့ server **တစ်လုံးမကျန် တူညီရမယ်** — space တစ်ခု ကွာရုံနဲ့
///   signature က မကိုက်တော့ဘူး။ ဒါကြောင့် ၂ ဘက်စလုံးက ဒီ function
///   တစ်ခုတည်းကို သုံးတယ်၊ တစ်ဘက်စီ ကိုယ့်ဘာသာ မရေးရ။
/// ★ စာထဲမှာ **ဘာလုပ်မှာလဲ** ကို ရှင်းရှင်းရေးထားရမယ် — wallet က ဒီစာကို
///   အတိုင်း ပြတယ်။ နားမလည်တဲ့ hex တစ်တန်းကို sign ခိုင်းတာက user ကို
///   အန္တရာယ်ရှိတဲ့ အလေ့အထ သင်ပေးရာ ရောက်တယ်။
export function siweMessage(params: {
  address: string;
  nonce: string;
  issuedAt: string;
}): string {
  return [
    "gwave.cc သို့ wallet ချိတ်ဆက်ရန်",
    `Wallet: ${params.address}`,
    `Nonce: ${params.nonce}`,
    `အချိန်: ${params.issuedAt}`,
  ].join("\n");
}

/// `issuedAt` က nonce ထုတ်ချိန်နဲ့ ဘယ်လောက်ထိ ကွာလို့ရလဲ။
/// ★ Nonce ကိုယ်တိုင်က တစ်ခါသုံးဖြစ်လို့ replay ကို အဲဒါက တားပြီးသား —
///   ဒီစစ်ဆေးမှုက စာထဲက အချိန်ကို လိမ်ညာပြီး "အရင်နှစ်က ချိတ်ခဲ့တာ" လို
///   ပြသလို့ မရအောင်သာ။
export const ISSUED_AT_TOLERANCE_MS = 10 * 60 * 1000;
