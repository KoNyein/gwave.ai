"use strict";

const http = require("http");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");

const { Rooms, normalizeRoom } = require("./rooms");
const { identify } = require("./auth");

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

wss.on("connection", (ws, req) => {
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
  };

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
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[mv] ${signal} — closing ${wss.clients.size} connection(s)`);
  clearInterval(heartbeat);
  for (const ws of wss.clients) {
    try {
      ws.close(1001, "server restarting");
    } catch {
      /* ignore */
    }
  }
  server.close(() => process.exit(0));
  // Client တွေ မထွက်သေးရင်တောင် ၁၀ စက္ကန့်ထက် မစောင့်ဘူး
  setTimeout(() => process.exit(0), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

server.listen(PORT, () => {
  console.log(
    `[mv] listening on :${PORT} · auth=${REQUIRE_AUTH ? "required" : "guest ok"}`,
  );
});
