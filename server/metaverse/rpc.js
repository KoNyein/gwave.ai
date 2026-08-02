"use strict";

/// Phase W5 — RPC ခံနိုင်ရည် (fallback transport + circuit breaker)။
///
/// ★ **အခြေခံမူ — Web3 ကျရင် metaverse က ဆက်အလုပ်လုပ်ရမယ်။** RPC provider
///   ကျတာက ဒီ app နဲ့ ဘာမှ မဆိုင်ဘူး — ဒါပေမယ့် ကျတဲ့အခါ ဂိမ်းတစ်ခုလုံး
///   ရပ်သွားရင် user က "Gwave ပျက်နေတယ်" လို့ပဲ မြင်မယ်။ ဒီ file ထဲက
///   function တွေက ဘယ်တော့မှ throw မလုပ်ဘူး — fallback တန်ဖိုး ပြန်ပေးတယ်။
/// ★ Provider ၃ ခု ထားတယ် (paid ၂ + public ၁)။ viem ရဲ့ `fallback` က
///   `rank: true` နဲ့ latency အလိုက် အလိုအလျောက် အစဉ်ပြောင်းပေးတယ် —
///   ကျနေတဲ့ provider ကို အောက်ဆုံးပို့တယ်။
/// ★ Circuit breaker က fallback ရဲ့ **အပေါ်ထပ်** မှာ ရှိတယ်။ Provider
///   အားလုံး ကျရင် viem က တစ်ခုချင်း စမ်းလို့ request တစ်ခုစီ ၂၀ စက္ကန့်ကြာမယ်။
///   Breaker ဖွင့်လိုက်ရင် ၆၀ စက္ကန့် လုံးဝ မခေါ်တော့ဘဲ ချက်ချင်း ပြန်ပေးတယ်။

/// RPC ဆက်တိုက် ကျရင် ခဏရပ်ထားတဲ့ ခလုတ်။
///
/// ★ ဘာလို့လိုလဲ — provider ကျနေချိန်မှာ player ၁၀၀ က VIP room ဝင်ဖို့
///   ကြိုးစားရင် ကျနေတဲ့ endpoint ကို တစ်စက္ကန့် ရာချီ ခေါ်မယ် (retry storm)။
///   Provider ပြန်ကောင်းလာချိန်မှာ ဒီ traffic က ချက်ချင်း ပြန်ချေမှုန်းမယ်။
class CircuitBreaker {
  constructor({ threshold = 5, cooldownMs = 60000, name = "rpc" } = {}) {
    this.threshold = threshold;
    this.cooldownMs = cooldownMs;
    this.name = name;
    this.failures = 0;
    this.openUntil = 0;
  }

  /// ခလုတ် ဖွင့်ထားလား (= ခေါ်လို့ မရသေးဘူး)
  isOpen(now = Date.now()) {
    return now < this.openUntil;
  }

  /// `fn()` ကို run တယ်။ ကျရင် (ဒါမှမဟုတ် ခလုတ်ဖွင့်ထားရင်) `fallbackValue`
  /// ပြန်ပေးတယ် — ★ ဘယ်တော့မှ throw မလုပ်ဘူး။
  async run(fn, fallbackValue) {
    const now = Date.now();
    if (this.isOpen(now)) return fallbackValue;
    try {
      const value = await fn();
      // ★ တစ်ခါ အောင်မြင်ရင် counter ကို သုညပြန်ချတယ် — ကြာရှည်
      // အသုံးပြုမှုမှာ ရံဖန်ရံခါ ကျတာတွေ စုပုံပြီး ခလုတ် အလကား
      // မဖွင့်သွားစေရ။
      this.failures = 0;
      return value;
    } catch (err) {
      this.failures += 1;
      if (this.failures >= this.threshold) {
        this.openUntil = Date.now() + this.cooldownMs;
        this.failures = 0;
        console.error(`[web3] circuit open (${this.name}) —`, err?.message ?? err);
      }
      return fallbackValue;
    }
  }
}

/// Env ကနေ RPC URL တွေ စုတယ် — ရှေ့ကဟာက ဦးစားပေး။
///
/// ★ `WEB3_RPC_URL` က ရှိပြီးသား env — အဲဒါကို ဆက်ထောက်ပံ့ရမယ် (မဟုတ်ရင်
///   deploy လုပ်လိုက်တာနဲ့ VIP room က ချက်ချင်း ပိတ်သွားမယ်)။
/// ★ **တစ်ခုမှ မထည့်ထားရင် ဗလာ ပြန်ပေးရမယ်** — public endpoint ကို
///   အလိုအလျောက် ထည့်ပေးလိုက်ရင် Web3 ကို လုံးဝ မဖွင့်ထားတဲ့
///   installation တစ်ခုက `/health` မှာ "ဖွင့်ထားတယ်" လို့ ပြပြီး၊ gated
///   room ဝင်တိုင်း ပြင်ပ endpoint တစ်ခုကို ခေါ်နေမယ်။ Public က
///   **backup** သာ ဖြစ်ရမယ်၊ configuration အစား မဟုတ်ဘူး။
function rpcUrls(env) {
  const configured = [env.WEB3_RPC_URL, env.WEB3_RPC_URL_2, env.WEB3_RPC_URL_3].filter(
    Boolean,
  );
  if (configured.length === 0) return [];

  // ★ Public backup — key မလိုဘူး၊ rate limit ရှိတယ်။ နောက်ဆုံးအဆင့်သာ။
  configured.push(
    env.WEB3_CHAIN === "baseSepolia"
      ? "https://sepolia.base.org"
      : "https://mainnet.base.org",
  );

  const seen = new Set();
  return configured.filter((u) => {
    if (seen.has(u)) return false;
    seen.add(u);
    return true;
  });
}

/// viem public client တစ်ခု ဆောက်တယ် — fallback transport နဲ့။
/// viem မရှိရင် (ဒါမှမဟုတ် chain မမှန်ရင်) `null` ပြန်ပေးတယ်။
function createPublicClient(env = process.env) {
  let viem;
  let chains;
  try {
    viem = require("viem");
    chains = require("viem/chains");
  } catch {
    return { client: null, why: "viem package မရှိဘူး", chain: null };
  }

  const chainName = env.WEB3_CHAIN || "base";
  const chain = chains[chainName];
  if (!chain) return { client: null, why: `chain '${chainName}' ကို မသိဘူး`, chain: null };

  const urls = rpcUrls(env);
  if (urls.length === 0) return { client: null, why: "RPC URL မထည့်ထားဘူး", chain };

  // ★ ရှေ့က ၂ ခု (paid) ကို retry ၂ ခါ၊ public backup ကို ၁ ခါပဲ —
  //   public က rate limit ခံရရင် ထပ်ခေါ်တာ ပိုဆိုးတယ်။
  const transports = urls.map((url, i) =>
    viem.http(url, {
      batch: true,
      retryCount: i < urls.length - 1 ? 2 : 1,
      timeout: i < urls.length - 1 ? 8000 : 10000,
    }),
  );

  const client = viem.createPublicClient({
    chain,
    // ★ `rank: true` — viem က provider တွေကို latency/အောင်မြင်နှုန်း
    //   အလိုက် အလိုအလျောက် အစဉ်ချတယ်။ ကျနေတဲ့ provider ကို ကိုယ်တိုင်
    //   ဖယ်စရာ မလိုတော့ဘူး။
    transport: viem.fallback(transports, { rank: true, retryCount: 0 }),
  });

  return { client, why: null, chain, urls };
}

module.exports = { CircuitBreaker, createPublicClient, rpcUrls };
