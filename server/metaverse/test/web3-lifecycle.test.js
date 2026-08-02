"use strict";

/// Phase W3 + W4 + W5 — transaction lifecycle, nonce, indexer, circuit breaker。
///
/// ★ ဒီ test တွေက **chain ကို လုံးဝ မထိဘူး**။ RPC client နဲ့ database ကို
///   အတုနဲ့ အစားထိုးပြီး *ဆုံးဖြတ်ချက်* တွေကိုသာ စစ်တယ် — "receipt က
///   success ဖြစ်ပေမယ့် confirmation ၂ ခုပဲ ရှိရင် confirmed မလုပ်ရ"
///   ဆိုတာမျိုး။ တကယ့် chain နဲ့ စမ်းရင် ဒီ ခြားနားချက်တွေက ရှားရှားပါးပါး
///   ဖြစ်တာမို့ ဘယ်တော့မှ မဖမ်းမိဘူး (reorg ကို ခေါ်လို့ မရဘူး)。

const test = require("node:test");
const assert = require("node:assert");

const { CircuitBreaker } = require("../rpc");
const { createNonceManager, sendWithGasGuard, RetryLater } = require("../nonce");
const mintQueue = require("../mint-queue");
const indexer = require("../indexer");

/// SQL ရဲ့ ရှေ့ပိုင်းကို ကြည့်ပြီး အဖြေပြန်ပေးတဲ့ database အတု။
function fakeDb(handlers = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      // ★ SQL တွေက စာကြောင်းများနဲ့ ရေးထားလို့ ရှာတဲ့အခါ space တွေကို
      //   အရင် ချုံ့ရမယ် — မဟုတ်ရင် handler က ဘယ်တော့မှ မကိုက်ဘဲ
      //   test တွေက အလကား အစိမ်းရောင် ပြနေမယ်။
      const flat = sql.replace(/\s+/g, " ").trim();
      calls.push({ sql: flat, params });
      for (const [needle, rows] of Object.entries(handlers)) {
        if (flat.includes(needle.replace(/\s+/g, " ").trim())) {
          const value = typeof rows === "function" ? rows(params) : rows;
          return { rows: value ?? [] };
        }
      }
      return { rows: [] };
    },
  };
}

// ── W5 · Circuit breaker ───────────────────────────────────────────────────
test("breaker: ကျတဲ့အခါ fallback ပြန်ပေးတယ်၊ throw မလုပ်ဘူး", async () => {
  const b = new CircuitBreaker({ threshold: 3, cooldownMs: 1000 });
  const v = await b.run(async () => {
    throw new Error("rpc down");
  }, "fallback");
  assert.equal(v, "fallback");
});

test("breaker: ဆက်တိုက် ကျရင် ဖွင့်ပြီး နောက်ထပ် မခေါ်တော့ဘူး", async () => {
  const b = new CircuitBreaker({ threshold: 3, cooldownMs: 60_000 });
  let calls = 0;
  const boom = async () => {
    calls += 1;
    throw new Error("down");
  };
  for (let i = 0; i < 3; i++) await b.run(boom, null);
  assert.equal(calls, 3);
  assert.ok(b.isOpen(), "threshold ပြည့်ရင် ဖွင့်ရမယ်");

  // ★ ဖွင့်ထားချိန်မှာ fn ကို လုံးဝ မခေါ်ရ — retry storm ကာကွယ်တာ
  //   ဒီအချက်ပဲ။
  await b.run(boom, null);
  assert.equal(calls, 3, "ဖွင့်ထားချိန်မှာ RPC ထပ်ခေါ်နေတယ်");
});

test("breaker: cooldown ကုန်ရင် ပြန်စမ်းတယ်", async () => {
  const b = new CircuitBreaker({ threshold: 1, cooldownMs: 10 });
  await b.run(async () => {
    throw new Error("down");
  }, null);
  assert.ok(b.isOpen());
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(b.isOpen(), false);
  const v = await b.run(async () => "back", null);
  assert.equal(v, "back");
});

test("breaker: တစ်ခါ အောင်မြင်ရင် ကျရှုံးရေတွက်မှု သုညပြန်ဖြစ်တယ်", async () => {
  const b = new CircuitBreaker({ threshold: 3, cooldownMs: 60_000 });
  await b.run(async () => {
    throw new Error("x");
  }, null);
  await b.run(async () => {
    throw new Error("x");
  }, null);
  await b.run(async () => "ok", null); // ← ဒီမှာ counter ပြန်ချ
  await b.run(async () => {
    throw new Error("x");
  }, null);
  assert.equal(b.isOpen(), false, "ရံဖန်ရံခါ ကျတာတွေ စုပြီး ဖွင့်သွားတယ်");
});

// ── W3.3 · Nonce ───────────────────────────────────────────────────────────
test("nonce: tx ၂၀ ဆက်တိုက် ယူရင် မတိုက်ဘူး (RPC တစ်ခါပဲ)", async () => {
  let rpcCalls = 0;
  const client = {
    async getTransactionCount() {
      rpcCalls += 1;
      return 7;
    },
  };
  const n = createNonceManager(client, "0xabc", { syncMs: 60_000 });
  const got = [];
  for (let i = 0; i < 20; i++) got.push(await n.next());

  assert.equal(rpcCalls, 1, "chain ကို ၂၀ ခါ မမေးရ");
  assert.deepEqual(got, Array.from({ length: 20 }, (_, i) => 7 + i));
  assert.equal(new Set(got).size, 20, "nonce တူတာ ရှိနေတယ်");
});

test("nonce: worker restart (invalidate) ပြီးရင် chain နဲ့ ပြန်ချိန်ညှိတယ်", async () => {
  let head = 7;
  const client = {
    async getTransactionCount() {
      return head;
    },
  };
  const n = createNonceManager(client, "0xabc", { syncMs: 60_000 });
  assert.equal(await n.next(), 7);
  assert.equal(await n.next(), 8);

  // chain မှာ တခြားတစ်ခုက ပို့လိုက်တယ် (ဒါမှမဟုတ် worker ပြန်စတယ်)
  head = 42;
  n.invalidate();
  assert.equal(await n.next(), 42, "invalidate ပြီးရင် chain ကို ပြန်မေးရမယ်");
});

test("nonce: ၆၀ စက္ကန့် ကျော်ရင် သူ့ဘာသာ ပြန်ချိန်ညှိတယ်", async () => {
  let head = 3;
  let clock = 0;
  const client = {
    async getTransactionCount() {
      return head;
    },
  };
  const n = createNonceManager(client, "0xabc", { syncMs: 1000, now: () => clock });
  assert.equal(await n.next(), 3);
  head = 100;
  clock = 500;
  assert.equal(await n.next(), 4, "၁ စက္ကန့် မကျော်သေးလို့ cache ကို သုံးရမယ်");
  clock = 2000;
  assert.equal(await n.next(), 100);
});

// ── W3.4 · Gas guard ───────────────────────────────────────────────────────
test("gas: ဈေးကြီးနေရင် မပို့ဘဲ RetryLater နဲ့ ငြင်းတယ်", async () => {
  const client = {
    async estimateFeesPerGas() {
      return { maxFeePerGas: 900_000_000n, maxPriorityFeePerGas: 1n };
    },
  };
  const wallet = {
    async writeContract() {
      throw new Error("ပို့မိသွားတယ် — gas guard က မတားဘူး");
    },
  };
  await assert.rejects(() => sendWithGasGuard(client, wallet, {}), RetryLater);
});

test("gas: ဈေးမကြီးရင် ခန့်မှန်းချက်ထက် ၂၀% တိုးပြီး ပို့တယ်", async () => {
  const client = {
    async estimateFeesPerGas() {
      return { maxFeePerGas: 100_000_000n, maxPriorityFeePerGas: 1_000_000n };
    },
  };
  let sent = null;
  const wallet = {
    async writeContract(p) {
      sent = p;
      return "0xhash";
    },
  };
  const hash = await sendWithGasGuard(client, wallet, { nonce: 4 });
  assert.equal(hash, "0xhash");
  assert.equal(sent.maxFeePerGas, 120_000_000n);
  assert.equal(sent.nonce, 4, "nonce က ပျောက်သွားတယ်");
});

// ── W3.2 · Confirmation ────────────────────────────────────────────────────
const SENT_ROW = [{ id: 1, tx_hash: "0xaa", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }];

test("confirm: confirmation မလုံလောက်ရင် confirmed မလုပ်ရ (reorg ကာကွယ်)", async () => {
  const db = fakeDb({ "FROM mv_mint_queue WHERE status = 'sent'": SENT_ROW });
  const client = {
    async getTransactionReceipt() {
      return { status: "success", blockNumber: 100n };
    },
    async getBlockNumber() {
      return 101n; // confirmation ၁ ခုပဲ
    },
  };
  const r = await mintQueue.confirmPending(db, client);
  assert.deepEqual(r, { confirmed: 0, waiting: 1, reverted: 0, dropped: 0 });
  assert.ok(
    !db.calls.some((c) => c.sql.includes("status = 'confirmed'")),
    "confirmation မလုံလောက်ဘဲ confirmed လုပ်လိုက်တယ်",
  );
});

test("confirm: confirmation ၃ ခု ရရင် confirmed ဖြစ်တယ်", async () => {
  const db = fakeDb({ "FROM mv_mint_queue WHERE status = 'sent'": SENT_ROW });
  const client = {
    async getTransactionReceipt() {
      return { status: "success", blockNumber: 100n };
    },
    async getBlockNumber() {
      return 103n;
    },
  };
  const r = await mintQueue.confirmPending(db, client);
  assert.equal(r.confirmed, 1);
  const update = db.calls.find((c) => c.sql.includes("status = 'confirmed'"));
  assert.ok(update, "confirmed update မလုပ်ဘူး");
  assert.equal(update.params[0], "100", "block_number မှတ်မထားဘူး");
});

test("confirm: revert ဖြစ်ရင် pending ပြန်ဖြစ်ပြီး tx_hash ကို ရှင်းတယ်", async () => {
  const db = fakeDb({ "FROM mv_mint_queue WHERE status = 'sent'": SENT_ROW });
  const client = {
    async getTransactionReceipt() {
      return { status: "reverted", blockNumber: 100n };
    },
    async getBlockNumber() {
      return 200n;
    },
  };
  const r = await mintQueue.confirmPending(db, client);
  assert.equal(r.reverted, 1);
  const update = db.calls.find((c) => c.sql.includes("'reverted on-chain'"));
  assert.ok(update, "revert ကို pending ပြန်မလုပ်ဘူး");
  // ★ tx_hash မရှင်းရင် နောက်တစ်ခေါက် ပို့တဲ့အခါ unique index က ငြင်းမယ်
  assert.ok(update.sql.includes("tx_hash = NULL"));
});

test("confirm: mempool မှာ မတွေ့ရင် ချက်ချင်း မလုပ်ဘဲ ၁၀ မိနစ် စောင့်တယ်", async () => {
  const fresh = [{ id: 1, tx_hash: "0xaa", created_at: "2026-08-02T00:00:00Z", updated_at: "2026-08-02T00:00:00Z" }];
  const client = {
    async getTransactionReceipt() {
      throw new Error("TransactionReceiptNotFoundError");
    },
    async getBlockNumber() {
      return 200n;
    },
  };

  // ★ ၂ မိနစ်သာ ကျော်သေးရင် — ပို့ပြီးသား tx ကို ထပ်ပို့ရင် ၂ ခါ
  //   mint ဖြစ်မယ်။
  const early = fakeDb({ "FROM mv_mint_queue WHERE status = 'sent'": fresh });
  const r1 = await mintQueue.confirmPending(early, client, {
    now: () => Date.parse("2026-08-02T00:02:00Z"),
  });
  assert.deepEqual(r1, { confirmed: 0, waiting: 1, reverted: 0, dropped: 0 });

  // ★ ၁၅ မိနစ် ကျော်ပြီ — တကယ် ပျောက်သွားပြီ၊ ပြန်ပို့ရမယ်။
  const late = fakeDb({ "FROM mv_mint_queue WHERE status = 'sent'": fresh });
  const r2 = await mintQueue.confirmPending(late, client, {
    now: () => Date.parse("2026-08-02T00:15:00Z"),
  });
  assert.equal(r2.dropped, 1);
  assert.ok(late.calls.some((c) => c.sql.includes("'dropped from mempool'")));
});

// ── W3 · Retry / failed ────────────────────────────────────────────────────
test("retry: အကြိမ်ရေ ကုန်ရင် failed၊ မကုန်ရင် pending", async () => {
  const db1 = fakeDb();
  const s1 = await mintQueue.markRetry(db1, { id: 1, attempts: 2 }, new Error("boom"), {
    maxAttempts: 5,
  });
  assert.equal(s1, "pending");

  const db2 = fakeDb();
  const s2 = await mintQueue.markRetry(db2, { id: 1, attempts: 5 }, new Error("boom"), {
    maxAttempts: 5,
  });
  assert.equal(s2, "failed");
  assert.equal(db2.calls[0].params[0], "failed");
});

test("retry: gas ဈေးကြီးတာက အမှား မဟုတ်လို့ အကြိမ်ရေ မတက်ရ", async () => {
  const db = fakeDb();
  const status = await mintQueue.markRetry(
    db,
    { id: 1, attempts: 5 },
    new RetryLater("gas ကြီးတယ်"),
    { maxAttempts: 5 },
  );
  assert.equal(status, "pending", "gas ကြီးလို့ job ကို failed လုပ်ပစ်တယ်");
  assert.ok(db.calls[0].sql.includes("GREATEST(attempts - 1, 0)"));
});

// ── W4 · Indexer ───────────────────────────────────────────────────────────
test("indexer: restart ပြီးရင် အစကနေ ပြန်မဖတ်ဘူး", async () => {
  const db = fakeDb({ "SELECT last_block": [{ last_block: "5000" }] });
  let asked = null;
  const client = {
    async getBlockNumber() {
      return 9000n;
    },
    async getLogs(args) {
      asked = args;
      return [];
    },
  };
  const r = await indexer.syncContract(db, client, {
    contract: "0xLAND",
    kind: "erc721",
    deployBlock: 1,
  });
  assert.equal(asked.fromBlock, 5001n, "မှတ်ထားတဲ့ block ကနေ ဆက်မဖတ်ဘူး");
  assert.equal(r.to, 7001n);
});

test("indexer: reorg buffer ၁၂ block ကို မဖတ်ဘူး", async () => {
  const db = fakeDb({ "SELECT last_block": [{ last_block: "100" }] });
  let asked = null;
  const client = {
    async getBlockNumber() {
      return 110n;
    },
    async getLogs(args) {
      asked = args;
      return [];
    },
  };
  const r = await indexer.syncContract(db, client, { contract: "0xL", kind: "erc721" });
  // safeHead = 110 - 12 = 98 < from(101) → ဘာမှ မဖတ်ရ
  assert.equal(r, null, "reorg buffer ထဲက block တွေကို ဖတ်နေတယ်");
  assert.equal(asked, null);
});

test("indexer: ERC-721 Transfer က ပိုင်ရှင် ပြောင်းတယ် (lowercase)", async () => {
  const db = fakeDb({ "SELECT last_block": [{ last_block: "0" }] });
  const client = {
    async getBlockNumber() {
      return 1000n;
    },
    async getLogs() {
      return [
        {
          eventName: "Transfer",
          blockNumber: 500n,
          logIndex: 0,
          args: { from: indexer.ZERO, to: "0xAbCdEf0000000000000000000000000000000001", tokenId: 167n },
        },
      ];
    },
  };
  await indexer.syncContract(db, client, { contract: "0xLAND", kind: "erc721" });
  const insert = db.calls.find((c) => c.sql.includes("INSERT INTO web3_nft_owners"));
  assert.ok(insert, "ပိုင်ရှင် မသိမ်းဘူး");
  assert.equal(insert.params[2], "0xabcdef0000000000000000000000000000000001");
  assert.equal(insert.params[1], "167");
  // ★ block အဟောင်းက အသစ်ကို မဖျက်စေရ
  assert.ok(insert.sql.includes("WHERE web3_nft_owners.block_number <= EXCLUDED.block_number"));
});

test("indexer: ERC-1155 mint မှာ zero address ကို မလျှော့ဘူး", async () => {
  const db = fakeDb();
  await indexer.applyErc1155(db, "0xitems", 3n, indexer.ZERO, "0xUSER", 2n, 10n);
  assert.equal(
    db.calls.filter((c) => c.sql.includes("UPDATE web3_balances")).length,
    0,
    "mint မှာ zero address ရဲ့ လက်ကျန်ကို လျှော့နေတယ်",
  );
  assert.ok(db.calls.some((c) => c.sql.includes("INSERT INTO web3_balances")));
});

test("indexer: ERC-1155 burn မှာ zero address ကို မတိုးဘူး", async () => {
  const db = fakeDb();
  await indexer.applyErc1155(db, "0xitems", 3n, "0xUSER", indexer.ZERO, 2n, 10n);
  assert.ok(db.calls.some((c) => c.sql.includes("UPDATE web3_balances")));
  assert.equal(
    db.calls.filter((c) => c.sql.includes("INSERT INTO web3_balances")).length,
    0,
    "burn မှာ zero address ဆီ လက်ကျန် တိုးပေးနေတယ်",
  );
});

test("indexer: log မှားရင် last_block ကို မတိုးဘူး (rollback)", async () => {
  const db = {
    calls: [],
    async query(sql, params = []) {
      this.calls.push(sql.replace(/\s+/g, " ").trim());
      if (sql.includes("SELECT last_block")) return { rows: [{ last_block: "0" }] };
      if (sql.includes("INSERT INTO web3_nft_owners")) throw new Error("disk full");
      return { rows: [] };
    },
  };
  const client = {
    async getBlockNumber() {
      return 1000n;
    },
    async getLogs() {
      return [{ eventName: "Transfer", blockNumber: 5n, logIndex: 0, args: { from: indexer.ZERO, to: "0x1", tokenId: 1n } }];
    },
  };
  await assert.rejects(() => indexer.syncContract(db, client, { contract: "0xL", kind: "erc721" }));
  assert.ok(db.calls.includes("ROLLBACK"), "rollback မလုပ်ဘူး");
  assert.ok(
    !db.calls.some((c) => c.includes("INSERT INTO web3_sync_state")),
    "log မသိမ်းရဘဲ last_block တက်သွားရင် အဲဒီ log တွေ ထာဝရ ပျောက်မယ်",
  );
});

test("indexer: နောက်ကျနေရင် fresh မဟုတ်ဘူး (RPC fallback)", async () => {
  const stale = fakeDb({ "SELECT updated_at": [{ updated_at: "2026-08-02T00:00:00Z" }] });
  const fresh = fakeDb({ "SELECT updated_at": [{ updated_at: "2026-08-02T00:00:00Z" }] });
  const none = fakeDb({});

  assert.equal(
    await indexer.isFresh(stale, "0xL", { now: () => Date.parse("2026-08-02T00:10:00Z") }),
    false,
  );
  assert.equal(
    await indexer.isFresh(fresh, "0xL", { now: () => Date.parse("2026-08-02T00:02:00Z") }),
    true,
  );
  assert.equal(await indexer.isFresh(none, "0xL"), false, "sync state မရှိရင် မယုံရ");
});
