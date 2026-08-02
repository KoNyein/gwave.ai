"use strict";

/// Phase W3 + W4 — background worker (mint sender · confirmation · indexer)。
///
/// ★ **တစ်ခုတည်းသာ run ရမယ်** — worker ၂ ခု တစ်ပြိုင်နက် nonce ယူရင်
///   တိုက်ပြီး tx တွေ stuck ဖြစ်တယ်။ Spec က `desiredCount: 1` ဒါမှမဟုတ်
///   Redis lock ကို ညွှန်းတယ်၊ ဒီမှာ **postgres advisory lock** သုံးတယ် —
///   Redis က optional ဖြစ်ပြီး DB က မဖြစ်မနေ ရှိရတာမို့ ပိုသေချာတယ်။
///   Deploy overlap (container အသစ်တက်၊ အဟောင်း မသေသေး) မှာလည်း
///   အသစ်က lock မရလို့ တိတ်တိတ်ပဲ ကျော်သွားတယ်。
/// ★ **ပိတ်ထားတာက default** — `WEB3_WORKER=1` ထည့်မှ run တယ်။ Minter key
///   မရှိဘဲ ဖွင့်လိုက်ရင် job တိုင်း ကျရှုံးပြီး `failed` ဖြစ်ကုန်မယ်။
/// ★ **ဘယ်တော့မှ crash မဖြစ်ရ** — loop တစ်ခုချင်းစီကို try/catch နဲ့
///   ပတ်ထားတယ်။ Worker သေရင် metaverse server တစ်ခုလုံး လိုက်သေမယ်။

const { Pool } = require("pg");

const { chooseSsl } = require("./store");
const { CircuitBreaker, createPublicClient } = require("./rpc");
const { createNonceManager, sendWithGasGuard, RetryLater } = require("./nonce");
const mintQueue = require("./mint-queue");
const indexer = require("./indexer");

const SEND_MS = 15_000;
const CONFIRM_MS = 20_000;
const INDEX_MS = 15_000;

/// ★ advisory lock key — ဒီ ကိန်းဂဏန်းက Gwave web3 worker အတွက် သီးသန့်။
///   တခြား feature တစ်ခုက တူညီတဲ့ key သုံးမိရင် worker ၂ ခုက
///   အချင်းချင်း ပိတ်နေမယ်။
const LOCK_KEY = 918_273_641;

/// ERC-721 `mint(address,uint256)` နဲ့ ERC-1155 `mint(address,uint256,uint256)`。
const MINT_ABI = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "id", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
];

function log(...args) {
  console.log("[web3-worker]", ...args);
}

/// Job တစ်ခုကို contract call parameter အဖြစ် ပြောင်းတယ်။
function jobParams(job, addresses) {
  const to = String(job.wallet);
  if (job.kind === "land") {
    if (!addresses.land) throw new Error("WEB3_LAND_ADDRESS မထည့်ထားဘူး");
    return {
      address: addresses.land,
      abi: MINT_ABI,
      functionName: "mint",
      args: [to, BigInt(job.token_id)],
    };
  }
  if (!addresses.items) throw new Error("WEB3_ITEMS_ADDRESS မထည့်ထားဘူး");
  return {
    address: addresses.items,
    abi: MINT_ABI,
    functionName: "mint",
    args: [to, BigInt(job.token_id), BigInt(job.amount || 1)],
  };
}

/// Pending job တွေကို တစ်ခုချင်း ပို့တယ်။
///
/// ★ **တစ်ခုချင်း၊ အစဉ်လိုက်** — Promise.all နဲ့ တစ်ပြိုင်နက် ပို့ရင်
///   nonce အစဉ် မမှန်တော့ဘူး (တစ်ခုက ကျရင် နောက်က အားလုံး ကွက်လပ်ကို
///   စောင့်နေမယ်)。
async function sendPending(ctx) {
  const jobs = await mintQueue.claimPending(ctx.db, { limit: 10 });
  if (!jobs.length) return { sent: 0 };

  let sent = 0;
  for (const job of jobs) {
    let nonce = null;
    try {
      const params = jobParams(job, ctx.addresses);
      nonce = await ctx.nonces.next();
      const hash = await sendWithGasGuard(
        ctx.publicClient,
        ctx.walletClient,
        { ...params, account: ctx.account, chain: ctx.chain, nonce },
        { maxFeeWei: ctx.maxFeeWei },
      );
      await mintQueue.markSent(ctx.db, job.id, hash, nonce);
      sent += 1;
    } catch (err) {
      // ★ nonce ယူပြီးမှ ပို့လို့မရရင် အဲဒီ nonce က ကွက်လပ်ဖြစ်နေမယ် —
      //   နောက် tx အားလုံး mempool ထဲ ထာဝရ ကပ်နေမယ်။ ဒါကြောင့်
      //   chain နဲ့ ပြန်ချိန်ညှိစေတယ်။
      if (nonce !== null) ctx.nonces.invalidate();
      const status = await mintQueue.markRetry(ctx.db, job, err);
      if (!(err instanceof RetryLater)) {
        log(`job ${job.id} → ${status}:`, err?.message ?? err);
      }
    }
  }
  return { sent };
}

/// RPC/DB ကို ခေါ်တဲ့ loop တစ်ခုကို ကာကွယ်ပြီး run တယ်။
function safeLoop(name, ms, fn) {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return; // ★ ရှေ့တစ်ခေါက် မပြီးသေးရင် ထပ်မစဘူး
    running = true;
    try {
      await fn();
    } catch (err) {
      console.error(`[web3-worker] ${name}:`, err?.message ?? err);
    } finally {
      running = false;
    }
  }, ms);
  timer.unref?.();
  return timer;
}

/// Worker ကို စတယ်။ ဘာမှ မလုပ်နိုင်ရင် `{ enabled: false, why }` ပြန်ပေးတယ် —
/// ★ ဘယ်တော့မှ throw မလုပ်ဘူး၊ metaverse server က ဆက်တက်ရမယ်။
async function startWeb3Worker(env = process.env, sharedPool = null) {
  if (env.WEB3_WORKER !== "1") {
    return { enabled: false, why: "WEB3_WORKER=1 မထည့်ထားဘူး", stop: async () => {} };
  }
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl && !sharedPool) {
    return { enabled: false, why: "DATABASE_URL မရှိဘူး", stop: async () => {} };
  }
  // ★ Minter key က Secrets Manager ကနေ env ထဲ ရောက်လာရမယ် (W7)。
  //   Git ထဲ ဘယ်တော့မှ မရှိရ။
  const minterKey = env.WEB3_MINTER_KEY;

  const { client: publicClient, why, chain } = createPublicClient(env);
  if (!publicClient) return { enabled: false, why, stop: async () => {} };

  let viem;
  let accounts;
  try {
    viem = require("viem");
    accounts = require("viem/accounts");
  } catch {
    return { enabled: false, why: "viem package မရှိဘူး", stop: async () => {} };
  }

  // ★ Lock ကို connection တစ်ခုတည်းမှာ ကိုင်ရမယ် — pool ကနေ ယူပြီး
  //   ပြန်အပ်လိုက်ရင် session ပြောင်းပြီး lock ကျွတ်သွားတယ်။
  const ownsPool = !sharedPool;
  const pool =
    sharedPool ??
    new Pool({
      connectionString: databaseUrl,
      ssl: chooseSsl(databaseUrl),
      max: 3,
      idleTimeoutMillis: 30_000,
    });

  const lockClient = await pool.connect();
  const { rows } = await lockClient.query("SELECT pg_try_advisory_lock($1) AS got", [
    LOCK_KEY,
  ]);
  if (!rows[0]?.got) {
    lockClient.release();
    if (ownsPool) await pool.end().catch(() => {});
    return {
      enabled: false,
      why: "တခြား worker တစ်ခု run နေပြီ (advisory lock)",
      stop: async () => {},
    };
  }

  const addresses = {
    land: env.WEB3_LAND_ADDRESS ? env.WEB3_LAND_ADDRESS.toLowerCase() : null,
    items: env.WEB3_ITEMS_ADDRESS ? env.WEB3_ITEMS_ADDRESS.toLowerCase() : null,
  };

  const timers = [];
  const ctx = {
    db: pool,
    publicClient,
    chain,
    addresses,
    maxFeeWei: env.WEB3_MAX_FEE_WEI ? BigInt(env.WEB3_MAX_FEE_WEI) : undefined,
  };

  // ── Mint sender — minter key ရှိမှသာ ─────────────────────────────────
  if (minterKey) {
    const account = accounts.privateKeyToAccount(
      minterKey.startsWith("0x") ? minterKey : `0x${minterKey}`,
    );
    ctx.account = account;
    ctx.walletClient = viem.createWalletClient({
      account,
      chain,
      // ★ ဖတ်တဲ့ client နဲ့ **တူညီတဲ့** fallback transport — အရင်က
      //   `viem.http(env.WEB3_RPC_URL)` တစ်ခုတည်းမို့ ပို့တာမှာ failover
      //   မရှိခဲ့ဘူး (rpc.js ရဲ့ rpcTransport မှာ အသေးစိတ် ရေးထားတယ်)。
      transport: rpcTransport(env, viem),
    });
    ctx.nonces = createNonceManager(publicClient, account.address, {});
    timers.push(safeLoop("send", SEND_MS, () => sendPending(ctx)));
    log("mint sender on —", account.address);
  } else {
    log("mint sender off — WEB3_MINTER_KEY မရှိဘူး (confirm/index ပဲ run မယ်)");
  }

  // ── Confirmation — key မရှိလည်း run ရမယ် ─────────────────────────────
  // ★ ရှေ့က worker တစ်ခုက ပို့ထားပြီး key ဖြုတ်လိုက်တဲ့အခါမှာလည်း
  //   `sent` job တွေက အဖြေရဖို့ လိုတယ်။
  timers.push(
    safeLoop("confirm", CONFIRM_MS, async () => {
      const r = await mintQueue.confirmPending(pool, publicClient);
      if (r.confirmed || r.reverted || r.dropped) log("confirm", r);
    }),
  );

  // ── Indexer ──────────────────────────────────────────────────────────
  const specs = [];
  if (addresses.land) {
    specs.push({
      contract: addresses.land,
      kind: "erc721",
      deployBlock: env.WEB3_LAND_DEPLOY_BLOCK ?? 0,
    });
  }
  if (addresses.items) {
    specs.push({
      contract: addresses.items,
      kind: "erc1155",
      deployBlock: env.WEB3_ITEMS_DEPLOY_BLOCK ?? 0,
    });
  }
  if (specs.length) {
    timers.push(
      safeLoop("index", INDEX_MS, async () => {
        for (const spec of specs) {
          // ★ တစ်ခေါက် sync က batch ၂၀၀၀ ပဲ ဖတ်တယ် — နောက်ကျနေရင်
          //   loop က ခေါ်ခေါ်ပြီး ဖြည်းဖြည်း မီအောင် လိုက်တယ်။
          const r = await indexer.syncContract(pool, publicClient, spec);
          if (r?.logs) log("index", spec.contract, `${r.from}-${r.to}`, `${r.logs} log`);
        }
      }),
    );
  }

  log(`on — ${specs.length} contract, chain ${chain?.name ?? "?"}`);

  return {
    enabled: true,
    why: null,
    pool,
    async stop() {
      for (const t of timers) clearInterval(t);
      try {
        await lockClient.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
      } catch {
        /* connection ပြတ်သွားရင် lock က သူ့ဘာသာ ကျွတ်တယ် */
      }
      lockClient.release();
      if (ownsPool) await pool.end().catch(() => {});
    },
  };
}

module.exports = {
  startWeb3Worker,
  sendPending,
  jobParams,
  CircuitBreaker,
  LOCK_KEY,
  MINT_ABI,
};
