"use strict";

/// Phase W4 — on-chain event indexer (RDS mirror)။
///
/// ★ **ပြဿနာ** — `ownsLand()` က RPC ကို တိုက်ရိုက် မေးတယ်။ Player ၁၀၀
///   ဝင်ရင် RPC call ၁၀၀။ Provider quota က တစ်လအတွင်း ကုန်ပြီး
///   VIP room က ပိတ်သွားမယ်။
/// ★ **ဖြေရှင်းနည်း** — `Transfer` event ကို ၁၅ စက္ကန့်တစ်ခါ ဖတ်ပြီး
///   RDS မှာ mirror လုပ်တယ်။ ပိုင်ဆိုင်မှုမေးခွန်းတွေက DB ကနေ
///   millisecond နဲ့ ဖြေတယ်၊ RPC လုံးဝ မလိုတော့ဘူး။
/// ★ **Reorg** — chain ရဲ့ နောက်ဆုံး block တွေက ပြန်ပြောင်းနိုင်တယ်။
///   ၁၂ block နောက်ကျပြီးမှ ဖတ်တယ် (Base မှာ ~၂၄ စက္ကန့်)。
/// ★ **Restart** — `web3_sync_state` မှာ ဘယ်အထိ ဖတ်ပြီးပြီလဲ မှတ်တယ်။
///   မဟုတ်ရင် ပြန်စတိုင်း block သန်းချီ ပြန်ဖတ်ပြီး quota ချက်ချင်း ကုန်မယ်။

const REORG_BUFFER = 12n;
const BATCH = 2000n;
const STALE_MS = 5 * 60 * 1000; // ဒီထက်နောက်ကျရင် RPC fallback သုံးရမယ်

/// ERC-721 `Transfer` နဲ့ ERC-1155 `TransferSingle` / `TransferBatch`။
/// ★ ABI တစ်ခုလုံး မလိုဘူး — နားထောင်မယ့် event တွေပဲ။
const EVENTS = {
  erc721: {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
  erc1155single: {
    type: "event",
    name: "TransferSingle",
    inputs: [
      { name: "operator", type: "address", indexed: true },
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "id", type: "uint256", indexed: false },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
  erc1155batch: {
    type: "event",
    name: "TransferBatch",
    inputs: [
      { name: "operator", type: "address", indexed: true },
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "ids", type: "uint256[]", indexed: false },
      { name: "values", type: "uint256[]", indexed: false },
    ],
  },
};

const ZERO = "0x0000000000000000000000000000000000000000";

/// ERC-721 ပိုင်ရှင် တစ်ခု သိမ်းတယ်။
///
/// ★ `WHERE ... block_number <= $4` က မဖြစ်မနေ လိုတယ် — log တွေက
///   အစဉ်လိုက် မလာနိုင်ဘူး (batch ၂ ခု ထပ်နေတာမျိုး)。 အဟောင်းက
///   အသစ်ကို ဖျက်လိုက်ရင် ပိုင်ရှင် မှားသွားမယ်။
async function applyErc721(db, contract, tokenId, to, blockNumber) {
  await db.query(
    `INSERT INTO web3_nft_owners (contract, token_id, owner, block_number)
          VALUES ($1, $2, $3, $4)
     ON CONFLICT (contract, token_id) DO UPDATE
        SET owner = EXCLUDED.owner,
            block_number = EXCLUDED.block_number,
            updated_at = now()
      WHERE web3_nft_owners.block_number <= EXCLUDED.block_number`,
    [contract, String(tokenId), String(to).toLowerCase(), String(blockNumber)],
  );
}

/// ERC-1155 လက်ကျန် ရွှေ့တယ် — from ဘက် လျှော့၊ to ဘက် တိုး။
/// ★ Mint (from = 0x0) မှာ လျှော့စရာ မရှိဘူး၊ burn (to = 0x0) မှာ
///   တိုးစရာ မရှိဘူး — ဒါကို မစစ်ရင် zero address က ပိုင်ဆိုင်မှု
///   သန်းချီ ရှိနေသလို ဖြစ်မယ်။
async function applyErc1155(db, contract, tokenId, from, to, value, blockNumber) {
  const amount = BigInt(value);
  if (amount === 0n) return;

  const lowerFrom = String(from).toLowerCase();
  const lowerTo = String(to).toLowerCase();

  if (lowerFrom !== ZERO) {
    await db.query(
      `UPDATE web3_balances
          SET balance = GREATEST(balance - $4, 0), updated_at = now()
        WHERE contract = $1 AND token_id = $2 AND owner = $3`,
      [contract, String(tokenId), lowerFrom, String(amount)],
    );
  }
  if (lowerTo !== ZERO) {
    await db.query(
      `INSERT INTO web3_balances (contract, token_id, owner, balance)
            VALUES ($1, $2, $3, $4)
       ON CONFLICT (contract, token_id, owner) DO UPDATE
          SET balance = web3_balances.balance + EXCLUDED.balance,
              updated_at = now()`,
      [contract, String(tokenId), lowerTo, String(amount)],
    );
  }
  void blockNumber;
}

/// Contract တစ်ခုကို block အပိုင်းတစ်ပိုင်း ဖတ်တယ်။
/// အလုပ်လုပ်စရာ ရှိရင် `{ from, to, logs }`၊ မရှိရင် `null` ပြန်ပေးတယ်။
async function syncContract(db, client, spec) {
  const contract = String(spec.contract).toLowerCase();
  const kind = spec.kind === "erc1155" ? "erc1155" : "erc721";
  const reorgBuffer = BigInt(spec.reorgBuffer ?? REORG_BUFFER);
  const batch = BigInt(spec.batch ?? BATCH);

  const head = BigInt(await client.getBlockNumber());
  if (head < reorgBuffer) return null;
  const safeHead = head - reorgBuffer;

  const { rows } = await db.query(
    `SELECT last_block FROM web3_sync_state WHERE contract = $1`,
    [contract],
  );
  const from = rows.length
    ? BigInt(rows[0].last_block) + 1n
    : BigInt(spec.deployBlock ?? 0);
  if (from > safeHead) return null;

  const to = from + batch > safeHead ? safeHead : from + batch;

  const events =
    kind === "erc721"
      ? [EVENTS.erc721]
      : [EVENTS.erc1155single, EVENTS.erc1155batch];

  const logs = [];
  for (const event of events) {
    const found = await client.getLogs({
      address: contract,
      event,
      fromBlock: from,
      toBlock: to,
    });
    logs.push(...found);
  }
  // ★ Event ၂ မျိုးကို သီးခြားစီ ဖတ်လို့ အစဉ် ရောနေတယ် — block/log
  //   အစဉ်အတိုင်း ပြန်စီမှ လက်ကျန်တွက်ချက်မှု မှန်မယ်。
  logs.sort((a, b) => {
    const d = BigInt(a.blockNumber) - BigInt(b.blockNumber);
    if (d !== 0n) return d > 0n ? 1 : -1;
    return Number(a.logIndex ?? 0) - Number(b.logIndex ?? 0);
  });

  // ★ Transaction — log တွေ ထည့်ပြီး last_block မှတ်တာက **အတူတကွ**
  //   ဖြစ်ရမယ်။ last_block အရင်တက်သွားရင် log တွေ ထာဝရ ပျောက်မယ်၊
  //   log တွေ အရင်ဝင်ပြီး cursor မတက်ရင် နောက်တစ်ခေါက် **ထပ်ရေမယ်** —
  //   ERC-721 က upsert မို့ ဘာမှမဖြစ်ပေမယ့် ERC-1155 က
  //   `balance + amount` မို့ လက်ကျန် ဖောင်းသွားမယ်။
  //
  // ★★ Transaction ကို **connection တစ်ခုတည်း** ပေါ်မှာ ပြေးရမယ်။ pg ရဲ့
  //    Pool.query() က query တစ်ခုချင်းစီအတွက် connection ကို ယူ/ပြန်အပ်လုပ်
  //    တာမို့ pool ပေါ်မှာ BEGIN ခေါ်ရင် — BEGIN က connection တစ်ခုပေါ်၊
  //    INSERT တွေက တခြားတစ်ခုပေါ် (auto-commit)၊ COMMIT က နောက်တစ်ခုပေါ်
  //    ("no transaction in progress") ရောက်သွားတယ်။ atomicity လုံးဝ မရဘဲ
  //    BEGIN ခံထားတဲ့ connection က idle-in-transaction အဖြစ် pool ထဲ
  //    ပြန်ရောက်နေတယ်။ ဒီ file ရဲ့ ခေါ်သူက Pool ကို ပေးတာမို့ ဒါ တကယ်
  //    ဖြစ်နေတာ။ (Advisory lock မှာ ဒီစည်းမျဉ်းကို လိုက်နာထားပြီးသား —
  //    web3-worker.js ရဲ့ lockClient ကို ကြည့်ပါ။)
  // (`client` က viem ရဲ့ RPC client အတွက် သုံးပြီးသားမို့ `tx` လို့ ခေါ်တယ်)
  const tx = typeof db.connect === "function" ? await db.connect() : db;
  const release = tx === db ? () => {} : () => tx.release();
  try {
    await tx.query("BEGIN");
    try {
      for (const log of logs) {
        const a = log.args ?? {};
        if (log.eventName === "Transfer") {
          await applyErc721(tx, contract, a.tokenId, a.to, log.blockNumber);
        } else if (log.eventName === "TransferSingle") {
          await applyErc1155(tx, contract, a.id, a.from, a.to, a.value, log.blockNumber);
        } else if (log.eventName === "TransferBatch") {
          const ids = a.ids ?? [];
          const values = a.values ?? [];
          for (let i = 0; i < ids.length; i++) {
            await applyErc1155(
              tx, contract, ids[i], a.from, a.to, values[i] ?? 0n, log.blockNumber,
            );
          }
        }
      }
      await tx.query(
        `INSERT INTO web3_sync_state (contract, last_block) VALUES ($1, $2)
         ON CONFLICT (contract) DO UPDATE
            SET last_block = EXCLUDED.last_block, updated_at = now()`,
        [contract, String(to)],
      );
      await tx.query("COMMIT");
    } catch (err) {
      // ROLLBACK ကိုယ်တိုင် ကျရှုံးရင်လည်း မူရင်း error ကို မဖုံးရဘူး —
      // အဲဒါက ဘာကြောင့် ကျိုးလဲ ဆိုတာ ပြောပြနိုင်တဲ့ တစ်ခုတည်းသော အရာ။
      await tx.query("ROLLBACK").catch(() => {});
      throw err;
    }
  } finally {
    release();
  }

  return { from, to, logs: logs.length };
}

/// Indexer က နောက်ကျနေလား — ★ နောက်ကျနေရင် DB ကို မယုံဘဲ RPC ကို
/// မေးရမယ်၊ မဟုတ်ရင် အခုပဲ mint လုပ်ထားသူက "မပိုင်ဘူး" ဖြစ်နေမယ်။
async function isFresh(db, contract, opts = {}) {
  const staleMs = opts.staleMs ?? STALE_MS;
  const now = opts.now ?? (() => Date.now());
  const { rows } = await db.query(
    `SELECT updated_at FROM web3_sync_state WHERE contract = $1`,
    [String(contract).toLowerCase()],
  );
  if (!rows.length) return false;
  const at = Date.parse(rows[0].updated_at);
  if (!Number.isFinite(at)) return false;
  return now() - at <= staleMs;
}

async function ownedTokens(db, contract, owner) {
  const { rows } = await db.query(
    `SELECT token_id FROM web3_nft_owners WHERE contract = $1 AND owner = $2`,
    [String(contract).toLowerCase(), String(owner).toLowerCase()],
  );
  return rows.map((r) => Number(r.token_id));
}

async function itemBalance(db, contract, owner, tokenId) {
  const { rows } = await db.query(
    `SELECT balance FROM web3_balances
      WHERE contract = $1 AND owner = $2 AND token_id = $3`,
    [String(contract).toLowerCase(), String(owner).toLowerCase(), String(tokenId)],
  );
  return rows.length ? Number(rows[0].balance) : 0;
}

module.exports = {
  syncContract,
  applyErc721,
  applyErc1155,
  isFresh,
  ownedTokens,
  itemBalance,
  EVENTS,
  REORG_BUFFER,
  BATCH,
  STALE_MS,
  ZERO,
};
