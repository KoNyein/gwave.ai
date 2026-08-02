"use strict";

/// Ticket auth — Phase 3။
/// Guest ဝင်ခွင့်ပေးထားပေမယ့် **အကောင့်ရှိသူတစ်ယောက်အဖြစ် ဟန်ဆောင်လို့
/// မရဘူး** ဆိုတာက ဒီ test တွေရဲ့ အဓိကအချက်။

const test = require("node:test");
const assert = require("node:assert");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const path = require("node:path");
const WebSocket = require("ws");

const SECRET = "test-secret-do-not-use-in-production";
const PORT_STRICT = 18081; // REQUIRE_AUTH=true
const PORT_OPEN = 18082; // guest ဝင်လို့ရ

const children = [];

function b64(o) {
  return Buffer.from(JSON.stringify(o)).toString("base64url");
}

/// Next.js ရဲ့ /api/metaverse/ws-ticket နဲ့ တူညီတဲ့ ticket တစ်ခု ဆောက်တယ်။
function makeTicket({ sub = "u_1", name = "KoNyein", ageSec = 0, secret = SECRET } = {}) {
  const now = Math.floor(Date.now() / 1000) - ageSec;
  const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    sub,
    name,
    iat: now,
    exp: now + 60,
  })}`;
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function boot(port, requireAuth) {
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: {
      ...process.env,
      PORT: String(port),
      REQUIRE_AUTH: String(requireAuth),
      MV_TICKET_SECRET: SECRET,
    },
    stdio: "ignore",
  });
  children.push(child);
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      fetch(`http://127.0.0.1:${port}/health`)
        .then((r) => (r.ok ? resolve() : retry()))
        .catch(retry);
    };
    const retry = () => {
      if (Date.now() - started > 8000) reject(new Error("server never started"));
      else setTimeout(tick, 150);
    };
    tick();
  });
}

/// ချိတ်ကြည့်ပြီး ဘာဖြစ်လဲ ပြန်ပြောတယ် — init ရလား၊ ဘယ် code နဲ့ ပိတ်ခံရလား။
function connect(port, query) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/?${query}`);
  return new Promise((resolve) => {
    const result = { init: null, closeCode: null, ws };
    ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === "init") {
        result.init = m;
        resolve(result);
      }
    });
    ws.on("close", (code) => {
      result.closeCode = code;
      resolve(result);
    });
    ws.on("error", () => {});
  });
}

test.before(async () => {
  await boot(PORT_STRICT, true);
  await boot(PORT_OPEN, false);
});

test.after(() => {
  for (const c of children) c.kill("SIGTERM");
});

test("REQUIRE_AUTH: ticket မပါရင် 4001 နဲ့ ပိတ်ခံရတယ်", async () => {
  const r = await connect(PORT_STRICT, "room=city");
  assert.strictEqual(r.init, null);
  assert.strictEqual(r.closeCode, 4001);
});

test("REQUIRE_AUTH: မှန်တဲ့ ticket နဲ့ ဝင်လို့ရပြီး နာမည်က token ကလာတယ်", async () => {
  const r = await connect(PORT_STRICT, `room=city&ticket=${makeTicket()}`);
  assert.ok(r.init, "init should arrive");
  assert.strictEqual(r.init.name, "KoNyein");
  assert.strictEqual(r.init.authed, true);
  r.ws.close();
});

test("secret မှားတဲ့ ticket ကို ငြင်းတယ် (guest အဖြစ် မကျဆင်းရ)", async () => {
  const bad = makeTicket({ secret: "wrong-secret" });
  const r = await connect(PORT_OPEN, `room=city&ticket=${bad}`);
  // ★ REQUIRE_AUTH=false ဖြစ်နေတောင် ငြင်းရမယ် — မဟုတ်ရင် ticket ကို
  // ဖျက်လိုက်ရုံနဲ့ ဘယ်သူမဆို guest အဖြစ် ဝင်ပြီး နာမည်ပြောင်းလို့ရမယ်။
  assert.strictEqual(r.init, null);
  assert.strictEqual(r.closeCode, 4001);
});

test("သက်တမ်းကုန်တဲ့ ticket ကို ငြင်းတယ်", async () => {
  const old = makeTicket({ ageSec: 120 }); // ၆၀ စက္ကန့် TTL ကို ကျော်ပြီ
  const r = await connect(PORT_STRICT, `room=city&ticket=${old}`);
  assert.strictEqual(r.init, null);
  assert.strictEqual(r.closeCode, 4001);
});

test("guest ဝင်လို့ရတယ်၊ authed=false နဲ့", async () => {
  const r = await connect(PORT_OPEN, "room=city");
  assert.ok(r.init);
  assert.strictEqual(r.init.authed, false);
  assert.match(r.init.name, /^Guest /);
  r.ws.close();
});

test("guest က နာမည်ပြောင်းလို့ရတယ် — ဒါပေမယ့် authed က false အတိုင်း", async () => {
  const a = await connect(PORT_OPEN, "room=city");
  const b = await connect(PORT_OPEN, "room=city");
  assert.ok(a.init && b.init);

  const seen = new Promise((resolve) => {
    a.ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === "name" && m.id === b.init.id) resolve(m);
    });
  });
  b.ws.send(JSON.stringify({ type: "setname", name: "KoNyein" }));
  const m = await seen;
  assert.strictEqual(m.name, "KoNyein");
  // ★ နာမည်က ယူလို့ရပေမယ့် အမှတ်အသားက မလိမ်နိုင်ဘူး
  assert.strictEqual(m.authed, false);

  a.ws.close();
  b.ws.close();
});

test("signed-in user ရဲ့ setname ကို လုံးဝ လက်မခံဘူး", async () => {
  const a = await connect(PORT_STRICT, `room=city&ticket=${makeTicket({ sub: "u_a", name: "A" })}`);
  const b = await connect(PORT_STRICT, `room=city&ticket=${makeTicket({ sub: "u_b", name: "B" })}`);
  assert.ok(a.init && b.init);

  let renamed = false;
  a.ws.on("message", (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.type === "name") renamed = true;
  });
  b.ws.send(JSON.stringify({ type: "setname", name: "SomeoneElse" }));
  await new Promise((r) => setTimeout(r, 600));
  assert.strictEqual(renamed, false);

  a.ws.close();
  b.ws.close();
});
