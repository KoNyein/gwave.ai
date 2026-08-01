"use strict";

/// Protocol + anti-cheat + room isolation ကို စစ်တယ်။
/// `node --test test/` နဲ့ run — dependency အပို မလိုဘူး (node ရဲ့ built-in
/// test runner + ws ပဲ)။

const test = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const path = require("node:path");
const WebSocket = require("ws");

const PORT = 18080;
const BASE = `ws://127.0.0.1:${PORT}`;

let child;

function waitForHealth(timeoutMs = 8000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      fetch(`http://127.0.0.1:${PORT}/health`)
        .then((r) => (r.ok ? resolve() : retry()))
        .catch(retry);
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) reject(new Error("server never became healthy"));
      else setTimeout(tryOnce, 150);
    };
    tryOnce();
  });
}

/// ★ ရောက်လာသမျှ message ကို queue ထဲ အရင်စုထားရတယ်။ `open` ဖြစ်ပြီးမှ
/// listener တပ်ရင် server က ချက်ချင်းပို့တဲ့ `init` က ကြားထဲ ပျောက်သွားနိုင်တယ်
/// — ဒါက test အလိုက် အောင်လိုက်ကျလိုက် ဖြစ်စေတဲ့ အကြောင်းရင်း။
function open(room = "city") {
  const ws = new WebSocket(`${BASE}/?room=${room}`);
  ws.queue = [];
  ws.waiters = [];
  ws.on("message", (raw) => {
    const m = JSON.parse(raw.toString());
    const i = ws.waiters.findIndex((w) => w.type === m.type);
    if (i >= 0) {
      const [w] = ws.waiters.splice(i, 1);
      clearTimeout(w.timer);
      w.resolve(m);
    } else {
      ws.queue.push(m);
    }
  });
  return new Promise((resolve, reject) => {
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

/// type တူရုံမက အခြေအနေတစ်ခုပါ ကိုက်တဲ့ message ကို စောင့်တယ် —
/// ရှေ့ test က ကျန်နေတဲ့ connection တွေရဲ့ join/leave ကို ကျော်ဖို့။
async function waitFor(ws, type, match, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const i = ws.queue.findIndex((m) => m.type === type && match(m));
    if (i >= 0) return ws.queue.splice(i, 1)[0];
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error(`timed out waiting for "${type}"`);
    const m = await next(ws, type, remaining);
    if (match(m)) return m;
  }
}

/// message တစ်ခုကို စောင့် — queue ထဲ ရှိပြီးသားဆို ချက်ချင်းပြန်ပေးတယ်။
function next(ws, type, timeoutMs = 3000) {
  const i = ws.queue.findIndex((m) => m.type === type);
  if (i >= 0) return Promise.resolve(ws.queue.splice(i, 1)[0]);
  return new Promise((resolve, reject) => {
    const waiter = { type, resolve };
    waiter.timer = setTimeout(() => {
      const idx = ws.waiters.indexOf(waiter);
      if (idx >= 0) ws.waiters.splice(idx, 1);
      reject(new Error(`timed out waiting for "${type}"`));
    }, timeoutMs);
    ws.waiters.push(waiter);
  });
}

test.before(async () => {
  child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: { ...process.env, PORT: String(PORT), REQUIRE_AUTH: "false" },
    stdio: "ignore",
  });
  await waitForHealth();
});

test.after(() => {
  child?.kill("SIGTERM");
});

test("/health answers with ok and a player count", async () => {
  const res = await fetch(`http://127.0.0.1:${PORT}/health`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.status, "ok");
  assert.strictEqual(typeof body.players, "number");
});

test("init arrives with an id and the existing players", async () => {
  const ws = await open();
  const init = await next(ws, "init");
  assert.ok(init.id);
  assert.strictEqual(init.room, "city");
  assert.strictEqual(typeof init.serverTime, "number");
  ws.close();
});

test("a second player is seen joining and moving", async () => {
  const a = await open();
  await next(a, "init");

  const b = await open();
  // ★ b ရဲ့ id ကို b ကိုယ်တိုင်ရဲ့ init ကနေယူတယ် — a ဆီရောက်လာတဲ့ join ကို
  // ယုံရင် ရှေ့ test က ကျန်နေတဲ့ socket တစ်ခုရဲ့ join ဖြစ်နေနိုင်တယ်။
  const initB = await next(b, "init");

  const join = await waitFor(a, "join", (m) => m.id === initB.id);
  assert.strictEqual(join.id, initB.id);

  b.send(JSON.stringify({ type: "update", x: 1, y: 0, z: 12, ry: 0 }));
  const upd = await waitFor(a, "update", (m) => m.id === initB.id);
  assert.strictEqual(upd.x, 1);

  b.close();
  const left = await waitFor(a, "leave", (m) => m.id === initB.id);
  assert.strictEqual(left.id, initB.id);
  a.close();
});

test("a teleport is rejected and corrected, and nobody else sees it", async () => {
  const a = await open();
  await next(a, "init");
  const b = await open();
  await next(b, "init");
  await next(a, "join");

  // ★ ဒါက acceptance criteria — x: 9999 ခုန်ပို့ကြည့်ရင် server က ငြင်းရမယ်
  b.send(JSON.stringify({ type: "update", x: 9999, y: 0, z: 9999, ry: 0 }));
  const corr = await next(b, "correct");
  assert.notStrictEqual(corr.x, 9999);

  // a ဆီကို update မရောက်ဘူးဆိုတာ သက်သေပြဖို့ — တရားဝင် update တစ်ခု
  // ပို့ပြီး အဲဒါက ပထမဆုံးရောက်လာတာ ဖြစ်ရမယ်
  b.send(JSON.stringify({ type: "update", x: 0.5, y: 0, z: 12, ry: 0 }));
  const upd = await next(a, "update");
  assert.strictEqual(upd.x, 0.5);

  a.close();
  b.close();
});

test("chat is rate limited to one message per half second", async () => {
  const ws = await open();
  await next(ws, "init");
  ws.send(JSON.stringify({ type: "chat", text: "one" }));
  const first = await next(ws, "chat");
  assert.strictEqual(first.text, "one");

  ws.send(JSON.stringify({ type: "chat", text: "two" }));
  await assert.rejects(() => next(ws, "chat", 700), /timed out/);
  ws.close();
});

test("an unknown emote is dropped", async () => {
  const a = await open();
  await next(a, "init");
  const b = await open();
  await next(b, "init");
  await next(a, "join");

  b.send(JSON.stringify({ type: "emote", emote: "explode" }));
  await assert.rejects(() => next(a, "emote", 700), /timed out/);

  b.send(JSON.stringify({ type: "emote", emote: "wave" }));
  const e = await next(a, "emote");
  assert.strictEqual(e.emote, "wave");

  a.close();
  b.close();
});

test("rooms are isolated", async () => {
  const city = await open("city");
  await next(city, "init");
  const farm = await open("farm");
  await next(farm, "init");

  // farm ထဲက လူဝင်တာကို city က မမြင်ရဘူး
  await assert.rejects(() => next(city, "join", 700), /timed out/);

  city.close();
  farm.close();
});

test("an unknown room falls back to city instead of creating one", async () => {
  const ws = await open("../etc/passwd");
  const init = await next(ws, "init");
  assert.strictEqual(init.room, "city");
  ws.close();
});
