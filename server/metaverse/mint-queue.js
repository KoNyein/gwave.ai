"use strict";

/// Phase W3 — mint queue ရဲ့ transaction lifecycle။
///
/// ★ **ဒီ file ရဲ့ အဓိကအချက်** — `sent` က *"chain ဆီ ပို့လိုက်ပြီ"* ပဲ
///   ဆိုလိုတယ်၊ *"အောင်မြင်ပြီ"* မဟုတ်ဘူး။ Transaction က —
///     · revert ဖြစ်နိုင် (contract က ငြင်းတာ)
///     · mempool ကနေ ပျောက်နိုင် (gas နည်းလို့ node တွေက ပစ်ချတာ)
///     · reorg မှာ ပြန်ထွက်သွားနိုင် (block တစ်ခု ပယ်ဖျက်ခံရတာ)
///   `sent` မှာ ရပ်ထားရင် အထက်ပါ ၃ ခုလုံးမှာ user က ပစ္စည်း မရဘဲ
///   "ရပြီ" လို့ ပြနေမယ်။
/// ★ `status` က တစ်ခုတည်းသော အမှန်တရား မဟုတ်ဘူး — **`mv_inventory`
///   (RDS) က source of truth**၊ chain က mirror ပဲ။ Mint ကျရှုံးလည်း
///   user ရဲ့ ပစ္စည်း မပျောက်ဘူး။
/// ★ Function တိုင်းက `db` (query() ရှိတဲ့ object) ကို ခေါ်သူဆီက
///   လက်ခံတယ် — စမ်းသပ်မှုမှာ အတု ထည့်လို့ရအောင်။

const CONFIRMATIONS = 3; // ★ Base မှာ block ~2s — 3 confirmation ≈ 6s
const DROP_AFTER_MS = 10 * 60 * 1000; // mempool ထဲ မတွေ့တာ ၁၀ မိနစ် = ပျောက်ပြီ
const MAX_ATTEMPTS = 5;
const BATCH = 20;

/// ပို့ဖို့ အဆင်သင့်ဖြစ်နေတဲ့ job တွေ ဆွဲထုတ်တယ်။
///
/// ★ `FOR UPDATE SKIP LOCKED` — worker ၂ ခု (deploy overlap စတာမျိုး)
///   တစ်ပြိုင်နက် run မိရင် တစ်ခုတည်းသော job ကို ၂ ခါ မပို့စေရ။
/// ★ `attempts` ကို ဒီမှာတင် တိုးတယ် — ပို့တဲ့အဆင့်မှာ crash ဖြစ်ရင်
///   အဲဒီ job က အကြိမ်ရေ မတက်ဘဲ ထာဝရ ပြန်ကြိုးစားနေမယ်။
async function claimPending(db, opts = {}) {
  const limit = opts.limit ?? BATCH;
  const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;
  const { rows } = await db.query(
    `UPDATE mv_mint_queue q
        SET attempts = q.attempts + 1, updated_at = now()
      WHERE q.id IN (
              SELECT id FROM mv_mint_queue
               WHERE status = 'pending' AND attempts < $2
               ORDER BY created_at
               LIMIT $1
                 FOR UPDATE SKIP LOCKED)
      RETURNING *`,
    [limit, maxAttempts],
  );
  return rows;
}

async function markSent(db, id, txHash, nonce) {
  await db.query(
    `UPDATE mv_mint_queue
        SET status = 'sent', tx_hash = $1, nonce = $2,
            last_error = NULL, updated_at = now()
      WHERE id = $3`,
    [txHash, nonce, id],
  );
}

/// ပို့လို့ မရဘူး — အကြိမ်ရေ ကုန်ရင် `failed`၊ မကုန်ရင် `pending` ပြန်ထား။
///
/// ★ `RetryLater` (gas ဈေးကြီးတာ) က အမှား မဟုတ်လို့ attempts ကို
///   ပြန်လျှော့ပေးတယ် — မဟုတ်ရင် gas ကြီးတဲ့ တစ်နာရီအတွင်း job တွေ
///   အားလုံး `failed` ဖြစ်ကုန်မယ်။
async function markRetry(db, job, err, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;
  const message = String(err?.message ?? err).slice(0, 400);

  if (err?.retryable) {
    await db.query(
      `UPDATE mv_mint_queue
          SET status = 'pending', attempts = GREATEST(attempts - 1, 0),
              last_error = $1, updated_at = now()
        WHERE id = $2`,
      [message, job.id],
    );
    return "pending";
  }

  const exhausted = job.attempts >= maxAttempts;
  await db.query(
    `UPDATE mv_mint_queue
        SET status = $1, last_error = $2, updated_at = now()
      WHERE id = $3`,
    [exhausted ? "failed" : "pending", message, job.id],
  );
  return exhausted ? "failed" : "pending";
}

/// `sent` job တွေကို chain မှာ စစ်တယ် — W3.2။
///
/// ရလဒ် ၄ မျိုး —
///   confirmed  receipt success + confirmation ၃ ခု ရပြီ
///   waiting    block ထဲ ရောက်ပြီ ဒါပေမယ့် confirmation မလုံလောက်သေး
///   reverted   contract က ငြင်းလိုက်တယ် → pending ပြန်ထား
///   dropped    ၁၀ မိနစ် ကျော်လို့ mempool မှာ မတွေ့တော့ → pending ပြန်ထား
async function confirmPending(db, client, opts = {}) {
  const confirmations = BigInt(opts.confirmations ?? CONFIRMATIONS);
  const dropAfterMs = opts.dropAfterMs ?? DROP_AFTER_MS;
  const limit = opts.limit ?? BATCH;
  const now = opts.now ?? (() => Date.now());

  const { rows } = await db.query(
    `SELECT id, tx_hash, created_at, updated_at
       FROM mv_mint_queue
      WHERE status = 'sent' AND tx_hash IS NOT NULL
      ORDER BY created_at
      LIMIT $1`,
    [limit],
  );

  const result = { confirmed: 0, waiting: 0, reverted: 0, dropped: 0 };

  for (const job of rows) {
    try {
      const receipt = await client.getTransactionReceipt({ hash: job.tx_hash });

      if (receipt.status === "success") {
        // ★ Reorg ကာကွယ်ချက် — block ထဲ ရောက်ရုံနဲ့ မယုံဘူး။ နောက်က
        //   block ၃ ခု ထပ်ပေါ်မှ "ပြန်မထွက်တော့ဘူး" လို့ ယူဆတယ်။
        const head = await client.getBlockNumber();
        if (BigInt(head) - BigInt(receipt.blockNumber) < confirmations) {
          result.waiting += 1;
          continue;
        }
        await db.query(
          `UPDATE mv_mint_queue
              SET status = 'confirmed', block_number = $1,
                  confirmed_at = now(), last_error = NULL, updated_at = now()
            WHERE id = $2`,
          [String(receipt.blockNumber), job.id],
        );
        result.confirmed += 1;
      } else {
        // ★ Revert — chain က လက်ခံပြီး contract က ငြင်းလိုက်တာ။ gas
        //   ကုန်ပြီးသား၊ ဒါပေမယ့် ပစ္စည်း မထွက်ဘူး။ ပြန်ကြိုးစားရမယ်။
        await db.query(
          `UPDATE mv_mint_queue
              SET status = 'pending', tx_hash = NULL, nonce = NULL,
                  last_error = 'reverted on-chain', updated_at = now()
            WHERE id = $1`,
          [job.id],
        );
        result.reverted += 1;
      }
    } catch (err) {
      // ★ `getTransactionReceipt` က tx မတွေ့သေးရင် throw တယ် — ဒါက
      //   ပုံမှန်ပါ (mempool ထဲ ရှိနေသေးတာ)။ ချက်ချင်း မှားတယ်လို့
      //   သတ်မှတ်ရင် ပို့ပြီးသား tx ကို ထပ်ပို့ပြီး ၂ ခါ mint ဖြစ်မယ်။
      const sentAt = Date.parse(job.updated_at ?? job.created_at);
      const age = now() - (Number.isFinite(sentAt) ? sentAt : now());
      if (age > dropAfterMs) {
        await db.query(
          `UPDATE mv_mint_queue
              SET status = 'pending', tx_hash = NULL, nonce = NULL,
                  last_error = 'dropped from mempool', updated_at = now()
            WHERE id = $1`,
          [job.id],
        );
        result.dropped += 1;
      } else {
        result.waiting += 1;
      }
    }
  }

  return result;
}

/// Admin dashboard အတွက် အကျဉ်းချုပ် — W3.5 ရဲ့ "failed ဖြစ်ရင်
/// dashboard မှာ ပေါ်တယ်"။
async function queueSummary(db) {
  const { rows } = await db.query(
    `SELECT status, count(*)::int AS n,
            max(updated_at) AS latest
       FROM mv_mint_queue
      GROUP BY status`,
  );
  const out = { pending: 0, sent: 0, confirmed: 0, failed: 0, cancelled: 0 };
  for (const r of rows) out[r.status] = r.n;
  return { counts: out, rows };
}

module.exports = {
  claimPending,
  markSent,
  markRetry,
  confirmPending,
  queueSummary,
  CONFIRMATIONS,
  DROP_AFTER_MS,
  MAX_ATTEMPTS,
  BATCH,
};
