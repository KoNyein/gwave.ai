"use strict";

/// Token-gated room (Phase 7.6)。
///
/// ★ ဒီ test တွေရဲ့ အဓိကအချက်: **client ကို hack လုပ်ပြီးတောင် ဝင်လို့မရ**။
///   Browser ထဲက ခလုတ်ဖျောက်ထားတာက ကာကွယ်မှု မဟုတ်ဘူး — WebSocket URL ကို
///   လက်နဲ့ရိုက်ပြီး `room=vip` နဲ့ ချိတ်လို့ရတယ်။ ဒါကြောင့် server က
///   ငြင်းရမယ်။

const test = require("node:test");
const assert = require("node:assert");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const path = require("node:path");
const WebSocket = require("ws");

const SECRET = "test-secret-do-not-use-in-production";
const PORT = 18093;
const children = [];

function b64(o) {
  return Buffer.from(JSON.stringify(o)).toString("base64url");
}

function makeTicket(sub = "u_vip") {
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    sub,
    name: "KoNyein",
    iat: now,
    exp: now + 60,
  })}`;
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function boot(port, env = {}) {
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: {
      ...process.env,
      PORT: String(port),
      REQUIRE_AUTH: "false",
      MV_TICKET_SECRET: SECRET,
      ...env,
    },
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

function connect(port, query) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/?${query}`);
  return new Promise((resolve) => {
    const out = { init: null, closeCode: null, ws };
    ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === "init") {
        out.init = m;
        resolve(out);
      }
    });
    ws.on("close", (code) => {
      out.closeCode = code;
      resolve(out);
    });
    ws.on("error", () => {});
  });
}

test.before(() => boot(PORT));
test.after(() => {
  for (const c of children) c.kill("SIGTERM");
});

test("ဧည့်သည်က VIP room ကို လုံးဝ မဝင်ရ", async () => {
  const r = await connect(PORT, "room=vip");
  assert.strictEqual(r.init, null);
  assert.strictEqual(r.closeCode, 4003, "4003 = wallet required");
});

test("sign in ဝင်ထားပေမယ့် wallet မချိတ်ရင် မဝင်ရ", async () => {
  const r = await connect(PORT, `room=vip&ticket=${makeTicket()}`);
  assert.strictEqual(r.init, null);
  assert.strictEqual(r.closeCode, 4003);
});

test("VIP မဝင်ရပေမယ့် ပုံမှန် room က ပုံမှန်အတိုင်း", async () => {
  // ★ ဂိတ်တစ်ခု ပိတ်တာက လောကတစ်ခုလုံးကို မထိခိုက်ရ
  const r = await connect(PORT, `room=city&ticket=${makeTicket()}`);
  assert.ok(r.init, "city should still open");
  assert.strictEqual(r.init.room, "city");
  r.ws.close();
});

test("မသိတဲ့ room က city ဖြစ်သွားတယ် — vip ကို ကျော်လို့မရ", async () => {
  // `room=VIP ` လို စာလုံးပြောင်းပြီး ဂိတ်ကျော်လို့ မရရ
  const r = await connect(PORT, `room=vip%20&ticket=${makeTicket()}`);
  assert.ok(r.init);
  assert.strictEqual(r.init.room, "city");
  r.ws.close();
});

test("WEB3_RPC_URL မထည့်ရင် ဂိတ်က ဖွင့်မပေးဘူး (fail-closed)", async () => {
  // ★ env တစ်ခု ဖျောက်လိုက်ရုံနဲ့ ဂိတ်က ပျောက်သွားရင် ဂိတ်ဆိုတာ
  // အဓိပ္ပာယ်မရှိတော့ဘူး။ ဒီ server မှာ WEB3_* မထည့်ထားဘူး —
  // ဒါပေမယ့် အပေါ်က test တွေအရ vip က ပိတ်နေဆဲ။
  const r = await connect(PORT, `room=vip&ticket=${makeTicket("u_other")}`);
  assert.strictEqual(r.init, null);
  assert.ok(r.closeCode === 4003 || r.closeCode === 4004);
});
