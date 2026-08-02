"use strict";

/// ယာဉ် (Phase 11) — **ယာဉ်တစ်စီးမှာ driver တစ်ယောက်တည်း** ဆိုတာနဲ့
/// **မောင်းနေတဲ့သူကသာ နေရာပို့လို့ရတယ်** ဆိုတာက ဒီ test တွေရဲ့ အဓိကအချက်။

const test = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const path = require("node:path");
const WebSocket = require("ws");

const PORT = 18094;
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
    const retry = () => (Date.now() - t0 > 8000 ? rej(new Error("no start")) : setTimeout(tick, 150));
    tick();
  });
}

function connect() {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/?room=city`);
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
    send: (m) => ws.send(JSON.stringify(m)),
    close: () => ws.close(),
  };
}

test.before(() => boot(PORT));
test.after(() => {
  for (const c of children) c.kill("SIGTERM");
});

test("init မှာ ရာသီဥတု ပါလာတယ်", async () => {
  const a = connect();
  const init = await a.next((m) => m.type === "init");
  assert.ok(init.weather, "weather should be in init");
  assert.ok(
    ["clear", "rain", "storm", "fog"].includes(init.weather.kind),
    `city weather should be a city kind, got ${init.weather.kind}`,
  );
  a.close();
});

test("ယာဉ်တစ်စီးကို တစ်ယောက်တည်း မောင်းလို့ရတယ်", async () => {
  const a = connect();
  const initA = await a.next((m) => m.type === "init");
  const b = connect();
  await b.next((m) => m.type === "init");

  a.send({ type: "mount", vehicleId: "city-v0" });
  const mounted = await b.next((m) => m.type === "mounted");
  assert.strictEqual(mounted.playerId, initA.id);

  // ★ ဒုတိယလူက အဲဒီယာဉ်ကို မရရ
  b.send({ type: "mount", vehicleId: "city-v0" });
  const denied = await b.next((m) => m.type === "mountDenied");
  assert.strictEqual(denied.vehicleId, "city-v0");

  a.close();
  b.close();
});

test("မမောင်းတဲ့သူက ယာဉ်ကို ရွှေ့လို့မရဘူး", async () => {
  const a = connect();
  await a.next((m) => m.type === "init");
  const b = connect();
  await b.next((m) => m.type === "init");

  a.send({ type: "mount", vehicleId: "city-v1" });
  await b.next((m) => m.type === "mounted");

  // ★ b က မောင်းသူ မဟုတ်ဘူး — သူပို့တာကို server က ပစ်ရမယ်
  b.send({ type: "vstate", vehicleId: "city-v1", x: 5, y: 0, z: 5, ry: 0, speed: 4 });
  await assert.rejects(
    a.next((m) => m.type === "vstate", 1200),
    /timeout/,
  );

  a.close();
  b.close();
});

test("မောင်းသူ ပြတ်သွားရင် ယာဉ် လွတ်တယ်", async () => {
  const a = connect();
  await a.next((m) => m.type === "init");
  const b = connect();
  await b.next((m) => m.type === "init");

  a.send({ type: "mount", vehicleId: "city-v2" });
  await b.next((m) => m.type === "mounted");
  a.close();
  await b.next((m) => m.type === "dismounted" && m.vehicleId === "city-v2");

  // အခု b စီးလို့ရရမယ်
  const c = connect();
  await c.next((m) => m.type === "init");
  b.send({ type: "mount", vehicleId: "city-v2" });
  const again = await c.next((m) => m.type === "mounted" && m.vehicleId === "city-v2");
  assert.ok(again);

  b.close();
  c.close();
});

test("မဖြစ်နိုင်တဲ့ အမြန်နှုန်းကို ငြင်းတယ်", async () => {
  const a = connect();
  await a.next((m) => m.type === "init");
  const b = connect();
  await b.next((m) => m.type === "init");

  a.send({ type: "mount", vehicleId: "city-v3" });
  await b.next((m) => m.type === "mounted");
  // ★ client ကို ပြင်ပြီး တစ်စက္ကန့် ၉၉၉ unit မောင်းလို့ မရရ
  a.send({ type: "vstate", vehicleId: "city-v3", x: 5, y: 0, z: 5, ry: 0, speed: 999 });
  await assert.rejects(
    b.next((m) => m.type === "vstate", 1200),
    /timeout/,
  );

  a.close();
  b.close();
});
