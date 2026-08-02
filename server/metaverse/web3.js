"use strict";

/// On-chain ပိုင်ဆိုင်မှု စစ်ဆေးခြင်း — **server ဘက်မှာသာ**။
///
/// ★ Client က "ငါ NFT ပိုင်တယ်" ပြောတာကို **ဘယ်တော့မှ မယုံရ**။ Browser
///   ထဲက JavaScript ကို ဘယ်သူမဆို ပြင်လို့ရတယ် — UI မှာ ခလုတ်ဖျောက်ထားရုံနဲ့
///   ဘာမှ မကာကွယ်ဘူး။ VIP room ဝင်ခွင့်ဟာ ဒီ file ကနေသာ ဆုံးဖြတ်ရမယ်။
/// ★ **အဖြေရှာတဲ့ အစဉ် ၃ ဆင့်** (Phase W4/W5) —
///     1. RDS mirror (`web3_nft_owners`) — indexer က ၅ မိနစ်အတွင်း
///        ချိန်ညှိထားရင် DB ကနေပဲ ဖြေတယ်၊ RPC လုံးဝ မခေါ်ဘူး။
///     2. RPC (fallback transport ၃ ခု + circuit breaker) — mirror
///        နောက်ကျနေရင်၊ ဒါမှမဟုတ် indexer မဖွင့်ရသေးရင်။
///     3. ၅ မိနစ် memory cache — တူညီတဲ့ wallet ကို ထပ်မမေးဘူး။
/// ★ **RPC ကျရင် လောကက ဆက်အလုပ်လုပ်ရမယ်** — ပုံမှန် room တွေက ဘာမှ
///   မထိခိုက်ရဘူး။ VIP room ကိုတော့ ငြင်းတယ် (fail-closed) — ပိုင်မပိုင်
///   မသိဘဲ ဝင်ခွင့်ပေးရင် စစ်ဆေးမှုက အဓိပ္ပာယ်မရှိတော့ဘူး။

const { CircuitBreaker, createPublicClient } = require("./rpc");
const indexer = require("./indexer");

const CACHE_MS = 5 * 60 * 1000;

/// ERC-721 `balanceOf(address)` နဲ့ ERC-1155 `balanceOf(address,uint256)`။
/// ★ ABI တစ်ခုလုံး မလိုဘူး — သုံးမယ့် function ၂ ခုပဲ ရေးထားတယ်။
const ERC721_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
];

const ERC1155_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
];

function nullWeb3(why) {
  return {
    enabled: false,
    why,
    async ownsLand() {
      return false;
    },
    async hasItem() {
      return false;
    },
    async ownedPlots() {
      return [];
    },
    stats() {
      return { enabled: false, why, source: "off" };
    },
  };
}

/// `db` (pg Pool) ထည့်ရင် indexer mirror ကို သုံးတယ် — မထည့်ရင် RPC သာ။
function createWeb3(env = process.env, db = null) {
  const landAddress = env.WEB3_LAND_ADDRESS
    ? env.WEB3_LAND_ADDRESS.toLowerCase()
    : null;
  const itemsAddress = env.WEB3_ITEMS_ADDRESS
    ? env.WEB3_ITEMS_ADDRESS.toLowerCase()
    : null;

  const { client, why } = createPublicClient(env);
  if (!client) return nullWeb3(why);

  // ★ Breaker က RPC ဆီ သွားတဲ့ လမ်းကြောင်းအားလုံးအတွက် တစ်ခုတည်း —
  //   provider ကျနေချိန်မှာ ownsLand/hasItem နှစ်ခုလုံး ရပ်ရမယ်။
  const breaker = new CircuitBreaker({ threshold: 5, cooldownMs: 60_000, name: "web3" });

  /// wallet -> { at, value }
  const cache = new Map();
  let served = { mirror: 0, rpc: 0, cache: 0 };

  const cached = async (key, fetcher) => {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) {
      served.cache += 1;
      return hit.value;
    }
    const value = await fetcher();
    cache.set(key, { at: Date.now(), value });
    // ★ cache က အကန့်အသတ်မဲ့ မကြီးလာစေရ — wallet အတု ထောင်ချီ ပို့ပြီး
    // memory ကုန်အောင် လုပ်လို့ရမယ်။
    if (cache.size > 5000) {
      for (const k of cache.keys()) {
        cache.delete(k);
        if (cache.size <= 4000) break;
      }
    }
    return value;
  };

  /// Mirror က ယုံလောက်အောင် လတ်ဆတ်လား။ DB မရှိရင်၊ ဒါမှမဟုတ် DB
  /// ကိုယ်တိုင် ကျနေရင် `false` — RPC ဘက် ကူးရမယ်။
  const mirrorFresh = async (contract) => {
    if (!db || !contract) return false;
    try {
      return await indexer.isFresh(db, contract);
    } catch {
      return false;
    }
  };

  return {
    enabled: true,
    why: null,

    /// မြေကွက် (ERC-721) တစ်ကွက်ကွက် ပိုင်လား
    async ownsLand(wallet) {
      if (!wallet || !landAddress) return false;
      const owner = String(wallet).toLowerCase();
      return cached(`land:${owner}`, async () => {
        if (await mirrorFresh(landAddress)) {
          try {
            const tokens = await indexer.ownedTokens(db, landAddress, owner);
            served.mirror += 1;
            return tokens.length > 0;
          } catch {
            /* DB ကျရင် RPC ဆက်စမ်းတယ် */
          }
        }
        served.rpc += 1;
        // ★ fail-closed — breaker ဖွင့်ထားရင်လည်း `false`。
        return breaker.run(async () => {
          const n = await client.readContract({
            address: landAddress,
            abi: ERC721_ABI,
            functionName: "balanceOf",
            args: [owner],
          });
          return n > 0n;
        }, false);
      });
    },

    /// ပစ္စည်း (ERC-1155) တစ်ခုကို ပိုင်လား
    async hasItem(wallet, itemId) {
      if (!wallet || !itemsAddress) return false;
      const owner = String(wallet).toLowerCase();
      return cached(`item:${owner}:${itemId}`, async () => {
        if (await mirrorFresh(itemsAddress)) {
          try {
            const n = await indexer.itemBalance(db, itemsAddress, owner, itemId);
            served.mirror += 1;
            return n > 0;
          } catch {
            /* RPC ဆက်စမ်း */
          }
        }
        served.rpc += 1;
        return breaker.run(async () => {
          const n = await client.readContract({
            address: itemsAddress,
            abi: ERC1155_ABI,
            functionName: "balanceOf",
            args: [owner, BigInt(itemId)],
          });
          return n > 0n;
        }, false);
      });
    },

    /// ပိုင်ဆိုင်တဲ့ မြေကွက် စာရင်း — ★ mirror ရှိမှသာ။ RPC နဲ့ token
    /// တစ်ခုချင်း လိုက်ရှာတာက call ထောင်ချီ ဖြစ်လို့ လုံးဝ မလုပ်ဘူး။
    async ownedPlots(wallet) {
      if (!db || !wallet || !landAddress) return [];
      try {
        return await indexer.ownedTokens(db, landAddress, String(wallet).toLowerCase());
      } catch {
        return [];
      }
    },

    /// `/health` မှာ ပြဖို့ — mirror က တကယ် အလုပ်လုပ်နေလား သိရအောင်။
    stats() {
      return {
        enabled: true,
        source: db ? "mirror+rpc" : "rpc",
        circuitOpen: breaker.isOpen(),
        served: { ...served },
        cacheSize: cache.size,
      };
    },
  };
}

module.exports = { createWeb3, CACHE_MS };
