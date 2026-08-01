"use strict";

const http = require("http");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");

const { Rooms, normalizeRoom, ROOMS, GATED_ROOMS } = require("./rooms");
const { identify } = require("./auth");
const { createStore } = require("./store");
const { createBus } = require("./bus");
const { createWeb3 } = require("./web3");
const { createWeatherDirector } = require("./weather");

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
const weather = createWeatherDirector(ROOMS);

/// DATABASE_URL မရှိရင် persistence မရှိတဲ့ mode — လောကက ပုံမှန်အလုပ်လုပ်ပြီး
/// ထွက်ရင် နေရာ မမှတ်ဘူး။ (Guest တွေက ဘယ်လိုမှ မမှတ်ဘူး — id က session
/// တိုင်း ပြောင်းလို့။)
const store = createStore(process.env.DATABASE_URL);

/// Web3 — မထည့်ထားရင် ပိတ်ထားတယ်။ ★ ပိတ်ထားရင် token-gated room ကို
/// **ဘယ်သူမှ မဝင်ရဘူး** (ဖွင့်ပေးလိုက်တာ မဟုတ်ဘူး) — စစ်လို့မရရင်
/// ငြင်းရမယ်၊ မဟုတ်ရင် env တစ်ခု ဖျောက်လိုက်ရုံနဲ့ ဂိတ်က ပျောက်သွားမယ်။
const web3 = createWeb3();

/// ၃၀ စက္ကန့်တစ်ခါ — spec ရဲ့ "player တစ်ယောက်လျှင် တစ်မိနစ် ၂ ကြိမ်ထက်
/// မပို" ဆိုတဲ့ ကန့်သတ်ချက်နဲ့ ကိုက်တယ်။
const FLUSH_MS = 30_000;
const PURGE_MS = 60 * 60 * 1000;

/// ── Task များခု (Phase 6.2) ─────────────────────────────────────────────
/// ★ SYNC က မဖြစ်မနေလိုတယ် — message တစ်ခုချင်းနဲ့ ခြေရာခံရင် task အသစ်
///   တက်လာချိန်မှာ **ငြိမ်နေတဲ့ player တွေကို ဘယ်တော့မှ မမြင်ရဘူး**
///   (မရွှေ့ရင် update မပို့လို့)။ ၅ စက္ကန့်တစ်ခါ စာရင်းအပြည့်အစုံ ပို့တယ်။
/// ★ GHOST_TTL က SYNC ရဲ့ ၃ ဆ — task တစ်လုံး ရုတ်တရက် သေရင် သူ့လူတွေက
///   ၁၅ စက္ကန့်အတွင်း ပျောက်သွားမယ်၊ ကြားထဲ packet တစ်ခု ကျသွားရုံနဲ့
///   လူတွေ မှိတ်တုတ်မှိတ်တုတ် မဖြစ်ဘူး။
/// ရာသီဥတုကို ၃၀ စက္ကန့်တစ်ခါ စစ်တယ် — ပြောင်းချိန်က ၅–၁၅ မိနစ်မို့
/// ဒီထက် မကြာခဏ စစ်စရာ မလိုဘူး။
const WEATHER_TICK_MS = 30_000;

/// ★ ယာဉ်ရဲ့ နေရာကို driver ရဲ့ client က တွက်တယ်။ Server က relay +
/// **speed cap** ပဲ လုပ်တယ် — cap မရှိရင် client ကို ပြင်ပြီး ကားကို
/// တစ်စက္ကန့် ၁၀၀၀ unit မောင်းလို့ရမယ်။
const VEHICLE_MAX_SPEED = 22 * 1.5;

const SYNC_MS = 5_000;
const GHOST_TTL_MS = 15_000;

/// ── နေရာတွေကို တစ်စုတည်း ပို့ခြင်း ─────────────────────────────────────────
/// ★ ဒါက scale ရဲ့ အဓိကသော့ချက်။ player တစ်ယောက် ရွှေ့တိုင်း သီးခြား
///   message တစ်ခုစီ ပို့ရင် fan-out က **n²** ဖြစ်တယ် — player ၂၀၀ × 15Hz
///   × ၂၀၀ လက်ခံသူ = တစ်စက္ကန့် `ws.send` ခေါ်မှု ၅၆၀,၀၀၀။ တိုင်းတာကြည့်တော့
///   core တစ်ခုလုံး ၉၈% ကုန်တယ် (loadtest.js)။
/// ★ 15Hz မှာ တစ်ခါတည်း စုပို့ရင် လက်ခံသူတစ်ယောက်လျှင် တစ်တစ်ခါပဲ ဖြစ်ပြီး
///   send ခေါ်မှုက n² ကနေ n ဆင်းသွားတယ်။ Latency က မတိုးဘူး — client က
///   ဘယ်လိုမှ 15Hz ထက် ပိုမပို့ဘူး။
const MOVE_FLUSH_MS = 66;
/// ဒဿမ ၂ နေရာ လုံလောက်တယ် — ၁ စင်တီမီတာ။ အပြည့်ရေးရင် entry တစ်ခုက
/// ၈၀ byte ဖြစ်ပြီး ၂၀၀ ယောက်စာက packet တစ်ခုကို ၁၆KB ရောက်တယ်။
const r2 = (n) => Math.round(n * 100) / 100;

/// Bus ကို message handler ရေးပြီးမှ ဆောက်တယ် (အောက်မှာ)
let bus = { enabled: false, publish() {}, async start() {}, async close() {} };

/// Local socket တွေဆီ ပို့ပြီး တခြား task တွေဆီလည်း ထပ်ပို့တယ်။
/// ★ `exceptId` က **local အတွက်သာ** — တခြား task မှာ အဲဒီ id ရှိမှာမဟုတ်ဘူး။
function emit(roomId, msg, exceptId) {
  rooms.broadcast(roomId, msg, exceptId);
  bus.publish(roomId, msg);
}

/// roomId -> Map<playerId, player> — ဒီ tick ထဲမှာ ရွှေ့ခဲ့သူတွေ
const moved = new Map();

function markMoved(player) {
  let m = moved.get(player.room);
  if (!m) {
    m = new Map();
    moved.set(player.room, m);
  }
  // ★ Map ဖြစ်လို့ tick တစ်ခုထဲမှာ ၅ ခါ ရွှေ့လည်း **နောက်ဆုံးနေရာ** ပဲ
  // ပါမယ် — ကြားထဲက နေရာတွေက ဘယ်သူ့မှ အသုံးမဝင်ဘူး။
  m.set(player.id, player);
}

const moveFlusher = setInterval(() => {
  for (const [roomId, m] of moved) {
    if (m.size === 0) continue;
    const p = [];
    for (const pl of m.values()) p.push([pl.id, r2(pl.x), r2(pl.y), r2(pl.z), r2(pl.ry)]);
    m.clear();
    // ★ ရွှေ့သူကိုပါ ပြန်ပို့တယ် — client က ကိုယ့် id ကို remotes ထဲ
    // မထားလို့ ကိုယ့်ဟာကို သူ့ဘာသာ လျစ်လျူရှုတယ်။ id တစ်ခုချင်း ခွဲပြီး
    // packet သီးသန့် ဆောက်ရင် စုပို့တဲ့ အကျိုးကျေးဇူး ပျောက်သွားမယ်။
    emit(roomId, { type: "updates", p });
  }
}, MOVE_FLUSH_MS);

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

/// Gwave အကောင့်နဲ့ ချိတ်ထားတဲ့ wallet ကို DB ကနေ ရှာတယ် (SIWE က
/// `/api/metaverse/siwe/verify` မှာ သိမ်းထားတာ)။
/// ★ Client ကနေ wallet address ကို **လက်မခံရ** — ဘယ်သူမဆို တခြားသူရဲ့
/// address ကို ပြောပြီး သူ့ NFT နဲ့ ဝင်လို့ရသွားမယ်။
async function lookupWallet(userId) {
  if (!store.enabled) return null;
  try {
    const saved = await store.loadPlayer(userId);
    return saved?.wallet ?? null;
  } catch {
    return null;
  }
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

// ── Task များခု: တခြား task ကနေ လာတဲ့ message ─────────────────────────────
/// ★ ဒီမှာ **ပြန် publish မလုပ်ရ** — လုပ်ရင် task ၂ လုံးက message တစ်ခုကို
///   အဆုံးမရှိ တစ်ယောက်ဆီတစ်ယောက် ပစ်ပေးနေမယ် (broadcast storm)။
function onBusMessage(roomId, msg, origin) {
  switch (msg.type) {
    case "sync":
      rooms.syncGhosts(roomId, origin, msg.players);
      return; // sync က ကိုယ်တွင်းသုံး — client ဆီ မပို့ဘူး
    case "join":
      rooms.setGhost(roomId, msg.id, msg.state ?? {}, origin);
      break;
    case "leave":
      rooms.removeGhost(roomId, msg.id);
      break;
    case "update":
      rooms.setGhost(roomId, msg.id, { x: msg.x, y: msg.y, z: msg.z, ry: msg.ry }, origin);
      break;
    case "updates":
      for (const e of msg.p ?? []) {
        rooms.setGhost(roomId, e[0], { x: e[1], y: e[2], z: e[3], ry: e[4] }, origin);
      }
      break;
    case "emote":
      rooms.setGhost(roomId, msg.id, { emote: msg.emote }, origin);
      break;
    case "name":
      rooms.setGhost(roomId, msg.id, { name: msg.name, authed: false }, origin);
      break;
    case "chat":
    case "weather":
    case "vstate":
    case "mounted":
    case "dismounted":
      break; // state မရှိဘူး ဒါမှမဟုတ် ယာဉ် lock က room-local — ပြရုံပဲ
    default:
      return; // မသိတဲ့ type ကို client ဆီ ထပ်မပို့ဘူး
  }
  rooms.broadcast(roomId, msg);
}

bus = createBus(process.env.REDIS_URL, ROOMS, onBusMessage);

/// ၅ စက္ကန့်တစ်ခါ ကိုယ့် task ပေါ်က player စာရင်း အပြည့်အစုံ ကြေညာတယ်။
const syncer = bus.enabled
  ? setInterval(() => {
      for (const roomId of ROOMS) {
        const players = rooms.localSnapshot(roomId);
        // ★ ဗလာဆိုလည်း ပို့ရမယ် — မပို့ရင် နောက်ဆုံးလူ ထွက်သွားတဲ့ task ရဲ့
        // ဂိုးစ်တွေက တခြား task မှာ TTL ကုန်တဲ့အထိ ကျန်နေမယ်။
        bus.publish(roomId, { type: "sync", players });
      }
      for (const [roomId, id] of rooms.sweepGhosts(GHOST_TTL_MS)) {
        rooms.broadcast(roomId, { type: "leave", id });
      }
    }, SYNC_MS)
  : null;

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

  // ── Token-gated room (Phase 7.6) ──────────────────────────────────────
  // ★ ဒီစစ်ဆေးမှုက **server မှာသာ** ဖြစ်ရမယ်။ Client မှာ ခလုတ်ဖျောက်ထားရုံ
  // ဒါမှမဟုတ် `room=vip` ကို URL မှာ မပြရုံနဲ့ ဘာမှ မကာကွယ်ဘူး —
  // WebSocket URL ကို လက်နဲ့ရိုက်ပြီး ချိတ်လို့ရတယ်။
  if (GATED_ROOMS.has(room)) {
    if (!player.authed) {
      ws.close(4003, "wallet required");
      return;
    }
    const wallet = await lookupWallet(player.id);
    if (!wallet) {
      ws.close(4003, "wallet required");
      return;
    }
    // ★ fail-closed — RPC ကျနေရင် "ပိုင်တယ်" လို့ မယူဆရ။
    const owns = await web3.ownsLand(wallet);
    if (!owns) {
      ws.close(4004, "NFT required");
      return;
    }
    if (ws.readyState !== 1) return;
  }

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
    emit(room, { type: "leave", id: player.id });
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
    // ★ ဝင်လာတာနဲ့ မှန်တဲ့ရာသီဥတု — မဟုတ်ရင် ပထမ ၅ မိနစ်လုံး
    // ကျန်တဲ့သူတွေနဲ့ မတူတဲ့ မိုးလေဝသထဲ ရောက်နေမယ်
    weather: weather.get(room),
    players: rooms.snapshot(room, player.id),
  });

  emit(
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

        // ★ ချက်ချင်း မပို့ဘူး — 15Hz tick မှာ room တစ်ခုလုံးအတွက်
        // တစ်ခါတည်း စုပို့တယ် (moveFlusher)။
        markMoved(player);
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
        emit(player.room, out, player.id);
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
        emit(player.room, { type: "emote", id: player.id, emote: e }, player.id);
        break;
      }

      case "mount": {
        // ★ ယာဉ်တစ်စီးမှာ driver တစ်ယောက်တည်း — server က ဆုံးဖြတ်တယ်။
        // Client ၂ ခု တစ်ပြိုင်နက် နှိပ်ရင် တစ်ယောက်ပဲ ရရမယ်။
        const vid = String(msg.vehicleId || "");
        if (!vid) return;
        const held = rooms.vehicleDriver(player.room, vid);
        if (held && held !== player.id) {
          send(ws, { type: "mountDenied", vehicleId: vid });
          return;
        }
        rooms.setVehicleDriver(player.room, vid, player.id);
        emit(player.room, { type: "mounted", vehicleId: vid, playerId: player.id });
        break;
      }

      case "dismount": {
        const vid = rooms.releaseVehicles(player.room, player.id);
        for (const id of vid) {
          emit(player.room, { type: "dismounted", vehicleId: id, playerId: player.id });
        }
        break;
      }

      case "vstate": {
        const vid = String(msg.vehicleId || "");
        // ★ မောင်းနေတဲ့သူကသာ ပို့လို့ရရမယ် — မဟုတ်ရင် ဘယ်သူမဆို
        // တခြားသူ့ကားကို နေရာအနှံ့ ပစ်ရွှေ့လို့ရမယ်။
        if (rooms.vehicleDriver(player.room, vid) !== player.id) return;
        const vx = Number(msg.x);
        const vy = Number(msg.y);
        const vz = Number(msg.z);
        const vry = Number(msg.ry);
        const vspeed = Number(msg.speed);
        if (![vx, vy, vz, vry, vspeed].every(Number.isFinite)) return;
        if (Math.abs(vspeed) > VEHICLE_MAX_SPEED) return;
        if (Math.hypot(vx, vz) > WORLD_RADIUS * 2.2 || vy < -5 || vy > 80) return;
        emit(
          player.room,
          { type: "vstate", vehicleId: vid, x: vx, y: vy, z: vz, ry: vry, speed: vspeed },
          player.id,
        );
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
        emit(
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
    // ★ Driver ပြတ်သွားရင် ယာဉ် လွတ်ရမယ် — မဟုတ်ရင် အဲဒီယာဉ်ကို
    // ဘယ်သူမှ ဘယ်တော့မှ မစီးရတော့ဘူး
    for (const id of rooms.releaseVehicles(player.room, player.id)) {
      rooms.broadcast(player.room, { type: "dismounted", vehicleId: id, playerId: player.id });
      bus.publish(player.room, { type: "dismounted", vehicleId: id, playerId: player.id });
    }
    rooms.remove(player.room, player.id);
    emit(player.room, { type: "leave", id: player.id });
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
/// ရာသီဥတု ပြောင်းရင် room တစ်ခုလုံးကို ပြောတယ်
const weatherTicker = setInterval(() => {
  for (const roomId of weather.due()) {
    emit(roomId, { type: "weather", ...weather.get(roomId) });
  }
}, WEATHER_TICK_MS);

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
  if (syncer) clearInterval(syncer);
  clearInterval(moveFlusher);
  clearInterval(weatherTicker);

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
  await bus.close().catch(() => {});
  server.close(() => process.exit(0));
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

server.listen(PORT, () => {
  console.log(
    `[mv] listening on :${PORT} · auth=${REQUIRE_AUTH ? "required" : "guest ok"}` +
      ` · db=${store.enabled ? "on" : "off"} · bus=${bus.enabled ? "redis" : "off"}`,
  );
  // ★ Bus ချိတ်မရလည်း server က ဆက်လုပ်ရမယ် — Redis ကျတာက task တစ်လုံးတည်း
  // အဖြစ် ကျဆင်းသွားတာပဲ ဖြစ်သင့်တယ်၊ လောကတစ်ခုလုံး ပိတ်သွားလို့မဟုတ်ဘူး။
  void bus.start().catch((err) => {
    console.error("[mv/bus] start failed:", err.message);
  });
});
