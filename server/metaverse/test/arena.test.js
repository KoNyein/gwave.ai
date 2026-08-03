"use strict";

/// Arena runtime — match/snapshot/mode ကို room နဲ့ socket ဆီ ချိတ်တဲ့ အလွှာ။
///
/// ★ ဒီ test တွေက ချိတ်ဆက်မှုကို စစ်တာ။ အောက်က module တွေက တစ်ခုချင်းစီ
///   မှန်နေပေမယ့် ချိတ်တဲ့နေရာမှာ မှားရင် — ဥပမာ နေရာကို မကူးရင် — ဂိမ်းက
///   "အလုပ်လုပ်နေတယ်" ပုံပေါက်ပြီး တကယ်က အားလုံး (0,0) မှာ ရှိနေမယ်။

const test = require("node:test");
const assert = require("node:assert/strict");

const arena = require("../arena");
const matchLib = require("../match");
const { BLIND_MS } = require("../modes/hide");
const { Rooms } = require("../rooms");

const ROOM = "hide-1";

/// socket player အတု — `ws.send` ကို မှတ်ထားတယ်
function fakeRooms(ids, positions = {}) {
  const rooms = new Rooms();
  const sent = new Map();
  for (const id of ids) {
    sent.set(id, []);
    rooms.add(ROOM, {
      id,
      name: id,
      x: positions[id]?.[0] ?? 0,
      y: 0,
      z: positions[id]?.[1] ?? 0,
      ry: 0,
      authed: true,
      ws: {
        readyState: 1,
        send(data) {
          sent.get(id).push(JSON.parse(data));
        },
      },
    });
  }
  return { rooms, sent };
}

function collector() {
  const events = [];
  return { emit: (roomId, msg) => events.push({ roomId, ...msg }), events };
}

function joinAll(ids) {
  for (const id of ids) arena.join(ROOM, { id, name: id }, 1000);
}

test.beforeEach(() => arena._reset());

test("a social room has no match", () => {
  assert.equal(arena.matchFor("city"), null);
  assert.equal(arena.join("city", { id: "a", name: "a" }), null);
});

test("joining a game room creates the match from the room definition", () => {
  const reply = arena.join(ROOM, { id: "a", name: "A" }, 1000);
  assert.equal(reply.type, "gJoined");
  assert.equal(reply.role, "player");
  assert.equal(reply.mode, "hide");
  assert.equal(reply.minPlayers, 3, "read from the room's gameConfig");
});

test("three players start a countdown, and twenty seconds later the match", () => {
  const { rooms } = fakeRooms(["a", "b", "c"]);
  joinAll(["a", "b", "c"]);
  const c = collector();

  arena.tick(rooms, c.emit, 2000);
  assert.ok(c.events.some((e) => e.type === "gState" && e.state === "countdown"));

  arena.tick(rooms, c.emit, 2000 + matchLib.COUNTDOWN_MS);
  assert.ok(c.events.some((e) => e.type === "gState" && e.state === "live"));
  // ★ ပွဲစချင်း ရှာဖွေသူ ကြေညာရမယ် — မကြေညာရင် ဘယ်သူမှ ဘာလုပ်ရမှန်း မသိဘူး
  assert.ok(c.events.some((e) => e.type === "gEvent" && e.role === "seeker"));
});

test("the seeker is only chosen once the match starts", () => {
  // ★ countdown အလယ်မှာ ရွေးလိုက်ရင် ရှာဖွေသူက ပွဲမစခင် ကတည်းက သိနေပြီး
  //   ကြိုပြင်ထားလို့ရမယ်။
  const { rooms } = fakeRooms(["a", "b", "c"]);
  joinAll(["a", "b", "c"]);
  const c = collector();
  arena.tick(rooms, c.emit, 2000);
  assert.equal(
    c.events.some((e) => e.type === "gEvent" && e.role === "seeker"),
    false,
  );
});

// ── ★ နေရာကူးခြင်း — ချိတ်ဆက်မှုရဲ့ အရေးအကြီးဆုံးအချက် ──────────────────

function liveMatch(positions) {
  const ids = Object.keys(positions);
  const { rooms, sent } = fakeRooms(ids, positions);
  joinAll(ids);
  const c = collector();
  arena.tick(rooms, c.emit, 2000);
  const start = 2000 + matchLib.COUNTDOWN_MS;
  arena.tick(rooms, c.emit, start);
  return { rooms, sent, c, start, match: arena.matches.get(ROOM) };
}

test("socket positions reach the match players", () => {
  // ★ မကူးရင် အားလုံး (0,0) မှာ ရှိနေပြီး ရှာဖွေသူက ပွဲစချင်း
  //   အားလုံးကို ဖမ်းမိမယ် — ဂိမ်းက အလုပ်လုပ်ပုံပေါက်ပြီး တကယ်က ပျက်နေတာ။
  const { match } = liveMatch({ a: [10, 0], b: [-30, 5], c: [0, 25] });
  assert.equal(match.players.get("a").x, 10);
  assert.equal(match.players.get("b").z, 5);
  assert.equal(match.players.get("c").z, 25);
});

test("a tag uses server positions, not what the client claims", () => {
  const { rooms, match, start } = liveMatch({ a: [0, 0], b: [1, 0], c: [50, 50] });
  // ★ ရှာဖွေသူကို ကြိုမမှန်းရဘူး — match id က timestamp ပါလို့ ရွေးချယ်မှုက
  //   run တိုင်း ကွဲတယ်။ ဘယ်သူ ဖြစ်နေလဲ ဖတ်ပြီးမှ နေရာချတယ်။
  const seekerId = match.modeState.seekerId;
  const victimId = ["a", "b", "c"].find((id) => id !== seekerId);
  const live = rooms.rooms.get(ROOM);
  live.get(seekerId).x = 0;
  live.get(seekerId).z = 0;
  const now = start + BLIND_MS + 1000;

  // ရန်သူကို ဝေးဝေးမှာ ထားလိုက်တယ် — client က ဘာပြောပြော မဖမ်းမိရဘူး
  live.get(victimId).x = 500;
  live.get(victimId).z = 0;
  const far = arena.action(
    rooms,
    ROOM,
    { id: seekerId },
    { type: "tag", targetId: victimId },
    now,
  );
  assert.deepEqual(far, []);

  // ကပ်လိုက်ရင် ရတယ်
  live.get(victimId).x = 1;
  const near = arena.action(
    rooms,
    ROOM,
    { id: seekerId },
    { type: "tag", targetId: victimId },
    now + 5000,
  );
  assert.ok(near.some((e) => e.type === "tagged"));
});

test("actions are ignored unless the match is live", () => {
  const { rooms } = fakeRooms(["a", "b", "c"]);
  joinAll(["a", "b", "c"]);
  assert.deepEqual(
    arena.action(rooms, ROOM, { id: "a" }, { type: "tag", targetId: "b" }, 2000),
    [],
    "no tagging in the lobby",
  );
});

// ── Snapshot ─────────────────────────────────────────────────────────────

test("snapshots reach the players once the match is live", () => {
  const { sent } = liveMatch({ a: [0, 0], b: [3, 0], c: [6, 0] });
  const snaps = sent.get("a").filter((m) => m.type === "snapshot");
  assert.ok(snaps.length > 0);
  assert.ok(snaps[0].players.some((p) => p.id === "a"), "you always see yourself");
});

test("a second identical tick sends nothing", () => {
  // ★ Delta — ငြိမ်နေတဲ့ စောင့်ခန်းမှာ ဒါက traffic အားလုံးနီးပါး ဖြတ်တယ်။
  const { rooms, sent, c, start } = liveMatch({ a: [0, 0], b: [3, 0], c: [6, 0] });
  const after = sent.get("a").length;
  arena.tick(rooms, c.emit, start + 50);
  assert.equal(sent.get("a").length, after, "nobody moved, so nothing was sent");
});

test("moving produces a fresh snapshot", () => {
  const { rooms, sent, c, start } = liveMatch({ a: [0, 0], b: [3, 0], c: [6, 0] });
  const before = sent.get("a").length;
  rooms.rooms.get(ROOM).get("b").x = 4;
  arena.tick(rooms, c.emit, start + 50);
  assert.ok(sent.get("a").length > before);
});

test("distant players are not in your snapshot", () => {
  const { sent } = liveMatch({ a: [0, 0], b: [3, 0], c: [500, 500] });
  const snap = sent.get("a").find((m) => m.type === "snapshot");
  assert.equal(snap.players.some((p) => p.id === "c"), false);
});

test("the snapshot carries an ack for the inputs it consumed", () => {
  const { rooms, sent, c, start } = liveMatch({ a: [0, 0], b: [3, 0], c: [6, 0] });
  arena.input(ROOM, "a", { seq: 7 });
  rooms.rooms.get(ROOM).get("a").x = 1;
  arena.tick(rooms, c.emit, start + 50);
  const last = sent.get("a").filter((m) => m.type === "snapshot").pop();
  assert.equal(last.ackSeq, 7);
});

test("input on a social room is refused", () => {
  assert.equal(arena.input("city", "a", { seq: 1 }), false);
});

// ── ထွက်ခြင်း ────────────────────────────────────────────────────────────

test("a disconnect holds the seat rather than removing the player", () => {
  const { match, start } = liveMatch({ a: [0, 0], b: [3, 0], c: [6, 0] });
  arena.leave(ROOM, "a", start + 1000, { voluntary: false });
  assert.ok(match.players.has("a"), "the seat is held for the grace period");
});

test("the seeker leaving hands the role over", () => {
  const { match, start } = liveMatch({ a: [0, 0], b: [3, 0], c: [6, 0] });
  const seekerId = match.modeState.seekerId;
  match.players.delete(seekerId);
  const events = arena.leave(ROOM, seekerId, start + 1000, { voluntary: true });
  assert.ok(events.some((e) => e.type === "role"));
  assert.notEqual(match.modeState.seekerId, seekerId);
});

test("a tick with an empty room does not throw", () => {
  // ★ Room ဗလာဖြစ်နေချိန်မှာ tick က ဆက်ပြေးနေဆဲ — ကျရင် ticker
  //   တစ်ခုလုံး ရပ်ပြီး ပွဲအားလုံး ခဲသွားမယ်။
  arena.join(ROOM, { id: "a", name: "A" }, 1000);
  const rooms = new Rooms();
  const c = collector();
  assert.doesNotThrow(() => arena.tick(rooms, c.emit, 5000));
});

// ── ★ modeState ပေါက်ကြားမှု ────────────────────────────────────────────

test("internal mode bookkeeping is not sent to clients", () => {
  // ★ `scoredAt` က အတွင်းအချက်အလက်။ အနာဂတ်မှာ mode တစ်ခုက ပုန်းသူတွေရဲ့
  //   နေရာ သိမ်းရင် ဒီကနေ ပေါက်သွားမယ် — allowlist နဲ့ ထုတ်တယ်။
  liveMatch({ a: [0, 0], b: [3, 0], c: [6, 0] });
  const st = arena.stateOf(ROOM);
  assert.ok(st.modeState.seekerId, "the role is public");
  assert.equal("scoredAt" in st.modeState, false);
  assert.equal("caught" in st.modeState, false);
  assert.equal("lastTagAt" in st.modeState, false);
});

test("stateOf is null for a room with no match", () => {
  assert.equal(arena.stateOf("city"), null);
  assert.equal(arena.stateOf(ROOM), null);
});

test("a mode event keeps its own name without overwriting the envelope", () => {
  // ★ `{ type: "gEvent", ...e }` လို့ ရေးရင် `e.type` က envelope ကို
  //   ဖျက်ပစ်ပြီး mode event တိုင်း အမည်မှား ထွက်သွားတယ် — client က
  //   တစ်ခုမှ မမှတ်မိဘဲ error လည်း မတက်ဘူး။ ဒါက အဲဒီ regression ကို
  //   ဖမ်းတယ်။
  const wire = arena.gEvent({ type: "role", id: "a", role: "seeker" });
  assert.equal(wire.type, "gEvent", "the envelope survives");
  assert.equal(wire.kind, "role", "the mode's own name moves to kind");
  assert.equal(wire.role, "seeker");
});
