"use strict";

/// Mini-games (Phase 16)。
///
/// ဒီ test တွေရဲ့ အဓိကမေးခွန်း ၄ ခု — spec 16.6 ရဲ့ acceptance criteria:
///   1. Client ကနေ score အတု ပို့ရင် server က ငြင်းလား
///   2. ကစားသူ ပြတ်သွားရင် ပွဲ ဆက်သွားလား
///   3. မကစားသူတွေ ဘေးကနေ ကြည့်လို့ရလား
///   4. ဆုက cosmetic သာလား (ငွေ မပါဘူးလား)

const test = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const path = require("node:path");
const WebSocket = require("ws");

const { createGameRunner, GAMES } = require("../games");

const PORT = 18096;
const children = [];

// ── Runner ကို တိုက်ရိုက် စမ်းတယ် (socket မလိုဘူး၊ မြန်တယ်) ─────────────────
function harness(positions = {}) {
  const sent = [];
  const broadcasts = [];
  const runner = createGameRunner({
    broadcast: (roomId, msg) => broadcasts.push({ roomId, msg }),
    sendTo: (playerId, msg) => sent.push({ playerId, msg }),
    positionOf: (roomId, playerId) => positions[playerId] ?? null,
    nameOf: (roomId, playerId) => `P-${playerId}`,
    saveScores: () => {},
  });
  return { runner, sent, broadcasts };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const last = (list, type) =>
  [...list].reverse().find((e) => (e.msg ?? e).type === type)?.msg ?? null;

test("★ client က score အတု ပို့လည်း အမှတ် မတက်ဘူး", async (t) => {
  const positions = { a: { x: 0, y: 0, z: 0, ry: 0 } };
  const { runner, broadcasts } = harness(positions);
  const instance = runner.start("city", "targets", ["a"]);
  t.after(() => runner.stopAll());
  assert.ok(instance, "game should start");

  // ★ ဒါက တိုက်ခိုက်မှု — client က ကိုယ့်အမှတ်ကို ကိုယ်တိုင် ပြောတာ
  runner.action("city", "a", { type: "shoot", score: 999999, rank: 1 });
  runner.action("city", "a", { score: 5_000_000 });

  await sleep(700); // tick တစ်ခါ ဖြတ်စေတယ်
  const state = last(broadcasts, "gameState");
  assert.ok(state, "should have broadcast a gameState");
  const mine = state.scores.find((s) => s.id === "a");
  // ★ ပစ်မှတ်က -34 မှာ၊ ကစားသူက 0,0 မှာ ry=0 နဲ့ — မှန်ကန်တဲ့ ဦးတည်ရာ
  // မဟုတ်လို့ ဘာမှ မထိရဘူး။ ဘယ်လိုပဲဖြစ်ဖြစ် 999999 တော့ မဖြစ်ရ။
  assert.ok(mine.score < 1000, `score should be server-computed, got ${mine.score}`);
});

test("ပစ်ချက်ကို server က တွက်တယ် — ဦးတည်ရာ မှန်မှ ထိတယ်", async (t) => {
  // ပစ်မှတ်တွေက z = -34 မှာ။ ry = π ဆိုရင် forward = (sin π, cos π) = (0, -1)
  // — ဒါက ပစ်မှတ်ဘက် ဦးတည်တာ။
  const positions = { a: { x: -18, y: 0, z: 0, ry: Math.PI } };
  const { runner, broadcasts } = harness(positions);
  const instance = runner.start("city", "targets", ["a"]);
  t.after(() => runner.stopAll());
  assert.ok(instance);

  runner.action("city", "a", { type: "shoot", ry: Math.PI });
  await sleep(700);
  const state = last(broadcasts, "gameState");
  const mine = state.scores.find((s) => s.id === "a");
  assert.strictEqual(mine.score, 100, "aimed shot should score exactly one hit");
});

test("★ ကစားသူ ပြတ်သွားရင် ပွဲ ဆက်သွားတယ်", async (t) => {
  const positions = {
    a: { x: 0, y: 0, z: 0, ry: 0 },
    b: { x: 0, y: 0, z: 0, ry: 0 },
  };
  const { runner, broadcasts } = harness(positions);
  const instance = runner.start("city", "grow", ["a", "b"]);
  t.after(() => runner.stopAll());
  assert.ok(instance);

  runner.drop("city", "a");
  assert.ok(runner.activeIn("city"), "game must survive one player leaving");

  await sleep(700);
  const state = last(broadcasts, "gameState");
  assert.strictEqual(state.scores.length, 1, "only the remaining player is scored");
  assert.strictEqual(state.scores[0].id, "b");

  // နောက်ဆုံးလူ ထွက်မှ ပွဲ ပြီးရမယ်
  runner.drop("city", "b");
  assert.strictEqual(runner.activeIn("city"), null);
});

test("★ ဘေးကနေ ကြည့်လို့ရတယ် — အမှတ်ပြားက room တစ်ခုလုံးဆီ သွားတယ်", async (t) => {
  const positions = { a: { x: 0, y: 0, z: 0, ry: 0 } };
  const { runner, broadcasts, sent } = harness(positions);
  runner.start("city", "hunt", ["a"]);
  t.after(() => runner.stopAll());

  await sleep(700);
  assert.ok(last(broadcasts, "gameState"), "gameState is broadcast to the room");

  // ★ ဝှက်ထားရမယ့် အချက်အလက် (ပစ္စည်းနေရာ) က ကစားသူဆီပဲ သွားရမယ် —
  // room တစ်ခုလုံးဆီ ပို့လိုက်ရင် ကြည့်နေသူက အကုန် မြင်ပြီး ပြောပြလို့ရမယ်။
  assert.ok(last(sent, "gameObjectives"), "objectives go only to players");
  assert.strictEqual(
    broadcasts.find((b) => b.msg.type === "gameObjectives"),
    undefined,
    "objectives must never be broadcast",
  );
});

test("★ ဆုက cosmetic သာ — ငွေ/credit မပါဘူး", async (t) => {
  const positions = { a: { x: 0, y: 0, z: 0, ry: 0 } };
  const { runner, broadcasts } = harness(positions);
  const instance = runner.start("city", "grow", ["a"]);
  t.after(() => runner.stopAll());

  // အချိန်ကုန်စေတယ် — tick နောက်တစ်ခါမှာ ပွဲပြီးမယ်
  instance.endsAt = Date.now() - 1;
  await sleep(700);

  const end = last(broadcasts, "gameEnd");
  assert.ok(end, "gameEnd should be broadcast");
  assert.strictEqual(end.rankings[0].rank, 1);
  for (const r of end.rewards) {
    assert.ok(r.sku, "reward must be an sku");
    // ★ ငွေနဲ့ဆိုင်တဲ့ field တစ်ခုမှ မပါရ (spec 16.4)
    assert.strictEqual(r.creditMinor, undefined);
    assert.strictEqual(r.amount, undefined);
    assert.strictEqual(r.currency, undefined);
  }
});

test("အပြေးပြိုင်ပွဲမှာ checkpoint ကို အစဉ်လိုက်သာ ဖြတ်လို့ရတယ်", async (t) => {
  // ★ နောက်ဆုံး checkpoint (0, 12) ပေါ်မှာ ရပ်ထားပေမယ့် ပထမတစ်ခု
  // မဖြတ်ရသေးလို့ အမှတ် မရရ — မဟုတ်ရင် ပန်းဝင်ကို တန်းသွားလို့ရမယ်။
  const positions = { a: { x: 0, y: 0, z: 12, ry: 0 } };
  const { runner, broadcasts } = harness(positions);
  runner.start("city", "race", ["a"]);
  t.after(() => runner.stopAll());

  await sleep(700);
  const state = last(broadcasts, "gameState");
  assert.strictEqual(state.scores[0].score, 0, "must not skip to the finish line");
});

test("စိုက်ပျိုးပွဲမှာ ခလုတ် အမြန်နှိပ်လို့ အနိုင်မရဘူး", async (t) => {
  const positions = { a: { x: 0, y: 0, z: 0, ry: 0 } };
  const { runner } = harness(positions);
  const instance = runner.start("city", "grow", ["a"]);
  t.after(() => runner.stopAll());

  // ★ ၂၀ ခါ ဆက်တိုက် နှိပ်တယ် — cooldown ကြောင့် တစ်ပင်ပဲ ရရမယ်
  for (let i = 0; i < 20; i++) runner.action("city", "a", { type: "plant" });
  const player = instance.players.get("a");
  assert.strictEqual(player.plants.length, 1, "plant cooldown must hold");
});

test("မသိတဲ့ game id ကို ငြင်းတယ်", () => {
  const { runner } = harness();
  assert.strictEqual(runner.start("city", "../../etc/passwd", ["a"]), null);
  assert.strictEqual(runner.join("city", "a", "not-a-game"), "unknown");
});

test("game တစ်ခုချင်းက interface တူညီရမယ် (hardcode မလုပ်ရ)", () => {
  assert.strictEqual(GAMES.size, 4);
  for (const g of GAMES.values()) {
    assert.strictEqual(typeof g.id, "string");
    assert.strictEqual(typeof g.nameMy, "string");
    assert.strictEqual(typeof g.onStart, "function");
    assert.ok(g.durationSec > 0);
    assert.ok(g.arena && typeof g.arena.radius === "number");
  }
});

// ── Protocol (socket အစစ်နဲ့) ──────────────────────────────────────────────
function boot(port) {
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    // ★ Lobby ကို ၁ စက္ကန့် — test က ၁၅ စက္ကန့် စောင့်စရာမလိုဘူး
    env: {
      ...process.env,
      PORT: String(port),
      REQUIRE_AUTH: "false",
      MV_LOBBY_MS: "1000",
    },
    stdio: "ignore",
  });
  children.push(child);
  const t0 = Date.now();
  return new Promise((res, rej) => {
    const tick = () =>
      fetch(`http://127.0.0.1:${port}/health`).then((r) => (r.ok ? res() : retry())).catch(retry);
    const retry = () =>
      Date.now() - t0 > 8000 ? rej(new Error("no start")) : setTimeout(tick, 150);
    tick();
  });
}

function connect(room = "farm") {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/?room=${room}`);
  const queue = [];
  const waiters = [];
  ws.on("message", (raw) => {
    const m = JSON.parse(raw.toString());
    const i = waiters.findIndex((w) => w.match(m));
    if (i >= 0) waiters.splice(i, 1)[0].resolve(m);
    else queue.push(m);
  });
  return {
    next(match, timeout = 6000) {
      const i = queue.findIndex(match);
      if (i >= 0) return Promise.resolve(queue.splice(i, 1)[0]);
      return new Promise((resolve, reject) => {
        const w = { match, resolve };
        waiters.push(w);
        setTimeout(() => {
          const k = waiters.indexOf(w);
          if (k >= 0) waiters.splice(k, 1);
          reject(new Error("timeout"));
        }, timeout);
      });
    },
    send: (m) => ws.send(JSON.stringify(m)),
    close: () => ws.close(),
  };
}

test.before(() => boot(PORT));
test.after(() => {
  for (const c of children) c.kill("SIGTERM");
});

test("init မှာ game စာရင်း ပါလာတယ်", async () => {
  const a = connect("snow");
  const init = await a.next((m) => m.type === "init");
  assert.ok(Array.isArray(init.games) && init.games.length === 4);
  a.close();
});

test("gameJoin → gameInvite → gameStart", async () => {
  const a = connect("farm");
  await a.next((m) => m.type === "init");
  const b = connect("farm");
  await b.next((m) => m.type === "init");

  a.send({ type: "gameJoin", gameId: "grow" });

  // ★ ဖိတ်ခေါ်ချက်က room တစ်ခုလုံးဆီ — ကျန်တဲ့သူတွေ ဝင်လို့ရအောင်
  const invite = await b.next((m) => m.type === "gameInvite");
  assert.strictEqual(invite.gameId, "grow");

  b.send({ type: "gameJoin", gameId: "grow" });
  const start = await a.next((m) => m.type === "gameStart");
  assert.strictEqual(start.players.length, 2);

  // ★ အမှတ်ပြားက အားလုံးဆီ ရောက်တယ်
  const state = await b.next((m) => m.type === "gameState");
  assert.ok(Array.isArray(state.scores));

  a.close();
  b.close();
});
