"use strict";

const http = require("http");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");

const { Rooms, normalizeRoom } = require("./rooms");
const { identify } = require("./auth");
const { createStore } = require("./store");

const PORT = Number(process.env.PORT || 8080);
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === "true";
const TICKET_SECRET = process.env.MV_TICKET_SECRET || "";

/// Client ရဲ့ အမြန်ဆုံး (run) က 8.4 u/s။ ×1.6 က latency နဲ့ frame ခုန်တာကို
/// ခွင့်လွှတ်ဖို့ — ဒီထက်ကျော်ရင် speed hack လို့ သတ်မှတ်တယ်။
const MAX_SPEED = 8.4;
const SPEED_TOLERANCE = 1.6;
const WORLD_RADIUS = 90;
const MAX_Y = 40;

const HEARTBEAT_MS = 30_000;
const CHAT_MIN_GAP_MS = 500;
const MAX_MESSAGE_BYTES = 16 * 1024;
const MAX_CHAT_CHARS = 200;
const EMOTES = new Set(["wave", "dance", "sit"]);

const rooms = new Rooms();

/// DATABASE_URL မရှိရင် persistence မရှိတဲ့ mode — လောကက ပုံမှန်အလုပ်လုပ်ပြီး
/// ထွက်ရင် နေရာ မမှတ်ဘူး။ (Guest တွေက ဘယ်လိုမှ မမှတ်ဘူး — id က session
/// တိုင်း ပြောင်းလို့။)
const store = createStore(process.env.DATABASE_URL);

/// ၃၀ စက္ကန့်တစ်ခါ — spec ရဲ့ "player တစ်ယောက်လျှင် တစ်မိနစ် ၂ ကြိမ်ထက်
/// မပို" ဆိုတဲ့ ကန့်သတ်ချက်နဲ့ ကိုက်တယ်။
const FLUSH_MS = 30_000;
const PURGE_MS = 60 * 60 * 1000;

// ── HTTP ─────────────────────────────────────────────────────────────────────
// ★ ALB ရဲ့ health check က ဒီ endpoint ကို ခေါ်တယ်။ မရှိရင် target ကို
// unhealthy လုပ်ပြီး ECS က container ကို ထပ်ခါထပ်ခါ ပြန်စတယ် — WebSocket
// server က အလုပ်လုပ်နေတောင် ဘယ်တော့မှ တည်ငြိမ်မှာမဟုတ်ဘူး။
const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/health/") {
    const body = JSON.stringify({
      status: "ok",
      uptime: Math.round(process.uptime()),
      players: rooms.total(),
      rooms: {
        city: rooms.count("city"),
        farm: rooms.count("farm"),
        snow: rooms.count("snow"),
        sky: rooms.count("sky"),
      },
    });
    res.writeHead(200, {
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    res.end(body);
    return;
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
});

// ★ WebSocket ကို HTTP server **ပေါ်မှာ** တင်ရတယ် — သီးခြား port ၂ ခုဆိုရင်
// ALB target group တစ်ခုက တစ်ခုပဲ စစ်လို့ရမယ်။
const wss = new WebSocketServer({ server, maxPayload: MAX_MESSAGE_BYTES });

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

// ── Persistence ──────────────────────────────────────────────────────────────
/// player တစ်ယောက်ရဲ့ နေရာကို DB ထဲ တစ်ခါ ရေးတယ်။
///
/// ★ `minutes` က **ဒီတစ်ခါအတွက်သာ** ပေါင်းထည့်မယ့် အချိန် (flushedAt ကနေ
///   အခုထိ) — session စုစုပေါင်းကို ပို့ရင် flush ၂ ခါလုပ်တာနဲ့ total_minutes
///   က ၂ ဆ တက်သွားမယ်။
/// ★ column က integer ဖြစ်လို့ **အပိုင်းကိန်းကို ကိုယ့်ဘက်မှာ သိမ်းထားရမယ်**
///   (`minuteDebt`) — ၃၀ စက္ကန့်တစ်ခါ flush မှာ 0.5 ကို round လုပ်ရင် ၁ ဖြစ်ပြီး
///   တစ်မိနစ်ကို ၂ မိနစ် အဖြစ် ရေတွက်မိမယ်။
/// ★ Guest ကို မသိမ်းဘူး — id က session တိုင်း ပြောင်းလို့ profiles ထဲမှာ
///   မရှိဘူး (FK ကျမယ်)၊ ပြီးတော့ ပြန်ဖတ်စရာလည်း ဘယ်တော့မှ မရှိဘူး။
async function flushPlayer(player) {
  if (!store.enabled || !player.authed) return;

  const now = Date.now();
  const elapsed = (now - player.flushedAt) / 60_000;
  // ရွှေ့လည်း မရွှေ့ဘူး၊ ၁ မိနစ်တောင် မပြည့်သေးဘူးဆိုရင် ရေးစရာ ဘာမှမရှိ
  if (!player.dirty && player.minuteDebt + elapsed < 1) return;

  // ★ တိုင်းတာပြီးမှ reset — await နောက်မှာ reset လုပ်ရင် အဲဒီအတွင်း ရွှေ့တာ
  //   ပျောက်မယ်။
  player.dirty = false;
  player.flushedAt = now;
  player.minuteDebt += elapsed;
  const minutes = Math.floor(player.minuteDebt);
  player.minuteDebt -= minutes; // ကျန်တဲ့ အပိုင်းကိန်းက နောက်တစ်ခါအတွက်

  try {
    await store.savePlayer(player.id, {
      name: player.name,
      x: player.x,
      y: player.y,
      z: player.z,
      ry: player.ry,
      room: player.room,
      minutes,
    });
  } catch (err) {
    console.error("[mv] flush failed:", err.message);
  }
}

/// ၃၀ စက္ကန့်တစ်ခါ ရွှေ့ထားသူတွေကိုသာ သိမ်းတယ်။ ဒါက player တစ်ယောက်လျှင်
/// တစ်မိနစ်မှာ write ၂ ကြိမ် — db.t4g.micro ခံနိုင်တဲ့ နှုန်း။
const flusher = store.enabled
  ? setInterval(() => {
      for (const player of rooms.everyone()) void flushPlayer(player);
    }, FLUSH_MS)
  : null;

/// PII — chat log ကို ၃၀ ရက်ပြီးရင် ဖျက်တယ်။ Task ၂ လုံးဆိုရင် ၂ ခါ run
/// ဖြစ်မယ် ဒါပေမယ့် delete က idempotent ဖြစ်လို့ ပြဿနာမရှိဘူး။
const purger = store.enabled
  ? setInterval(() => {
      void store
        .purgeOldChat()
        .then((n) => {
          if (n) console.log(`[mv] purged ${n} old chat row(s)`);
        })
        .catch(() => {});
    }, PURGE_MS)
  : null;
if (purger) purger.unref();

wss.on("connection", async (ws, req) => {
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  const url = new URL(req.url || "/", "http://localhost");
  const room = normalizeRoom(url.searchParams.get("room"));
  const ticket = url.searchParams.get("ticket");

  const who = identify({
    ticket,
    requireAuth: REQUIRE_AUTH,
    secret: TICKET_SECRET,
    guestId: "g_" + crypto.randomBytes(6).toString("hex"),
  });

  if (!who) {
    // 4001 = ကိုယ်ပိုင် code: "ဝင်ခွင့်မရှိ"။ Client က ဒါကို ဖတ်ပြီး ticket
    // အသစ်တောင်းမလား၊ login စာမျက်နှာပို့မလား ဆုံးဖြတ်တယ်။
    ws.close(4001, "auth required");
    return;
  }

  const player = {
    id: who.userId,
    ws,
    room,
    name: who.name,
    authed: who.authed,
    x: 0,
    y: 0,
    z: 12,
    ry: Math.PI,
    emote: null,
    lastMoveAt: Date.now(),
    lastChatAt: 0,
    // ── persistence ───────────────────────────────────────────────────────
    joinedAt: Date.now(),
    flushedAt: Date.now(),
    /// မိနစ်ရဲ့ အပိုင်းကိန်း — flush ကြားထဲမှာ လက်ကျန်အဖြစ် သယ်သွားတယ်
    minuteDebt: 0,
    /// ရွှေ့ပြီးမှ သိမ်းတယ် — ငြိမ်နေတဲ့သူကို ၃၀ စက္ကန့်တိုင်း ထပ်ရေးနေစရာမလို
    dirty: false,
  };

  // ── နေရာဟောင်း ပြန်ယူ ─────────────────────────────────────────────────
  // ★ Room တူမှသာ နေရာကို ပြန်သုံးတယ် — farm မှာ ထွက်ခဲ့တဲ့ coordinate ကို
  // city ထဲ ချလိုက်ရင် နံရံထဲ ဒါမှမဟုတ် လောကအပြင်ဘက် ရောက်နေမယ်။
  if (player.authed && store.enabled) {
    try {
      const saved = await store.loadPlayer(player.id);
      if (saved && saved.room === room) {
        player.x = saved.x;
        player.y = saved.y;
        player.z = saved.z;
        player.ry = saved.ry;
      }
    } catch {
      // DB ကျနေရင် spawn မှာ စတယ် — ဝင်ခွင့်ကို ဘယ်တော့မှ မပိတ်ဘူး
    }
    // ခဏကြာသွားရင် socket က ပိတ်သွားနိုင်တယ်
    if (ws.readyState !== 1) return;
  }

  // ★ တစ်ယောက်တည်း tab ၂ ခုဖွင့်ရင် အဟောင်းကို ဖြုတ်တယ် — မဖြုတ်ရင်
  // id တူတဲ့ player ၂ ခု room ထဲရှိပြီး နောက်ဆုံးဝင်တဲ့သူက အရင်သူကို
  // Map ထဲမှာ ဖျက်လိုက်လို့ ပထမ socket က မြင်ရဦးမယ် ဒါပေမယ့် ဘယ်တော့မှ
  // ထွက်လို့မရတဲ့ ghost ဖြစ်နေမယ်။
  const existing = rooms.get(room).get(player.id);
  if (existing && existing.ws !== ws) {
    existing.ws.close(4002, "signed in elsewhere");
    rooms.remove(room, player.id);
    rooms.broadcast(room, { type: "leave", id: player.id });
  }

  rooms.add(room, player);

  send(ws, {
    type: "init",
    id: player.id,
    room,
    name: player.name,
    authed: player.authed,
    // ★ Server ရဲ့ နာရီ — client တွေအားလုံး နေ့/ည တူညီဖို့ (Phase 5)
    serverTime: Date.now(),
    players: rooms.snapshot(room, player.id),
  });

  rooms.broadcast(
    room,
    {
      type: "join",
      id: player.id,
      state: {
        x: player.x,
        y: player.y,
        z: player.z,
        ry: player.ry,
        name: player.name,
        authed: player.authed,
      },
    },
    player.id,
  );

  ws.on("message", (raw) => {
    // maxPayload က ws ကနေ ကာထားပြီးသား၊ ဒါက ဒုတိယအလွှာ
    if (raw.length > MAX_MESSAGE_BYTES) {
      ws.close(1009, "message too large");
      return;
    }

    let msg;
    try {
      msg = JSON.parse(raw.toString("utf8"));
    } catch {
      return; // JSON မဟုတ်တာ တိတ်တိတ်ပစ် — ပြန်ဖြေရင် flood တိုက်ဖို့ လမ်းပေးရာ
    }
    if (!msg || typeof msg.type !== "string") return;

    switch (msg.type) {
      case "update": {
        const x = Number(msg.x);
        const y = Number(msg.y);
        const z = Number(msg.z);
        const ry = Number(msg.ry);
        if (![x, y, z, ry].every(Number.isFinite)) return;

        // ── Anti-cheat ────────────────────────────────────────────────────
        const now = Date.now();
        const dt = Math.max(0.05, (now - player.lastMoveAt) / 1000);
        const dist = Math.hypot(x - player.x, z - player.z);
        const allowed = MAX_SPEED * SPEED_TOLERANCE * dt + 0.5;
        if (dist > allowed) {
          // ★ ငြင်းတယ် = နေရာအဟောင်းကို ပြန်ပို့တယ်။ တိတ်တိတ်ပစ်လိုက်ရင်
          // cheat client က ကိုယ့်ဘာသာ ရှေ့ဆက်သွားနေပြီး တခြားသူတွေမြင်တဲ့
          // နေရာနဲ့ ကွဲသွားမယ်။
          send(ws, { type: "correct", x: player.x, y: player.y, z: player.z });
          return;
        }
        // လောကအပြင်ဘက် / ကောင်းကင်ထဲ ခုန်တက်တာကိုလည်း ပိတ်
        if (Math.hypot(x, z) > WORLD_RADIUS || y < -5 || y > MAX_Y) {
          send(ws, { type: "correct", x: player.x, y: player.y, z: player.z });
          return;
        }

        player.x = x;
        player.y = y;
        player.z = z;
        player.ry = ry;
        player.lastMoveAt = now;
        player.dirty = true;

        rooms.broadcast(player.room, { type: "update", id: player.id, x, y, z, ry }, player.id);
        break;
      }

      case "chat": {
        const now = Date.now();
        if (now - player.lastChatAt < CHAT_MIN_GAP_MS) return; // rate limit
        const text = String(msg.text || "").slice(0, MAX_CHAT_CHARS).trim();
        if (!text) return;
        player.lastChatAt = now;
        const out = {
          type: "chat",
          id: player.id,
          name: player.name,
          authed: player.authed,
          text,
        };
        send(ws, out); // ကိုယ့်စာကို ကိုယ်လည်း မြင်ရမယ်
        rooms.broadcast(player.room, out, player.id);
        // Moderation log — best-effort၊ chat က DB ကို ဘယ်တော့မှ မစောင့်ရ
        void store.logChat(player.id, player.name, player.room, text);
        break;
      }

      case "emote": {
        // ★ whitelist — client က ပို့လာတဲ့ string ကို အတိုင်း relay လုပ်ရင်
        // တခြား client တွေဆီ ဘာမဆို ထည့်ပို့လို့ရသွားမယ်။
        const e = msg.emote === null ? null : String(msg.emote);
        if (e !== null && !EMOTES.has(e)) return;
        player.emote = e;
        rooms.broadcast(player.room, { type: "emote", id: player.id, emote: e }, player.id);
        break;
      }

      case "setname": {
        // ★ Auth ရှိရင် နာမည်က token ကလာရမယ် — client ကို ခွင့်ပြုရင်
        // ဘယ်သူမဆို တခြားသူ့နာမည်နဲ့ ဝင်လို့ရသွားမယ်။
        if (player.authed) return;
        // Control character တွေကို ဖယ် — chat/nametag မှာ layout ဖျက်လို့ရတယ်
        const name = String(msg.name || "")
          .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
          .slice(0, 24)
          .trim();
        if (!name) return;
        player.name = name;
        rooms.broadcast(
          player.room,
          { type: "name", id: player.id, name, authed: false },
          player.id,
        );
        break;
      }

      default:
        break;
    }
  });

  const drop = () => {
    rooms.remove(player.room, player.id);
    rooms.broadcast(player.room, { type: "leave", id: player.id });
    // ★ ထွက်ချိန်မှာ မဖြစ်မနေ သိမ်းရမယ် — ၃၀ စက္ကန့် flush ကို စောင့်ရင်
    // ထွက်သွားတဲ့ ၂၉ စက္ကန့်စာ ရွှေ့ခဲ့တာ ပျောက်မယ်။
    void flushPlayer(player);
  };
  ws.on("close", drop);
  ws.on("error", drop);
});

// ── Heartbeat ────────────────────────────────────────────────────────────────
// ★ TCP က ဖုန်းရဲ့ WiFi ပြတ်သွားတာကို ချက်ချင်းမသိဘူး — socket က "ဖွင့်နေတယ်"
// လို့ပဲ ပြနေမယ်။ Ping မပြန်တဲ့သူကို ဖြုတ်မှ ghost player တွေ မကျန်တော့ဘူး။
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_MS);

// ── Graceful shutdown ────────────────────────────────────────────────────────
// ★ ECS က deploy တိုင်း SIGTERM ပို့တယ်။ ဘာမှမလုပ်ဘဲ ထွက်သွားရင် client တွေက
// "connection ပြတ်သွားပြီ" ကို timeout နဲ့မှ သိရမယ် (၃၀ စက္ကန့်လောက်)။
// 1001 = "going away" — client က ချက်ချင်း ပြန်ချိတ်လို့ရတယ်။
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[mv] ${signal} — closing ${wss.clients.size} connection(s)`);
  clearInterval(heartbeat);
  if (flusher) clearInterval(flusher);
  if (purger) clearInterval(purger);

  // Client တွေ မထွက်သေးရင်တောင် ၁၀ စက္ကန့်ထက် မစောင့်ဘူး
  const hardStop = setTimeout(() => process.exit(0), 10_000);
  hardStop.unref();

  // ★ Socket တွေ မပိတ်ခင် သိမ်းရမယ် — deploy တိုင်း (ECS က SIGTERM ပို့တယ်)
  // player တိုင်းရဲ့ နောက်ဆုံးနေရာ မပျောက်ရ။ ပိတ်ပြီးမှ ဆိုရင် close handler
  // က async ဖြစ်လို့ process က အရင် ထွက်သွားနိုင်တယ်။
  try {
    await Promise.all([...rooms.everyone()].map((p) => flushPlayer(p)));
  } catch {
    /* သိမ်းလို့မရလည်း ထွက်ရမယ် — ECS က ၃၀ စက္ကန့်ပဲ စောင့်တယ် */
  }

  for (const ws of wss.clients) {
    try {
      ws.close(1001, "server restarting");
    } catch {
      /* ignore */
    }
  }
  await store.close().catch(() => {});
  server.close(() => process.exit(0));
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

server.listen(PORT, () => {
  console.log(
    `[mv] listening on :${PORT} · auth=${REQUIRE_AUTH ? "required" : "guest ok"}`,
  );
});
