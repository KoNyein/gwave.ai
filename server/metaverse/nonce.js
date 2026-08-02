"use strict";

/// Phase W3.3/W3.4 — minter wallet ရဲ့ nonce စီမံခန့်ခွဲမှု + gas ကာကွယ်ချက်။
///
/// ★ **ပြဿနာ** — Ethereum transaction တိုင်းမှာ nonce (တစ်ဆက်တည်း
///   ကိန်းဂဏန်း) ပါရမယ်။ Tx ၂၀ ကို ဆက်တိုက်ပို့ရင် တစ်ခုချင်း
///   `getTransactionCount()` မေးလို့ မရဘူး — ရှေ့ tx က mempool ထဲ
///   ရောက်မှ count တက်တာမို့ အားလုံးက nonce တူတူ ရပြီး တစ်ခုပဲ
///   အောင်မြင်မယ်။ ဒါကြောင့် memory ထဲမှာ တစ်ခုတိုးရင်း သုံးတယ်။
/// ★ **Restart ကို ကိုင်တွယ်ရမယ်** — worker ပြန်စရင် memory ပျောက်တယ်။
///   ၆၀ စက္ကန့်တစ်ခါ (နဲ့ စတင်ချိန်မှာ) chain နဲ့ ပြန်ချိန်ညှိတယ်။
/// ★ **Worker တစ်ခုတည်းသာ run ရမယ်** — ၂ ခု တစ်ပြိုင်နက် nonce ယူရင်
///   တိုက်တယ်။ `web3-worker.js` က postgres advisory lock နဲ့ တစ်ခုတည်း
///   ဖြစ်အောင် ချုပ်ကိုင်ထားတယ်။

const SYNC_MS = 60_000;

/// Gas ဈေးကြီးနေလို့ ခဏစောင့်ရမယ် ဆိုတဲ့ အချက်ပြ။
/// ★ ဒါက **အမှား မဟုတ်ဘူး** — job ကို `failed` မလုပ်ရဘူး၊ `pending`
///   အတိုင်း ထားပြီး နောက်တစ်ခေါက် ပြန်ကြိုးစားရမယ်။
class RetryLater extends Error {
  constructor(message) {
    super(message);
    this.name = "RetryLater";
    this.retryable = true;
  }
}

/// Base မှာ gas က များသောအားဖြင့် 0.01–0.05 gwei။ 0.5 gwei ကျော်တာက
/// အထူးအခြေအနေ (NFT mint war စတာမျိုး) — mint တစ်ခုက $0.50 ဖြစ်သွားမယ်။
const DEFAULT_MAX_FEE_WEI = 500_000_000n; // 0.5 gwei

function createNonceManager(client, address, opts = {}) {
  const syncMs = opts.syncMs ?? SYNC_MS;
  const now = opts.now ?? (() => Date.now());

  let cached = null;
  let lastSync = 0;

  return {
    /// နောက်တစ်ခု nonce။ ★ ခေါ်တိုင်း တစ်ခု တိုးသွားတယ် — ရလာတဲ့ nonce ကို
    /// မသုံးဖြစ်ရင် `invalidate()` ခေါ်ပါ၊ မဟုတ်ရင် နောက်က tx အားလုံး
    /// အဲဒီ ကွက်လပ်ကို စောင့်နေရမယ်။
    async next() {
      if (cached === null || now() - lastSync > syncMs) {
        // `pending` — mempool ထဲ ရောက်နေပြီးသား tx တွေပါ ရေတွက်တယ်။
        const n = await client.getTransactionCount({ address, blockTag: "pending" });
        cached = Number(n);
        lastSync = now();
      }
      return cached++;
    },

    /// Chain နဲ့ အတင်း ပြန်ချိန်ညှိစေတယ် — tx ပို့လို့ မရဘဲ ကျန်ခဲ့တဲ့အခါ
    /// (ဥပမာ gas guard က ငြင်းလိုက်တာ) ခေါ်ရမယ်။
    invalidate() {
      cached = null;
      lastSync = 0;
    },

    /// စမ်းသပ်မှုအတွက်သာ
    peek() {
      return cached;
    },
  };
}

/// Gas ဈေး စစ်ပြီးမှ ပို့တယ်။
///
/// ★ `maxFeePerGas` ကို ခန့်မှန်းချက်ထက် ၂၀% တိုးထားတယ် — Base မှာ base fee
///   က block တစ်ခုချင်း ပြောင်းတယ်။ တိတိကျကျ ထည့်ရင် နောက် block မှာ
///   base fee နည်းနည်း တက်ရုံနဲ့ tx က mempool ထဲ ထာဝရ ကျန်နေမယ်။
async function sendWithGasGuard(client, wallet, params, opts = {}) {
  const cap = opts.maxFeeWei ?? DEFAULT_MAX_FEE_WEI;
  const fees = await client.estimateFeesPerGas();

  if (fees.maxFeePerGas > cap) {
    throw new RetryLater(
      `gas ဈေးကြီးနေသည် (${fees.maxFeePerGas} wei > ${cap}) — နောက်မှ ပြန်ကြိုးစားမည်`,
    );
  }

  return wallet.writeContract({
    ...params,
    maxFeePerGas: (fees.maxFeePerGas * 120n) / 100n,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
}

/// Mempool ထဲ ကပ်နေတဲ့ tx ကို **nonce အတူတူ** နဲ့ gas တိုးပြီး ပြန်ပို့တယ်။
/// ★ nonce တူမှ အဟောင်းကို အစားထိုးတာ ဖြစ်တယ် — nonce အသစ်နဲ့ ပို့ရင်
///   tx ၂ ခု ဖြစ်ပြီး ၂ ခါ mint ဖြစ်သွားနိုင်တယ်။
/// ★ Gas ကို ၃၀% တိုးရမယ် — Ethereum node အများစုက အနည်းဆုံး ၁၀%
///   မတိုးရင် replacement ကို လက်မခံဘူး။
async function replaceStuck(client, wallet, job) {
  const fees = await client.estimateFeesPerGas();
  return wallet.writeContract({
    ...job.params,
    nonce: job.nonce,
    maxFeePerGas: (fees.maxFeePerGas * 130n) / 100n,
    maxPriorityFeePerGas: (fees.maxPriorityFeePerGas * 130n) / 100n,
  });
}

module.exports = {
  createNonceManager,
  sendWithGasGuard,
  replaceStuck,
  RetryLater,
  SYNC_MS,
  DEFAULT_MAX_FEE_WEI,
};
