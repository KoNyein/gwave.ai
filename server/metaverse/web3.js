"use strict";

/// On-chain ပိုင်ဆိုင်မှု စစ်ဆေးခြင်း — **server ဘက်မှာသာ**။
///
/// ★ Client က "ငါ NFT ပိုင်တယ်" ပြောတာကို **ဘယ်တော့မှ မယုံရ**။ Browser
///   ထဲက JavaScript ကို ဘယ်သူမဆို ပြင်လို့ရတယ် — UI မှာ ခလုတ်ဖျောက်ထားရုံနဲ့
///   ဘာမှ မကာကွယ်ဘူး။ VIP room ဝင်ခွင့်ဟာ ဒီ file ကနေသာ ဆုံးဖြတ်ရမယ်။
/// ★ **RPC တိုင်း ခေါ်လို့မရဘူး** — public RPC မှာ rate limit ရှိပြီး
///   provider က တစ်ခေါက်ချင်း ငွေယူတယ်။ ၅ မိနစ် cache လုပ်တယ်။
/// ★ **RPC ကျရင် လောကက ဆက်အလုပ်လုပ်ရမယ်** — ပုံမှန် room တွေက ဘာမှ
///   မထိခိုက်ရဘူး။ VIP room ကိုတော့ ငြင်းတယ် (fail-closed) — ပိုင်မပိုင်
///   မသိဘဲ ဝင်ခွင့်ပေးရင် စစ်ဆေးမှုက အဓိပ္ပာယ်မရှိတော့ဘူး။

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
  };
}

function createWeb3(env = process.env) {
  const rpcUrl = env.WEB3_RPC_URL;
  const landAddress = env.WEB3_LAND_ADDRESS;
  const itemsAddress = env.WEB3_ITEMS_ADDRESS;

  if (!rpcUrl) return nullWeb3("WEB3_RPC_URL မထည့်ထားဘူး");

  let viem;
  let chains;
  try {
    viem = require("viem");
    chains = require("viem/chains");
  } catch {
    return nullWeb3("viem package မရှိဘူး");
  }

  // Base (Ethereum L2) — gas ~$0.01၊ RPC တည်ငြိမ်တယ်။ testnet မှာ
  // စမ်းချင်ရင် WEB3_CHAIN=baseSepolia။
  const chainName = env.WEB3_CHAIN || "base";
  const chain = chains[chainName];
  if (!chain) return nullWeb3(`chain '${chainName}' ကို မသိဘူး`);

  const client = viem.createPublicClient({
    chain,
    transport: viem.http(rpcUrl, { timeout: 6000, retryCount: 1 }),
  });

  /// wallet -> { at, value }
  const cache = new Map();

  const cached = async (key, fetcher) => {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
    try {
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
    } catch (err) {
      console.error("[mv/web3]", key, err.message);
      return false; // fail-closed
    }
  };

  return {
    enabled: true,
    why: null,

    /// မြေကွက် (ERC-721) တစ်ကွက်ကွက် ပိုင်လား
    async ownsLand(wallet) {
      if (!wallet || !landAddress) return false;
      return cached(`land:${wallet}`, async () => {
        const n = await client.readContract({
          address: landAddress,
          abi: ERC721_ABI,
          functionName: "balanceOf",
          args: [wallet],
        });
        return n > 0n;
      });
    },

    /// ပစ္စည်း (ERC-1155) တစ်ခုကို ပိုင်လား
    async hasItem(wallet, itemId) {
      if (!wallet || !itemsAddress) return false;
      return cached(`item:${wallet}:${itemId}`, async () => {
        const n = await client.readContract({
          address: itemsAddress,
          abi: ERC1155_ABI,
          functionName: "balanceOf",
          args: [wallet, BigInt(itemId)],
        });
        return n > 0n;
      });
    },
  };
}

module.exports = { createWeb3, CACHE_MS };
