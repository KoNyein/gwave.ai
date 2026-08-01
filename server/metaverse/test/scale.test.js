"use strict";

/// Task များခု (Phase 6.2) — **task ၂ လုံးက player တွေ တစ်ယောက်နဲ့တစ်ယောက်
/// မြင်ရမလား** ဆိုတာက ဒီ test တွေရဲ့ တစ်ခုတည်းသော အချက်။
///
/// Redis မရှိရင် skip လုပ်တယ် — CI မှာ Redis မရှိရင် test က မကျရဘူး၊
/// ဒါပေမယ့် ရှိရင် တကယ် စမ်းရမယ် (fake နဲ့ စမ်းရင် ဘာမှ မသက်သေမပြဘူး)။

const test = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const path = require("node:path");
const WebSocket = require("ws");

const REDIS_URL = process.env.MV_TEST_REDIS_URL || "redis://127.0.0.1:6399";
const PORT_A = 18091;
const PORT_B = 18092;
const children = [];

function boot(port) {
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: { ...process.env, PORT: String(port), REQUIRE_AUTH: "false", REDIS_URL },
    stdio: "ignore",
  });
  children.push(child);
  const t0 = Date.now();
  return new Promise((res, rej) => {
    const tick = () =>
      fetch(`http://127.0.0.1:${port}/health`).then((r) => (r.ok ? res() : retry())).catch(retry);
    const retry = () => (Date.now() - t0 > 8000 ? rej(new Error("no start")) : setTimeout(tick, 150));
    tick();
  });
}

function connect(port, room = "city") {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/?room=${room}`);
  const queue = [];
  const waiters = [];
  ws.on("message", (raw) => {
    const m = JSON.parse(raw.toString());
    const i = waiters.findIndex((w) => w.match(m));
    if (i >= 0) waiters.splice(i, 1)[0].resolve(m);
    else queue.push(m);
  });
  return {
    ws,
    /// ★ queue နဲ့ လုပ်ရတယ် — listener မတပ်ခင် ရောက်လာတဲ့ message ကို
    /// မဖမ်းရင် test က ကျပန်း ကျမယ်။
    next(match, timeout = 9000) {
      const i = queue.findIndex(match);
      if (i >= 0) return Promise.resolve(queue.splice(i, 1)[0]);
      return new Promise((resolve, reject) => {
        const w = { match, resolve };
        waiters.push(w);
        setTimeout(() => {
          const k = waiters.indexOf(w);
          if (k >= 0) waiters.splice(k, 1);
          reject(new Error("timeout waiting for message"));
        }, timeout);
      });
    },
    send(m) {
      ws.send(JSON.stringify(m));
    },
    close() {
      ws.close();
    },
  };
}

let available = false;

test.before(async () => {
  // Redis တကယ် ရှိလား စစ်တယ်
  try {
    const redis = require("redis");
    const c = redis.createClient({ url: REDIS_URL });
    c.on("error", () => {});
    await c.connect();
    await c.ping();
    await c.quit();
    available = true;
  } catch {
    return;
  }
  await boot(PORT_A);
  await boot(PORT_B);
});

test.after(() => {
  for (const c of children) c.kill("SIGTERM");
});

test("task ၂ လုံးက player တွေ တစ်ယောက်ကိုတစ်ယောက် မြင်ရတယ်", async (t) => {
  if (!available) return t.skip("redis not available");
  const a = connect(PORT_A);
  const initA = await a.next((m) => m.type === "init");

  const b = connect(PORT_B);
  await b.next((m) => m.type === "init");

  // B က ရွှေ့လိုက်တာကို A မြင်ရမယ် — task မတူပေမယ့်။
  // ★ ခဏစောင့်ပြီး နည်းနည်းပဲ ရွှေ့ရမယ် — spawn (0,12) ကနေ ချက်ချင်း
  // ၄ unit ခုန်ရင် anti-cheat က ငြင်းပြီး `correct` ပြန်ပို့တယ်
  // (ဒါက မှန်တဲ့အပြုအမူ — ဒီ test က bus ကို စမ်းတာ)။
  await new Promise((r) => setTimeout(r, 700));
  b.send({ type: "update", x: 1, y: 0, z: 11.5, ry: 1 });
  // နေရာတွေက 15Hz tick မှာ စုပို့တယ် — `[id, x, y, z, ry]`
  const batch = await a.next(
    (m) => m.type === "updates" && (m.p ?? []).some((e) => e[0] !== initA.id),
  );
  const seen = batch.p.find((e) => e[0] !== initA.id);
  assert.strictEqual(seen[1], 1);
  assert.strictEqual(seen[3], 11.5);

  a.close();
  b.close();
});

test("chat က task နှစ်ခုကြား ရောက်တယ်", async (t) => {
  if (!available) return t.skip("redis not available");
  const a = connect(PORT_A);
  await a.next((m) => m.type === "init");
  const b = connect(PORT_B);
  const initB = await b.next((m) => m.type === "init");

  b.send({ type: "chat", text: "မင်္ဂလာပါ" });
  const line = await a.next((m) => m.type === "chat" && m.id === initB.id);
  assert.strictEqual(line.text, "မင်္ဂလာပါ");

  a.close();
  b.close();
});

test("နောက်မှ ဝင်လာသူက တခြား task ပေါ်က ငြိမ်နေသူကို မြင်ရတယ်", async (t) => {
  if (!available) return t.skip("redis not available");
  // ★ ဒါက အခက်ခဲဆုံး အခြေအနေ — ငြိမ်နေတဲ့သူက update မပို့ဘူး၊ ဒါကြောင့်
  // sync မရှိရင် ဘယ်တော့မှ မမြင်ရဘူး။
  const b = connect(PORT_B);
  const initB = await b.next((m) => m.type === "init");
  await new Promise((r) => setTimeout(r, 6500)); // sync တစ်ခေါက် ကျော်ဖို့

  const a = connect(PORT_A);
  const initA = await a.next((m) => m.type === "init");
  assert.ok(initA.players[initB.id], "ဂိုးစ်က snapshot ထဲ ပါရမယ်");

  a.close();
  b.close();
});

test("room မတူရင် task ဖြတ်ပြီးလည်း မမြင်ရဘူး", async (t) => {
  if (!available) return t.skip("redis not available");
  const a = connect(PORT_A, "city");
  await a.next((m) => m.type === "init");
  const b = connect(PORT_B, "farm");
  const initB = await b.next((m) => m.type === "init");

  b.send({ type: "chat", text: "ဘယ်သူမှ မကြားရဘူး" });
  await assert.rejects(
    a.next((m) => m.type === "chat" && m.id === initB.id, 1500),
    /timeout/,
  );

  a.close();
  b.close();
});

test("/health က တစ်လောကလုံးက အရေအတွက်ကို ပြတယ်", async (t) => {
  if (!available) return t.skip("redis not available");
  const a = connect(PORT_A);
  await a.next((m) => m.type === "init");
  const b = connect(PORT_B);
  await b.next((m) => m.type === "init");
  await new Promise((r) => setTimeout(r, 6500));

  const h = await (await fetch(`http://127.0.0.1:${PORT_A}/health`)).json();
  assert.ok(h.rooms.city >= 2, `city should count both tasks, got ${h.rooms.city}`);

  a.close();
  b.close();
});
