"use strict";

/// Arena runtime — match, snapshot နဲ့ mode တွေကို တစ်ခုတည်း အဖြစ် ချိတ်တယ်။
///
/// ★ `match.js` / `snapshot.js` / `modes/*.js` တွေက socket မသိတဲ့ logic တွေ။
///   ဒီ file က အဲဒါတွေကို တကယ့် room နဲ့ WebSocket ဆီ ချိတ်ပေးတဲ့ **တစ်ခုတည်း
///   သော နေရာ**။ ဒါကြောင့် logic တွေက စမ်းသပ်လို့ ရနေဆဲ ဖြစ်ပြီး၊ ဒီ file
///   ကတော့ ပါးလွှာအောင် ထားတယ် — ဒီမှာ ရေးလိုက်တဲ့ စည်းမျဉ်းတိုင်းက
///   test မရေးနိုင်တဲ့ စည်းမျဉ်း ဖြစ်သွားလို့။
///
/// ★ Player state က ၂ နေရာမှာ ရှိတယ် —
///   · `rooms` ထဲက player   — နေရာ၊ socket (metaverse တစ်ခုလုံးက သုံးတယ်)
///   · `match.players` ထဲက  — အမှတ်၊ အခန်းကဏ္ဍ (ဒီပွဲအတွက်သာ)
///   တစ်ခုတည်း ပေါင်းလိုက်ရင် ပွဲပြီးတိုင်း socket state ကိုပါ ရှင်းရမယ်။

const match = require("./match");
const snapshot = require("./snapshot");
const { hide } = require("./modes/hide");
const { roomDef, roomGameMode } = require("./rooms");

/// mode id -> implementation
const MODES = { hide };

/// roomId -> Match
const matches = new Map();
/// roomId -> Map<playerId, inputQueue>
const inputs = new Map();
/// roomId -> Map<playerId, prevSnapshotMap>   (delta အတွက်)
const deltas = new Map();

function modeFor(roomId) {
  return MODES[roomGameMode(roomId)] ?? null;
}

/// ★ Room တစ်ခုအတွက် match ကို ရယူ/ဆောက်တယ်။ Arena mode မဟုတ်တဲ့
///   room (assassin စတာ) ဆိုရင် `null` — အဲဒါတွေက ကိုယ်ပိုင်လမ်းစဉ်နဲ့
///   သွားနေဆဲ (spec က phase ၇ မှာမှ ပေါင်းခိုင်းတယ်)。
function matchFor(roomId) {
  if (!modeFor(roomId)) return null;
  let m = matches.get(roomId);
  if (!m) {
    const def = roomDef(roomId);
    m = match.createMatch({
      id: `${roomId}-${Date.now().toString(36)}`,
      roomId,
      mode: def.gameMode,
      config: { ...def.gameConfig, maxPlayers: def.maxPlayers },
    });
    matches.set(roomId, m);
    inputs.set(roomId, new Map());
    deltas.set(roomId, new Map());
  }
  return m;
}

function queueFor(roomId, playerId) {
  const perRoom = inputs.get(roomId);
  if (!perRoom) return null;
  let q = perRoom.get(playerId);
  if (!q) {
    q = snapshot.createInputQueue();
    perRoom.set(playerId, q);
  }
  return q;
}

// ── Message handlers ─────────────────────────────────────────────────────

/// `gJoin` — ပွဲထဲ ဝင်တယ်။ ကစားသမား ဒါမှမဟုတ် ကြည့်ရှုသူ ဖြစ်သွားမယ်။
function join(roomId, player, now = Date.now()) {
  const m = matchFor(roomId);
  if (!m) return null;
  const r = match.joinMatch(m, { id: player.id, name: player.name }, now);
  if (!r.ok) return { type: "gDenied", reason: r.reason, until: r.until ?? null };
  queueFor(roomId, player.id);
  return {
    type: "gJoined",
    role: r.role,
    state: m.state,
    mode: m.mode,
    minPlayers: m.minPlayers,
    endsAt: m.endsAt,
    countdownEndsAt: m.countdownEndsAt,
  };
}

/// `gInput` — ရွေ့လျားမှု。 ★ နေရာကို client က ပြောတယ်၊ ဒါပေမယ့်
///   `server.js` ရဲ့ anti-cheat က အဲဒါကို အရင် စစ်ပြီးသား ဖြစ်တယ်
///   (speed cap, world bounds)。 ဒီမှာ လုပ်တာက **ack မှတ်တာ** ပဲ —
///   client က ဘယ် input အထိ server လက်ခံပြီးပြီလဲ သိမှ reconcile လုပ်လို့ရမယ်။
function input(roomId, playerId, msg) {
  const q = queueFor(roomId, playerId);
  if (!q) return false;
  return snapshot.pushInput(q, msg);
}

/// `gAction` — mode ရဲ့ လုပ်ဆောင်ချက် (ဝှက်တမ်းမှာ `tag`)。
///
/// ★ `rooms` ကို ထည့်ပေးရတယ် — mode က ဖမ်းမိမမိကို **server ရဲ့ နေရာ**
///   နဲ့ တွက်တယ်။ နေရာတွေက socket player မှာ ရှိပြီး match player မှာ
///   မရှိလို့ အရင် ကူးရမယ်။ မကူးရင် အားလုံး (0,0) မှာ ရှိနေပြီး
///   တစ်ယောက်ကို တစ်ယောက် ချက်ချင်း ဖမ်းမိမယ်။
function action(rooms, roomId, player, action_, now = Date.now()) {
  const m = matches.get(roomId);
  const mode = modeFor(roomId);
  if (!m || !mode || m.state !== "live") return [];
  const me = m.players.get(player.id);
  if (!me) return [];
  syncPositions(roomId, m, rooms);
  return mode.onPlayerAction(m, me, action_, now) ?? [];
}

/// Player ထွက်သွားပြီ — `voluntary` က ခလုတ်နှိပ်ထွက်တာလား ပြတ်သွားတာလား။
function leave(roomId, playerId, now = Date.now(), { voluntary = true } = {}) {
  const m = matches.get(roomId);
  if (!m) return [];
  const out = [];
  match.leaveMatch(m, playerId, now, { voluntary });
  const mode = modeFor(roomId);
  if (mode?.onPlayerLeft && voluntary) out.push(...(mode.onPlayerLeft(m, playerId, now) ?? []));
  if (voluntary) inputs.get(roomId)?.delete(playerId);
  deltas.get(roomId)?.delete(playerId);
  return out;
}

// ── Tick ─────────────────────────────────────────────────────────────────

/// Match player တွေဆီ socket player ရဲ့ နေရာကို ကူးတယ်။
/// ★ ဒါက ရိုးရှင်းပေမယ့် အရေးကြီးတယ် — mode က ဖမ်းမိမမိကို ဒီနေရာနဲ့
///   တွက်တယ်။ မကူးရင် အားလုံး (0,0) မှာ ရှိနေပြီး တစ်ယောက်ကို တစ်ယောက်
///   ချက်ချင်း ဖမ်းမိမယ်။
function syncPositions(roomId, m, rooms) {
  const live = rooms?.rooms.get(roomId);
  if (!live) return;
  for (const p of m.players.values()) {
    const sock = live.get(p.id);
    if (!sock) continue;
    p.x = sock.x;
    p.y = sock.y;
    p.z = sock.z;
    p.ry = sock.ry;
  }
}

/// ★ Tick တစ်ခု — 20Hz。 `rooms` နဲ့ `emit` ကို ထည့်ပေးရတယ် (inject) —
///   ဒီ file က global ကို မမှီခိုစေချင်ဘူး၊ ပြီးတော့ test ကနေ fake
///   ထည့်လို့ရအောင်。
function tick(rooms, emit, now = Date.now()) {
  for (const [roomId, m] of matches) {
    const mode = modeFor(roomId);
    if (!mode) continue;

    syncPositions(roomId, m, rooms);

    // ၁။ Lifecycle
    const before = m.state;
    for (const ev of match.tickMatch(m, now)) {
      if (ev.type === "countdown") {
        emit(roomId, { type: "gState", state: "countdown", endsAt: m.countdownEndsAt });
      } else if (ev.type === "start") {
        // ★ Mode ကို ပွဲစပြီးမှ ခေါ်တယ် — countdown အလယ်မှာ ခေါ်လိုက်ရင်
        //   ရှာဖွေသူက ပွဲမစခင် ကတည်းက သိနေမယ်။
        for (const e of mode.onStart(m, now) ?? []) emit(roomId, gEvent(e));
        emit(roomId, { type: "gState", state: "live", endsAt: m.endsAt });
      } else if (ev.type === "end") {
        emit(roomId, { type: "gState", state: "ended", result: ev.result });
      } else if (ev.type === "waiting") {
        emit(roomId, { type: "gState", state: "waiting", reason: ev.reason });
      } else if (ev.type === "dropped") {
        for (const id of ev.ids) {
          for (const e of mode.onPlayerLeft?.(m, id, now) ?? []) emit(roomId, gEvent(e));
        }
        emit(roomId, { type: "gLeft", ids: ev.ids });
      }
    }

    // ၂။ Mode tick — ပွဲဖြစ်နေမှသာ
    if (m.state === "live") {
      for (const e of mode.onTick(m, now) ?? []) emit(roomId, gEvent(e));
      const done = mode.checkEnd(m, now);
      if (done) {
        match.endMatch(m, now, done);
        emit(roomId, { type: "gState", state: "ended", result: m.result });
      }
    }

    // ၃။ Snapshot — ကစားသမား တစ်ယောက်ချင်းစီအတွက် သီးသန့်
    if (m.state === "live" || m.state === "countdown") {
      pushSnapshots(roomId, m, rooms, now);
    }

    // ၄။ လူမရှိတော့ရင် ရှင်း — ★ room ကတော့ ကျန်ရမယ်
    if (before !== m.state && m.state === "waiting" && match.isEmpty(m)) {
      matches.delete(roomId);
      inputs.delete(roomId);
      deltas.delete(roomId);
    }
  }
}

function pushSnapshots(roomId, m, rooms, now) {
  const live = rooms.rooms.get(roomId);
  if (!live) return;
  const prevAll = deltas.get(roomId);
  const bodies = [...m.players.values()].filter((p) => p.disconnectedUntil === null);

  for (const p of bodies) {
    const sock = live.get(p.id);
    if (!sock || sock.ws.readyState !== 1) continue;
    const q = queueFor(roomId, p.id);
    // ★ Ack — client က ဒီ seq အထိ server လက်ခံပြီးပြီလို့ သိပြီး၊
    //   ကျန်တာကို ကိုယ့်ဘက်မှာ ပြန်တွက်တယ် (reconciliation)。
    snapshot.drainInputs(q);

    let prev = prevAll.get(p.id);
    if (!prev) {
      prev = new Map();
      prevAll.set(p.id, prev);
    }
    const full = snapshot.buildSnapshot(p, bodies, now, { ackSeq: q.lastSeq });
    const delta = snapshot.diffSnapshot(prev, full);
    // ★ ဘာမှ မပြောင်းရင် မပို့ဘူး — ငြိမ်နေတဲ့ စောင့်ခန်းမှာ ဒါက
    //   traffic အားလုံးနီးပါး ဖြတ်ပေးတယ်။
    if (delta.players.length === 0 && !delta.gone) continue;
    sock.ws.send(JSON.stringify(delta));
  }
}

/// Mode event ကို wire format ဆီ — mode တွေက ကိုယ့်စကားနဲ့ ပြောတယ်
/// (`role`, `tagged`, `score`)၊ client က `g` prefix နဲ့ တစ်သားတည်း လိုချင်တယ်။
///
/// ★ `{ type: "gEvent", ...e }` လို့ ရေးလို့ **မရဘူး** — `e` မှာ ကိုယ်ပိုင်
///   `type` ရှိလို့ spread က `"gEvent"` ကို ဖျက်ပစ်တယ်။ ရလဒ်က mode event
///   တိုင်း အမည်မှား ထွက်သွားပြီး client က တစ်ခုမှ မမှတ်မိတော့ဘူး —
///   ပြီးတော့ ဘာ error မှ မတက်ဘူး။ ဒါကြောင့် mode ရဲ့ type ကို `kind`
///   အောက် ရွှေ့တယ်။
function gEvent(e) {
  const { type, ...rest } = e;
  return { type: "gEvent", kind: type, ...rest };
}

/// ★ ပွဲအခြေအနေကို အသစ်ဝင်လာသူဆီ တစ်ခါတည်း ပို့ဖို့。
function stateOf(roomId) {
  const m = matches.get(roomId);
  if (!m) return null;
  return {
    state: m.state,
    mode: m.mode,
    minPlayers: m.minPlayers,
    endsAt: m.endsAt,
    countdownEndsAt: m.countdownEndsAt,
    result: m.result,
    players: [...m.players.values()].map((p) => ({ id: p.id, name: p.name, score: p.score })),
    modeState: publicModeState(m),
  };
}

/// ★ `modeState` ကို တိုက်ရိုက် မပို့ရ — ဝှက်တမ်းမှာ `scoredAt` လို
///   အတွင်းအချက်အလက်တွေ ပါတယ်၊ ပြီးတော့ mode တစ်ခုက အနာဂတ်မှာ
///   ပုန်းသူတွေရဲ့ နေရာ သိမ်းထားရင် အဲဒါ ပေါက်သွားမယ်။
function publicModeState(m) {
  const st = m.modeState ?? {};
  const out = {};
  if (st.seekerId) out.seekerId = st.seekerId;
  if (st.blindUntil) out.blindUntil = st.blindUntil;
  return out;
}

function stats() {
  const out = {};
  for (const [roomId, m] of matches) {
    out[roomId] = { state: m.state, players: m.players.size, spectators: m.spectators.size };
  }
  return out;
}

/// Test အတွက် — module state ကို ရှင်းတယ်။
function _reset() {
  matches.clear();
  inputs.clear();
  deltas.clear();
}

module.exports = {
  MODES,
  matchFor,
  modeFor,
  gEvent,
  join,
  input,
  action,
  leave,
  tick,
  stateOf,
  stats,
  matches,
  _reset,
};
