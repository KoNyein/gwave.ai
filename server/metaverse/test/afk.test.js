"use strict";

/// AFK (Phase 17.4)。
///
/// ★ ဖုန်းက နောက်ပိုင်း ရောက်သွားရင် render ရပ်တယ် — အဲဒီလူဆီ 15Hz နဲ့
///   position ပို့နေတာက **ဘက်ထရီနဲ့ data ကို အလကား စားတာ**。
/// ★ ဒါပေမယ့် ပြန်လာချိန်မှာ လောကက မှန်နေရမယ် — မဟုတ်ရင် ကျန်တဲ့သူတွေက
///   အဟောင်းနေရာမှာ ရပ်နေမယ်။

const test = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const path = require("node:path");
const WebSocket = require("ws");

const PORT = 18097;
const children = [];

function boot(port) {
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: { ...process.env, PORT: String(port), REQUIRE_AUTH: "false" },
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

function connect(room = "sky") {
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
    next(match, timeout = 4000) {
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
    drain: () => queue.splice(0, queue.length),
    send: (m) => ws.send(JSON.stringify(m)),
    close: () => ws.close(),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test.before(() => boot(PORT));
test.after(() => {
  for (const c of children) c.kill("SIGTERM");
});

test("★ AFK ဖြစ်နေသူဆီ position update မပို့ဘူး", async () => {
  const a = connect();
  await a.next((m) => m.type === "init");
  const b = connect();
  await b.next((m) => m.type === "init");

  // a က နောက်ပိုင်း ရောက်သွားပြီ
  a.send({ type: "afk", afk: true });
  await sleep(200);
  a.drain();

  // b ရွှေ့တယ် — a ဆီ မရောက်ရ
  b.send({ type: "update", x: 1, y: 0, z: 12, ry: 0 });
  await assert.rejects(a.next((m) => m.type === "updates", 1000), /timeout/);

  a.close();
  b.close();
});

test("★ ပြန်လာရင် နောက်ဆုံးအခြေအနေကို တစ်ခါ ပြန်ရတယ်", async () => {
  const a = connect();
  await a.next((m) => m.type === "init");
  const b = connect();
  const initB = await b.next((m) => m.type === "init");

  a.send({ type: "afk", afk: true });
  await sleep(200);

  // AFK ဖြစ်နေစဉ် b ရွှေ့တယ် — a က မမြင်ရဘူး
  b.send({ type: "update", x: 3, y: 0, z: 12, ry: 0 });
  await sleep(300);
  a.drain();

  // ပြန်လာတယ် → catch-up ရရမယ်
  a.send({ type: "afk", afk: false });
  const catchUp = await a.next((m) => m.type === "updates");
  const row = catchUp.p.find((e) => e[0] === initB.id);
  assert.ok(row, "the other player must be in the catch-up snapshot");
  assert.strictEqual(row[1], 3, "and at their current position, not the old one");

  a.close();
  b.close();
});

test("AFK ဖြစ်နေလည်း chat က ရောက်ရမယ်", async () => {
  const a = connect();
  await a.next((m) => m.type === "init");
  const b = connect();
  await b.next((m) => m.type === "init");

  a.send({ type: "afk", afk: true });
  await sleep(200);
  a.drain();

  // ★ Chat ကို ချန်လိုက်ရင် ပြန်လာချိန်မှာ စာတွေ ပျောက်နေမယ် —
  // ချန်ရမယ့်အရာက **နေရာ update သာ**。
  b.send({ type: "chat", text: "ဟိုင်း" });
  const chat = await a.next((m) => m.type === "chat");
  assert.strictEqual(chat.text, "ဟိုင်း");

  a.close();
  b.close();
});
