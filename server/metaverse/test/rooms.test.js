"use strict";

/// Room type စနစ် (Arena spec A1) ရဲ့ စစ်ဆေးချက်များ။
///
/// ★ ဒီ test တွေက အများစုက **data ကို စစ်တာ** — logic မဟုတ်ဘူး။ ဘာလို့လဲ:
///   room သတ်မှတ်ချက်တွေက ဂိမ်းရဲ့ ဘေးကင်းရေးစည်းမျဉ်း ဖြစ်နေတယ်
///   ("ဒီမှာ လက်နက်ရလား"၊ "၁၈+ လား")。 Record တစ်ခုမှာ field တစ်ခု
///   မေ့ကျန်တာက bug မဟုတ်ဘဲ ဂိတ်ပေါက် ဖြစ်တယ်။

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  Rooms,
  normalizeRoom,
  roomDef,
  roomGameMode,
  isGameRoom,
  ROOMS,
  ROOM_DEFS,
  ADULT_ROOMS,
  GATED_ROOMS,
} = require("../rooms");

test("every room definition is complete", () => {
  for (const d of ROOM_DEFS) {
    assert.equal(typeof d.id, "string", `${d.id}: id`);
    assert.ok(d.id.length > 0, "id is not empty");
    assert.ok(d.type === "social" || d.type === "game", `${d.id}: type`);
    assert.equal(typeof d.mapId, "string", `${d.id}: mapId`);
    assert.ok(Number.isInteger(d.maxPlayers) && d.maxPlayers > 0, `${d.id}: maxPlayers`);
  }
});

test("room ids are unique", () => {
  const ids = ROOM_DEFS.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("a game room always names its mode", () => {
  // ★ mode မပါတဲ့ game room က lobby ဆောက်လို့ရပေမယ့် ဘာကစားရမှန်း
  //   မသိဘူး — ကစားသမားတွေ စောင့်ခန်းထဲမှာ ထာဝရ ကျန်နေမယ်။
  for (const d of ROOM_DEFS) {
    if (d.type !== "game") continue;
    assert.ok(d.gameMode, `${d.id} is a game room with no gameMode`);
  }
});

test("social rooms declare no game mode", () => {
  for (const d of ROOM_DEFS) {
    if (d.type === "social") assert.equal(d.gameMode, undefined, d.id);
  }
});

test("isGameRoom separates social from game", () => {
  assert.equal(isGameRoom("city"), false);
  assert.equal(isGameRoom("farm"), false);
  assert.equal(isGameRoom("assassin-1"), true);
  assert.equal(isGameRoom("hide-1"), true);
});

test("an unknown room is not a game room", () => {
  // ★ မသိတဲ့ room ကို game လို့ ယူဆရင် combat ဂိတ်က ဖွင့်သွားမယ် —
  //   fail-closed ဖြစ်ရမယ်။
  assert.equal(isGameRoom("does-not-exist"), false);
  assert.equal(isGameRoom(""), false);
  assert.equal(isGameRoom(null), false);
  assert.equal(isGameRoom(undefined), false);
});

test("roomDef returns null for an unknown room", () => {
  assert.equal(roomDef("nope"), null);
  assert.equal(roomGameMode("nope"), null);
  assert.equal(roomGameMode("city"), null);
  assert.equal(roomGameMode("hide-1"), "hide");
});

test("normalizeRoom falls back to city, never invents a room", () => {
  assert.equal(normalizeRoom("FARM"), "farm");
  assert.equal(normalizeRoom("made-up"), "city");
  assert.equal(normalizeRoom(undefined), "city");
  // ★ ဒါက memory leak ကာကွယ်တာ — client က room name ဘာမဆို ပေးလို့
  //   ရသွားရင် တစ်ယောက်တည်းရှိတဲ့ room တွေ အကန့်အသတ်မဲ့ ဆောက်လို့ရမယ်။
  for (const bad of ["../etc", "a".repeat(200), "city; drop"]) {
    assert.ok(ROOMS.has(normalizeRoom(bad)));
  }
});

test("gate sets are derived from the definitions, not hand-written", () => {
  const adult = ROOM_DEFS.filter((d) => d.gate === "adult").map((d) => d.id);
  const token = ROOM_DEFS.filter((d) => d.gate === "token").map((d) => d.id);
  assert.deepEqual([...ADULT_ROOMS].sort(), adult.sort());
  assert.deepEqual([...GATED_ROOMS].sort(), token.sort());
  // ဂိတ်စာရင်း ၂ ခုစလုံး ဗလာ မဖြစ်စေရ — ဖြစ်ရင် derive က ကျနေတယ်။
  assert.ok(ADULT_ROOMS.size > 0);
  assert.ok(GATED_ROOMS.size > 0);
});

test("every adult room is a game room", () => {
  // ★ ၁၈+ social room ဆိုတာ မရှိသင့်ဘူး — အသက်ကန့်သတ်ရတဲ့အကြောင်းက
  //   ပစ်ခတ်မှုကြောင့်ပါ။ ၁၈+ ဂိတ်ကို social room မှာ တွေ့ရင် တစ်ခုခု
  //   မှားနေပြီ။
  for (const id of ADULT_ROOMS) assert.equal(isGameRoom(id), true, id);
});

test("hide mode rooms carry no adult gate", () => {
  // ဝှက်တမ်းမှာ ထိခိုက်မှု မရှိဘူး — ကလေးတွေ ကစားလို့ရရမယ်။
  for (const d of ROOM_DEFS) {
    if (d.gameMode === "hide") assert.equal(d.gate, undefined, d.id);
  }
});

test("hide mode config is playable", () => {
  for (const d of ROOM_DEFS) {
    if (d.gameMode !== "hide") continue;
    const c = d.gameConfig ?? {};
    assert.ok(c.minPlayers >= 2, `${d.id}: needs at least 2 players`);
    assert.ok(c.minPlayers <= d.maxPlayers, `${d.id}: minPlayers exceeds maxPlayers`);
    assert.ok(c.seekerCount >= 1, `${d.id}: needs a seeker`);
    assert.ok(c.seekerCount < c.minPlayers, `${d.id}: everyone would be a seeker`);
    assert.ok(c.matchMinutes > 0, `${d.id}: matchMinutes`);
  }
});

// ── ★ Combat ဂိတ် — server.js နဲ့ ချိတ်ဆက်စစ်တာ ───────────────────────────

test("every assassin message type is listed as a combat type", () => {
  // ★ ဒါက ဒီ suite ရဲ့ အရေးအကြီးဆုံး test。 server.js က `COMBAT_TYPES`
  //   ထဲက message တွေကို social room မှာ ငြင်းတယ်။ combat message
  //   အသစ်တစ်ခု ထည့်ပြီး စာရင်းထဲ ထည့်ဖို့ မေ့သွားရင် — အဲဒါက
  //   စကားပြောခန်းထဲမှာ လူပစ်လို့ရသွားတာ၊ ပြီးတော့ ဘယ် test ကမှ
  //   မဖမ်းဘူး။ ဒါကြောင့် source ကို တိုက်ရိုက် ဖတ်ပြီး နှိုင်းယှဉ်တယ်။
  const serverSrc = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");

  const listed = new Set(
    (serverSrc.match(/const COMBAT_TYPES = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? "")
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean),
  );
  assert.ok(listed.size > 0, "COMBAT_TYPES could not be parsed out of server.js");

  // `case "aXxx":` ပုံစံနဲ့ handler အားလုံးကို ဆွဲထုတ်တယ် — assassin
  // message တွေက "a" နဲ့စတယ် (aJoin/aMove/aFire/…)。
  const handled = new Set(
    [...serverSrc.matchAll(/case "(a[A-Z]\w*)":/g)].map((m) => m[1]),
  );
  assert.ok(handled.size > 0, "no assassin message handlers found");

  for (const type of handled) {
    assert.ok(listed.has(type), `${type} is handled but missing from COMBAT_TYPES`);
  }
});

// ── Room bookkeeping ──────────────────────────────────────────────────────

function fakePlayer(id) {
  return { id, x: 0, y: 0, z: 0, ry: 0, name: id, authed: true, ws: { readyState: 1, send() {} } };
}

test("byRoom counts locals plus ghosts and hides empty rooms", () => {
  const r = new Rooms();
  assert.deepEqual(r.byRoom(), {});

  r.add("city", fakePlayer("a"));
  r.add("city", fakePlayer("b"));
  r.add("hide-1", fakePlayer("c"));
  // တခြား task ပေါ်က player — /health က တစ်လောကလုံးကို ပြရမယ်
  r.setGhost("city", "ghost-1", { x: 1, z: 1 }, "task-2");

  assert.deepEqual(r.byRoom(), { city: 3, "hide-1": 1 });
});

test("byRoom only reports known rooms", () => {
  const r = new Rooms();
  r.add("not-a-room", fakePlayer("a"));
  assert.deepEqual(r.byRoom(), {});
});
