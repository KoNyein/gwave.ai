"use strict";

/// Voice chat ရဲ့ ဝင်ခွင့် (Phase 14)。
///
/// အဓိကမေးခွန်း — spec 14.0 ရဲ့ "အန္တရာယ်အရှိဆုံး feature":
///   1. ★ ၁၈ နှစ်အောက် / အသက်မသိသူ voice ဝင်လို့ရလား (မရရ)
///   2. Guest ဝင်လို့ရလား (မရရ)
///   3. Signal relay က voice member အချင်းချင်းသာလား

const test = require("node:test");
const assert = require("node:assert");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const path = require("node:path");
const WebSocket = require("ws");

const PORT = 18098;
const SECRET = "test-secret-for-voice";
const children = [];

/// Next.js ရဲ့ ws-ticket route နဲ့ ပုံစံတူ HS256 ticket — `adult` claim ပါ။
function mintTicket(sub, name, adult) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    sub,
    name,
    adult,
    iat: now,
    exp: now + 60,
  })}`;
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function boot(port) {
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: {
      ...process.env,
      PORT: String(port),
      REQUIRE_AUTH: "false",
      MV_TICKET_SECRET: SECRET,
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

function connect({ ticket, room = "city" } = {}) {
  const qs = ticket ? `room=${room}&ticket=${ticket}` : `room=${room}`;
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/?${qs}`);
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
    send: (m) => ws.send(JSON.stringify(m)),
    close: () => ws.close(),
  };
}

test.before(() => boot(PORT));
test.after(() => {
  for (const c of children) c.kill("SIGTERM");
});

test("★ ၁၈ နှစ်အောက် (adult=false) voice ဝင်လို့မရ", async () => {
  const minor = connect({ ticket: mintTicket("u-minor", "Minor", false) });
  await minor.next((m) => m.type === "init");
  minor.send({ type: "voiceJoin" });
  const denied = await minor.next((m) => m.type === "voiceDenied");
  assert.strictEqual(denied.reason, "age");
  minor.close();
});

test("★ Guest voice ဝင်လို့မရ", async () => {
  const guest = connect();
  await guest.next((m) => m.type === "init");
  guest.send({ type: "voiceJoin" });
  const denied = await guest.next((m) => m.type === "voiceDenied");
  assert.strictEqual(denied.reason, "auth");
  guest.close();
});

test("၁၈+ ဝင်လို့ရပြီး peer စာရင်း ရတယ်", async () => {
  const a = connect({ ticket: mintTicket("u-adult-a", "A", true) });
  await a.next((m) => m.type === "init");
  a.send({ type: "voiceJoin" });
  const peers = await a.next((m) => m.type === "voicePeers");
  assert.ok(peers.peers.some((p) => p.id === "u-adult-a"));
  // ★ Mic default က **ပိတ်** (spec 14.4)
  assert.strictEqual(peers.peers.find((p) => p.id === "u-adult-a").muted, true);
  a.close();
});

test("★ Signal relay က voice member အချင်းချင်းသာ", async () => {
  const a = connect({ ticket: mintTicket("u-sig-a", "A", true) });
  await a.next((m) => m.type === "init");
  const b = connect({ ticket: mintTicket("u-sig-b", "B", true) });
  await b.next((m) => m.type === "init");
  const outsider = connect({ ticket: mintTicket("u-out", "Out", true) });
  await outsider.next((m) => m.type === "init");

  a.send({ type: "voiceJoin" });
  await a.next((m) => m.type === "voicePeers");
  b.send({ type: "voiceJoin" });
  await b.next((m) => m.type === "voicePeers");

  // Voice ထဲရှိတဲ့ a → b: ရောက်ရမယ်
  a.send({ type: "voiceSignal", to: "u-sig-b", data: { sdp: "offer" } });
  const sig = await b.next((m) => m.type === "voiceSignal");
  assert.strictEqual(sig.from, "u-sig-a");

  // ★ Voice မဝင်ထားတဲ့ outsider → b: မရောက်ရ (side channel မဖြစ်ရ)
  outsider.send({ type: "voiceSignal", to: "u-sig-b", data: { sdp: "evil" } });
  await assert.rejects(
    b.next((m) => m.type === "voiceSignal" && m.from === "u-out", 1000),
    /timeout/,
  );

  a.close();
  b.close();
  outsider.close();
});

test("Mute အခြေအနေ room ကို ကြေညာတယ်", async () => {
  const a = connect({ ticket: mintTicket("u-mute-a", "A", true), room: "farm" });
  await a.next((m) => m.type === "init");
  const watcher = connect({ room: "farm" });
  await watcher.next((m) => m.type === "init");

  a.send({ type: "voiceJoin" });
  await a.next((m) => m.type === "voicePeers");
  a.send({ type: "voiceMute", muted: false });
  const st = await watcher.next((m) => m.type === "voiceState");
  assert.strictEqual(st.id, "u-mute-a");
  assert.strictEqual(st.muted, false);

  a.close();
  watcher.close();
});

test("ပြတ်သွားရင် voiceLeft ကြေညာတယ်", async () => {
  const a = connect({ ticket: mintTicket("u-drop-a", "A", true), room: "snow" });
  await a.next((m) => m.type === "init");
  const b = connect({ room: "snow" });
  await b.next((m) => m.type === "init");

  a.send({ type: "voiceJoin" });
  await a.next((m) => m.type === "voicePeers");
  a.close();
  const left = await b.next((m) => m.type === "voiceLeft");
  assert.strictEqual(left.id, "u-drop-a");
  b.close();
});
