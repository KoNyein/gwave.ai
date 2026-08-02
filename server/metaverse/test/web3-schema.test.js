/// Web3 queries against a real PostgreSQL, not a fake.
///
/// Run (needs a scratch server):
///   TEST_PG_URL=postgres://postgres@/gwave?host=/tmp&port=55433 \
///     node --test test/web3-schema.test.js
///
/// ★ Why this exists on top of web3-lifecycle.test.js: that suite drives the
///   same functions through a `fakeDb` that matches on SQL text. It proves the
///   lifecycle logic — which job is claimed, when a retry lowers attempts,
///   when a confirmation sticks. It cannot prove the SQL runs, because nothing
///   parses it. A column renamed in db/sql/web3.sql, or a query written against
///   a column that was never added, passes every one of those tests and fails
///   the first time a real broadcast hits it.
/// ★ So this one applies db/sql/web3.sql to a real database and runs the real
///   queries against it. It skips when TEST_PG_URL is unset, so it stays out of
///   the way of the normal `npm test`.

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const {
  claimPending,
  markSent,
  markRetry,
  queueSummary,
} = require("../mint-queue.js");
const {
  applyErc721,
  applyErc1155,
  ownedTokens,
  itemBalance,
  syncContract,
} = require("../indexer.js");

const ZERO_ADDR = "0x" + "0".repeat(40);

const URL = process.env.TEST_PG_URL;
const suite = URL ? test : test.skip;

let pool = null;

async function db() {
  if (pool) return pool;
  const { Pool } = require("pg");
  pool = new Pool({ connectionString: URL });
  const sql = fs.readFileSync(
    path.join(__dirname, "..", "..", "..", "db", "sql", "web3.sql"),
    "utf8",
  );
  // The prerequisites the file assumes already exist on RDS.
  await pool.query(`
    create extension if not exists "pgcrypto";
    do $$ begin
      if not exists (select 1 from pg_roles where rolname='service_role')
        then create role service_role; end if;
    end $$;
    create table if not exists public.profiles (
      id uuid primary key default gen_random_uuid()
    );
  `);
  await pool.query(sql);
  await pool.query("truncate public.mv_mint_queue, public.web3_nft_owners, public.web3_balances, public.web3_sync_state");
  return pool;
}

suite("★ the queue's own queries run against the real schema", async () => {
  const d = await db();
  await d.query(
    `insert into public.mv_mint_queue (wallet, kind, token_id, amount, idem_key)
     values ('0xabc', 'land', 42, 1, 'k1')`,
  );

  // claimPending uses FOR UPDATE SKIP LOCKED inside a transaction — the shape
  // most likely to be wrong against a real server, and invisible to a fake.
  const jobs = await claimPending(d);
  assert.equal(jobs.length, 1, "nothing claimed");
  const job = jobs[0];
  assert.equal(job.kind, "land");
  assert.equal(String(job.token_id), "42");

  await markSent(d, job.id, "0x" + "1".repeat(64), 7);
  const { rows } = await d.query(
    "select status, tx_hash, nonce from public.mv_mint_queue where id = $1",
    [job.id],
  );
  assert.equal(rows[0].status, "sent");
  assert.equal(rows[0].nonce, 7);
});

suite("★ a claimed job is not handed out twice", async () => {
  const d = await db();
  await d.query("truncate public.mv_mint_queue");
  await d.query(
    `insert into public.mv_mint_queue (wallet, kind, token_id, idem_key)
     values ('0xabc', 'land', 1, 'only-one')`,
  );
  const [first] = await claimPending(d);
  await markSent(d, first.id, "0x" + "2".repeat(64), 1);
  const second = await claimPending(d);
  // The only job is now `sent`; confirmPending owns it, not claimPending.
  assert.equal(second.length, 0, "a sent job was claimed for sending again");
});

suite("★ the idempotency key really is unique in the database", async () => {
  // The API relies on this to make a double-tap harmless. If the constraint is
  // missing the second insert silently succeeds and the user mints twice.
  const d = await db();
  await d.query("truncate public.mv_mint_queue");
  await d.query(
    `insert into public.mv_mint_queue (wallet, kind, token_id, idem_key)
     values ('0xabc', 'land', 5, 'same-key')`,
  );
  await assert.rejects(
    () =>
      d.query(
        `insert into public.mv_mint_queue (wallet, kind, token_id, idem_key)
         values ('0xabc', 'land', 5, 'same-key')`,
      ),
    /duplicate key/i,
    "idem_key is not unique — a double-tap would mint twice",
  );
});

suite("★ an invalid status cannot be written", async () => {
  const d = await db();
  await assert.rejects(
    () =>
      d.query(
        `insert into public.mv_mint_queue (wallet, kind, status, idem_key)
         values ('0xabc', 'land', 'nonsense', 'bad-status')`,
      ),
    /violates check constraint/i,
  );
});

suite("retry bookkeeping survives a round trip", async () => {
  const d = await db();
  await d.query("truncate public.mv_mint_queue");
  await d.query(
    `insert into public.mv_mint_queue (wallet, kind, token_id, idem_key)
     values ('0xabc', 'land', 9, 'retry-me')`,
  );
  const [job] = await claimPending(d);
  await markRetry(d, job, new Error("rpc exploded"));
  const { rows } = await d.query(
    "select status, attempts, last_error from public.mv_mint_queue where id = $1",
    [job.id],
  );
  assert.equal(rows[0].status, "pending");
  assert.equal(rows[0].attempts, 1);
  assert.match(rows[0].last_error, /rpc exploded/);
});

suite("queueSummary counts what the health endpoint reports", async () => {
  const d = await db();
  await d.query("truncate public.mv_mint_queue");
  await d.query(
    `insert into public.mv_mint_queue (wallet, kind, status, idem_key) values
       ('0xa','land','pending','s1'),
       ('0xa','land','sent','s2'),
       ('0xa','land','confirmed','s3'),
       ('0xa','land','failed','s4')`,
  );
  const { counts } = await queueSummary(d);
  assert.equal(counts.pending, 1);
  assert.equal(counts.sent, 1);
  assert.equal(counts.confirmed, 1);
  assert.equal(counts.failed, 1);
});

suite("★ the ERC-721 mirror upserts by token and never goes backwards", async () => {
  const d = await db();
  await d.query("truncate public.web3_nft_owners");
  const contract = "0x" + "c".repeat(40);
  await applyErc721(d, contract, 1n, "0xAAA", 100n);
  assert.deepEqual(await ownedTokens(d, contract, "0xaaa"), [1]);

  // A later block moves it.
  await applyErc721(d, contract, 1n, "0xBBB", 200n);
  assert.deepEqual(await ownedTokens(d, contract, "0xaaa"), []);
  assert.deepEqual(await ownedTokens(d, contract, "0xbbb"), [1]);

  // ★ A replayed older event must not resurrect the old owner. This is the
  //   whole reason the write carries `where block_number <= excluded` — a
  //   reorg re-scan replays blocks, and without the guard the mirror would
  //   hand the token back to whoever held it first.
  await applyErc721(d, contract, 1n, "0xAAA", 100n);
  assert.deepEqual(
    await ownedTokens(d, contract, "0xbbb"),
    [1],
    "an older replayed event overwrote a newer owner",
  );
});

suite("★ ERC-1155 balances add and subtract, and never go negative", async () => {
  const d = await db();
  await d.query("truncate public.web3_balances");
  const contract = "0x" + "d".repeat(40);
  const ZERO = "0x" + "0".repeat(40);
  await applyErc1155(d, contract, 7n, ZERO, "0xAAA", 5n, 10n);
  assert.equal(await itemBalance(d, contract, "0xaaa", 7), 5);

  await applyErc1155(d, contract, 7n, "0xAAA", "0xBBB", 2n, 11n);
  assert.equal(await itemBalance(d, contract, "0xaaa", 7), 3);
  assert.equal(await itemBalance(d, contract, "0xbbb", 7), 2);

  // Burn back to the zero address.
  await applyErc1155(d, contract, 7n, "0xBBB", ZERO, 2n, 12n);
  assert.equal(await itemBalance(d, contract, "0xbbb", 7), 0);
  const { rows } = await d.query(
    "select count(*)::int as n from public.web3_balances where balance < 0",
  );
  assert.equal(rows[0].n, 0, "a balance went negative");
});

test.after(async () => {
  if (pool) await pool.end();
});

// ── The transaction ─────────────────────────────────────────────────────
//
// ★ syncContract writes the logs and advances the cursor together, and the
//   whole design leans on that: if the cursor moves without the logs the
//   events are lost forever, and if the logs land without the cursor the next
//   pass replays them — harmless for ERC-721 (an upsert) and not at all
//   harmless for ERC-1155, where the write is `balance + amount`.
// ★ This test exists because the transaction was opened on the *pool*.
//   node-postgres hands out a connection per query, so BEGIN landed on one
//   connection, the inserts auto-committed on others, and COMMIT arrived
//   somewhere with no transaction in progress — no atomicity at all, and the
//   BEGIN connection went back to the pool idle-in-transaction. It passed
//   every fake-database test, because nothing in a fake has connections.

/// A viem-shaped client that returns canned logs.
function fakeChain(head, logs) {
  return {
    getBlockNumber: async () => head,
    getLogs: async ({ event }) =>
      logs.filter((l) => l.eventName === event.name),
  };
}

suite("★ a failure mid-batch rolls back the whole batch", async () => {
  const d = await db();
  await d.query("truncate public.web3_nft_owners, public.web3_sync_state");
  const contract = "0x" + "e".repeat(40);

  // The second log carries a token id the database cannot store, so the
  // batch fails after the first has already been written.
  const chain = fakeChain(1000n, [
    {
      eventName: "Transfer",
      blockNumber: 10n,
      logIndex: 0,
      args: { tokenId: 1n, to: "0xAAA", from: ZERO_ADDR },
    },
    {
      eventName: "Transfer",
      blockNumber: 11n,
      logIndex: 0,
      args: { tokenId: "not-a-number", to: "0xBBB", from: ZERO_ADDR },
    },
  ]);

  await assert.rejects(() =>
    syncContract(d, chain, { contract, kind: "erc721", deployBlock: 0 }),
  );

  // ★ Both halves must be undone. The first token must not be owned by
  //   anyone, and the cursor must not have moved.
  assert.deepEqual(
    await ownedTokens(d, contract, "0xaaa"),
    [],
    "the first write survived a failed batch — the transaction is not real",
  );
  const { rows } = await d.query(
    "select last_block from public.web3_sync_state where contract = $1",
    [contract],
  );
  assert.equal(rows.length, 0, "the cursor advanced through a failed batch");
});

suite("★ a successful batch commits the logs and the cursor together", async () => {
  const d = await db();
  await d.query("truncate public.web3_nft_owners, public.web3_sync_state");
  const contract = "0x" + "f".repeat(40);
  const chain = fakeChain(1000n, [
    {
      eventName: "Transfer",
      blockNumber: 10n,
      logIndex: 0,
      args: { tokenId: 3n, to: "0xCCC", from: ZERO_ADDR },
    },
  ]);
  const result = await syncContract(d, chain, {
    contract,
    kind: "erc721",
    deployBlock: 0,
  });
  assert.ok(result, "nothing synced");
  assert.deepEqual(await ownedTokens(d, contract, "0xccc"), [3]);
  const { rows } = await d.query(
    "select last_block from public.web3_sync_state where contract = $1",
    [contract],
  );
  assert.equal(rows.length, 1, "the cursor was not written");
  assert.equal(String(rows[0].last_block), String(1000n - 12n));
});

// ★ The two tests above pass on the broken code as well, and it is worth
//   saying why rather than leaving a false sense of coverage.
//   node-postgres returns a connection to the pool after every query and an
//   idle pool hands the same one straight back, so a lone sync lands every
//   query on one connection and behaves atomically by luck. The failure needs
//   another query to take that connection in the microseconds between BEGIN
//   and the next statement — real under load, not reproducible on demand.
//
//   Verified directly against this server: with three queries in flight,
//   BEGIN / insert / ROLLBACK issued on a pool left the row committed and one
//   connection stuck `idle in transaction`. The insert had escaped to another
//   connection and auto-committed there.
//
//   Since the race cannot be timed reliably, the invariant is pinned instead:
//   the transaction must be issued on a connection checked out for it. That is
//   deterministic, and it is exactly what was wrong.
test("★★ the transaction is issued on one checked-out connection, not the pool", async () => {
  const calls = [];
  let released = false;

  const dedicated = {
    query: async (sql) => {
      calls.push(["client", String(sql).trim().split(/\s+/)[0].toUpperCase()]);
      return { rows: [] };
    },
    release: () => {
      released = true;
    },
  };
  const fakePool = {
    connect: async () => dedicated,
    query: async (sql) => {
      calls.push(["pool", String(sql).trim().split(/\s+/)[0].toUpperCase()]);
      return { rows: [] };
    },
  };

  await syncContract(
    fakePool,
    fakeChain(1000n, [
      {
        eventName: "Transfer",
        blockNumber: 10n,
        logIndex: 0,
        args: { tokenId: 1n, to: "0xAAA", from: ZERO_ADDR },
      },
    ]),
    { contract: "0x" + "9".repeat(40), kind: "erc721", deployBlock: 0 },
  );

  const onPool = calls.filter(([who]) => who === "pool").map(([, verb]) => verb);
  const onClient = calls.filter(([who]) => who === "client").map(([, verb]) => verb);

  // Reading the cursor on the pool is fine and deliberate — it happens before
  // the RPC round trip, and holding a connection across the network would be
  // wasteful. What must never be on the pool is the transaction.
  for (const verb of ["BEGIN", "COMMIT", "ROLLBACK", "INSERT"]) {
    assert.ok(
      !onPool.includes(verb),
      `${verb} was issued on the pool — it can land on a different connection ` +
        "than the rest of the transaction",
    );
  }
  assert.equal(onClient[0], "BEGIN", "the transaction did not open on the client");
  assert.equal(onClient.at(-1), "COMMIT", "the transaction did not commit on the client");
  assert.ok(onClient.includes("INSERT"), "the writes did not go to the client");
  assert.ok(released, "the connection was never released back to the pool");
});

test("★ the connection is released even when the batch fails", async () => {
  let released = false;
  const dedicated = {
    query: async (sql) => {
      if (String(sql).startsWith("INSERT INTO web3_nft_owners")) {
        throw new Error("boom");
      }
      return { rows: [] };
    },
    release: () => {
      released = true;
    },
  };
  const fakePool = {
    connect: async () => dedicated,
    query: async () => ({ rows: [] }),
  };

  await assert.rejects(() =>
    syncContract(
      fakePool,
      fakeChain(1000n, [
        {
          eventName: "Transfer",
          blockNumber: 10n,
          logIndex: 0,
          args: { tokenId: 1n, to: "0xAAA", from: ZERO_ADDR },
        },
      ]),
      { contract: "0x" + "8".repeat(40), kind: "erc721", deployBlock: 0 },
    ),
  );
  assert.ok(released, "a failed batch leaked its connection");
});

suite("★ the pool is not left holding an open transaction", async () => {
  // The broken version leaked a connection stuck in `idle in transaction`
  // after every batch, which holds locks and eventually exhausts the pool.
  const d = await db();
  const { rows } = await d.query(
    `select count(*)::int as n from pg_stat_activity
      where datname = current_database() and state = 'idle in transaction'`,
  );
  assert.equal(rows[0].n, 0, "a connection was left idle in transaction");
});
