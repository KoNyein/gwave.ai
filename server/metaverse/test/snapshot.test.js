"use strict";

/// Snapshot netcode (Arena spec A5) ရဲ့ acceptance criteria。
///
/// ★ Bandwidth test က ခန့်မှန်းချက် မဟုတ်ဘူး — တကယ့် JSON byte ကို
///   တိုင်းတာ။ "၃၀ KB/s အောက်" ဆိုတဲ့ စည်းက ဒါမှ တကယ့် စည်း ဖြစ်တယ်။

const test = require("node:test");
const assert = require("node:assert/strict");

const s = require("../snapshot");

function player(id, x, z, extra = {}) {
  return { id, x, y: 0, z, ry: 0, ...extra };
}

// ── Input queue နဲ့ ack ──────────────────────────────────────────────────

test("inputs are acked in order", () => {
  const q = s.createInputQueue();
  s.pushInput(q, { seq: 1, yaw: 0 });
  s.pushInput(q, { seq: 2, yaw: 1 });
  const drained = s.drainInputs(q);
  assert.deepEqual(drained.map((c) => c.seq), [1, 2]);
  assert.equal(q.lastSeq, 2);
});

test("out-of-order inputs are sorted before use", () => {
  // ★ UDP မဟုတ်ပေမယ့် message တွေက event loop အရ ရောနိုင်တယ်။
  const q = s.createInputQueue();
  s.pushInput(q, { seq: 3 });
  s.pushInput(q, { seq: 1 });
  s.pushInput(q, { seq: 2 });
  assert.deepEqual(s.drainInputs(q).map((c) => c.seq), [1, 2, 3]);
});

test("a replayed input is dropped", () => {
  // ★ အဟောင်းကို ပြန်သုံးရင် ကစားသမား နောက်ပြန်ခုန်တယ် — ပြီးတော့
  //   ဒါက အလွယ်ဆုံး cheat တစ်ခု (ရွေ့ပြီးသား input ကို ထပ်ပို့တာ)。
  const q = s.createInputQueue();
  s.pushInput(q, { seq: 5 });
  s.drainInputs(q);
  assert.equal(s.pushInput(q, { seq: 5 }), false);
  assert.equal(s.pushInput(q, { seq: 4 }), false);
  assert.equal(s.pushInput(q, { seq: 6 }), true);
});

test("a malformed seq is rejected", () => {
  const q = s.createInputQueue();
  for (const bad of [undefined, null, NaN, "abc", Infinity, {}]) {
    assert.equal(s.pushInput(q, { seq: bad }), false, String(bad));
  }
});

test("the pending queue is bounded", () => {
  // ★ ပြတ်နေတဲ့ client တစ်ယောက်က server ရဲ့ memory ကို ကုန်စေလို့ မရရ။
  const q = s.createInputQueue();
  for (let i = 1; i <= 500; i++) s.pushInput(q, { seq: i }, 64);
  assert.equal(q.pending.length, 64);
  const drained = s.drainInputs(q);
  assert.equal(drained[drained.length - 1].seq, 500, "the newest input survives");
});

test("draining an empty queue does not move the ack", () => {
  const q = s.createInputQueue();
  s.pushInput(q, { seq: 9 });
  s.drainInputs(q);
  assert.deepEqual(s.drainInputs(q), []);
  assert.equal(q.lastSeq, 9);
});

// ── ★ Interest management ────────────────────────────────────────────────

test("players beyond the visible radius are not sent at all", () => {
  const me = player("me", 0, 0);
  const near = player("near", 10, 0);
  const far = player("far", 100, 0);
  const snap = s.buildSnapshot(me, [me, near, far], 1);
  const ids = snap.players.map((p) => p.id);
  assert.deepEqual(ids.sort(), ["me", "near"]);
});

test("the radius boundary is inclusive", () => {
  const me = player("me", 0, 0);
  const edge = player("edge", s.VISIBLE_RADIUS, 0);
  const past = player("past", s.VISIBLE_RADIUS + 0.01, 0);
  const snap = s.buildSnapshot(me, [me, edge, past], 1);
  assert.deepEqual(snap.players.map((p) => p.id).sort(), ["edge", "me"]);
});

test("you always see yourself, however far from the origin", () => {
  // ★ ကိုယ့်ကိုယ်ကို မပါရင် client က server နေရာကို ဘယ်တော့မှ မသိဘူး —
  //   reconciliation က လုံးဝ အလုပ်မလုပ်တော့ဘူး။
  const me = player("me", 500, 500);
  const snap = s.buildSnapshot(me, [me], 1);
  assert.equal(snap.players.length, 1);
  assert.equal(snap.players[0].id, "me");
});

test("distance is measured on the ground plane, not through height", () => {
  const me = player("me", 0, 0);
  const above = { ...player("above", 5, 0), y: 300 };
  const snap = s.buildSnapshot(me, [me, above], 1);
  assert.equal(snap.players.length, 2, "someone on a tower directly above is still visible");
});

test("the snapshot carries the ack so the client can reconcile", () => {
  const me = player("me", 0, 0);
  const snap = s.buildSnapshot(me, [me], 42, { ackSeq: 17 });
  assert.equal(snap.t, 42);
  assert.equal(snap.ackSeq, 17);
});

test("positions are quantised to two decimals", () => {
  const me = player("me", 1.23456789, 9.87654321);
  const snap = s.buildSnapshot(me, [me], 1);
  assert.equal(snap.players[0].x, 1.23);
  assert.equal(snap.players[0].z, 9.88);
});

test("the state field is omitted when empty", () => {
  const me = player("me", 0, 0);
  assert.equal("st" in s.buildSnapshot(me, [me], 1).players[0], false);
  const dead = player("me", 0, 0, { st: 2 });
  assert.equal(s.buildSnapshot(dead, [dead], 1).players[0].st, 2);
});

// ── Delta ────────────────────────────────────────────────────────────────

test("an unchanged player is dropped from the next delta", () => {
  const prev = new Map();
  const me = player("me", 0, 0);
  const other = player("other", 5, 5);

  const first = s.diffSnapshot(prev, s.buildSnapshot(me, [me, other], 1));
  assert.equal(first.players.length, 2);

  const second = s.diffSnapshot(prev, s.buildSnapshot(me, [me, other], 2));
  assert.equal(second.players.length, 0, "nobody moved, so nothing is sent");
});

test("a moved player reappears in the delta", () => {
  const prev = new Map();
  const me = player("me", 0, 0);
  const other = player("other", 5, 5);
  s.diffSnapshot(prev, s.buildSnapshot(me, [me, other], 1));

  other.x = 6;
  const d = s.diffSnapshot(prev, s.buildSnapshot(me, [me, other], 2));
  assert.deepEqual(d.players.map((p) => p.id), ["other"]);
});

test("someone leaving the bubble is announced, not silently forgotten", () => {
  // ★ ဒါမပါရင် client မှာ ငြိမ်ရပ်နေတဲ့ ဂိုးစ် ကျန်နေပြီး၊ ကစားသမားက
  //   မရှိတော့တဲ့သူကို ပစ်နေမယ်။
  const prev = new Map();
  const me = player("me", 0, 0);
  const other = player("other", 5, 5);
  s.diffSnapshot(prev, s.buildSnapshot(me, [me, other], 1));

  other.x = 999;
  const d = s.diffSnapshot(prev, s.buildSnapshot(me, [me, other], 2));
  assert.deepEqual(d.gone, ["other"]);
});

test("no gone field when nobody left", () => {
  const prev = new Map();
  const me = player("me", 0, 0);
  const d = s.diffSnapshot(prev, s.buildSnapshot(me, [me], 1));
  assert.equal("gone" in d, false);
});

// ── ★ Bandwidth acceptance criterion ─────────────────────────────────────

test("12 players stay well under 30 KB/s each", () => {
  // spec A5.4 — "ကစားသမား ၁၂ ယောက်မှာ bandwidth < 30 KB/s တစ်ယောက်"
  const players = [];
  for (let i = 0; i < 12; i++) {
    // ၁၂ ယောက်လုံး တစ်ယောက်ကို တစ်ယောက် မြင်ရအောင် နီးနီးထား —
    // ဒါက အဆိုးဆုံး အခြေအနေ (interest management က ဘာမှ မဖြတ်ဘူး)。
    players.push(player(`player-${i}`, (i % 4) * 3, Math.floor(i / 4) * 3));
  }
  const snap = s.buildSnapshot(players[0], players, Date.now());
  assert.equal(snap.players.length, 12, "worst case: everyone is visible");

  const perTick = s.snapshotBytes(snap);
  const perSecond = perTick * s.TICK_HZ;
  assert.ok(
    perSecond < 30_000,
    `${(perSecond / 1000).toFixed(1)} KB/s exceeds the 30 KB/s budget`,
  );
});

test("interest management is what makes a crowd affordable", () => {
  // ★ ကစားသမား ၁၀၀ ယောက် ပြန့်ကျဲနေရင် — radius မရှိရင် snapshot က
  //   ၁၀၀ ဆ ကြီးမယ်။ ဒါက bandwidth အတွက်တင်မဟုတ် — ESP hack ကိုပါ တားတယ်။
  const players = [];
  for (let i = 0; i < 100; i++) {
    players.push(player(`p${i}`, (i % 10) * 25, Math.floor(i / 10) * 25));
  }
  const viewer = players[0];
  const withRadius = s.buildSnapshot(viewer, players, 1);
  const withoutRadius = s.buildSnapshot(viewer, players, 1, { radius: 1e9 });
  assert.ok(withRadius.players.length < withoutRadius.players.length / 4);
});

test("the tick rate is 20Hz", () => {
  assert.equal(s.TICK_HZ, 20);
  assert.equal(s.TICK_MS, 50);
});
