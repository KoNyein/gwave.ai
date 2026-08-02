import "server-only";

/// Marketplace ရဲ့ hard-off flag (Phase 19.0)。
///
/// ⚠️ **ဥပဒေခွင့်ပြုချက် မရသေးခင် production မှာ မဖွင့်ရ။** User အချင်းချင်း
///   ငွေနဲ့ပစ္စည်း လဲလှယ်တာက ထိုင်း e-marketplace/payment-intermediary
///   စည်းမျဉ်းတွေနဲ့ ထိတွေ့တယ်။ ဒါကြောင့် env က default **ပိတ်** ဖြစ်ပြီး
///   route တိုင်းက ဒီ function ကို အရင်ခေါ်ရမယ်။
export function marketEnabled(): boolean {
  return process.env.MV_MARKET_ENABLED === "true";
}
