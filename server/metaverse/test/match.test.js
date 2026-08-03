"use strict";

/// Match lifecycle (Arena spec A3) — acceptance criteria တစ်ခုချင်းစီအတွက်
/// test တစ်ခုစီ။
///
/// ★ အချိန်ကို parameter နဲ့ ထည့်ပေးလို့ရတာက ဒီ suite ကို ဖြစ်နိုင်စေတာ —
///   ပွဲ ၅ မိနစ်ကို စက္ကန့်အပိုင်းအစနဲ့ ဖြတ်သန်းပြလို့ရတယ်။

const test = require("node:test");
const assert = require("node:assert/strict");

const m = require("../match");

const T0 = 1_000_000;

function newMatch(config = {}) {
  return m.createMatch({
    id: "match-1",
    roomId: "hide-1",
    mode: "hide",
    config: { minPlayers: 3, maxPlayers: 12, matchMinutes: 5, ...config },
  });
}

function fill(match, n, now = T0) {
  for (let i = 0; i < n; i++) m.joinMatch(match, { id: `p${i}`, name: `P${i}` }, now);
  return match;
}

// ── စောင့်ခန်း → countdown ────────────────────────────────────────────────

test("a fresh match waits", () => {
  const match = newMatch();
  assert.equal(match.state, "waiting");
  m.tickMatch(match, T0);
  assert.equal(match.state, "waiting");
});

test("countdown starts when minPlayers is reached", () => {
  const match = fill(newMatch(), 3);
  const events = m.tickMatch(match, T0);
  assert.equal(match.state, "countdown");
  assert.equal(match.countdownEndsAt, T0 + m.COUNTDOWN_MS);
  assert.ok(events.some((e) => e.type === "countdown"));
});

test("two players are not enough", () => {
  const match = fill(newMatch(), 2);
  m.tickMatch(match, T0);
  assert.equal(match.state, "waiting");
});

test("dropping below minPlayers mid-countdown returns to waiting", () => {
  const match = fill(newMatch(), 3);
  m.tickMatch(match, T0);
  assert.equal(match.state, "countdown");

  m.leaveMatch(match, "p2", T0 + 1000);
  const events = m.tickMatch(match, T0 + 1000);

  assert.equal(match.state, "waiting");
  assert.equal(match.countdownEndsAt, null);
  assert.ok(events.some((e) => e.type === "waiting" && e.reason === "not-enough-players"));
});

test("the match starts when the countdown expires", () => {
  const match = fill(newMatch(), 3);
  m.tickMatch(match, T0);
  m.tickMatch(match, T0 + m.COUNTDOWN_MS - 1);
  assert.equal(match.state, "countdown", "one millisecond early is still countdown");

  const events = m.tickMatch(match, T0 + m.COUNTDOWN_MS);
  assert.equal(match.state, "live");
  assert.equal(match.startedAt, T0 + m.COUNTDOWN_MS);
  assert.equal(match.endsAt, T0 + m.COUNTDOWN_MS + match.matchMs);
  assert.ok(events.some((e) => e.type === "start"));
});

// ── ကြည့်ရှုသူ ────────────────────────────────────────────────────────────

function liveMatch(config) {
  const match = fill(newMatch(config), 3);
  m.tickMatch(match, T0);
  m.tickMatch(match, T0 + m.COUNTDOWN_MS);
  assert.equal(match.state, "live");
  return match;
}

test("joining a live match makes you a spectator", () => {
  const match = liveMatch();
  const r = m.joinMatch(match, { id: "late", name: "Late" }, T0 + 60_000);
  assert.equal(r.role, "spectator");
  assert.equal(match.players.has("late"), false);
  assert.ok(match.spectators.has("late"));
});

test("joining while results are showing also spectates", () => {
  const match = liveMatch();
  m.endMatch(match, T0 + 60_000, { reason: "time" });
  const r = m.joinMatch(match, { id: "late", name: "Late" }, T0 + 61_000);
  assert.equal(r.role, "spectator");
});

test("spectators become players for the next round", () => {
  const match = liveMatch();
  m.joinMatch(match, { id: "late", name: "Late" }, T0 + 60_000);
  m.endMatch(match, T0 + 60_000, { reason: "time" });
  m.tickMatch(match, T0 + 60_000 + m.ENDED_MS);

  assert.equal(match.state, "waiting");
  assert.equal(match.spectators.size, 0);
  assert.ok(match.players.has("late"));
});

test("a full match sends extra joiners to the stands", () => {
  const match = newMatch({ maxPlayers: 3 });
  fill(match, 3);
  const r = m.joinMatch(match, { id: "extra" }, T0);
  assert.equal(r.role, "spectator");
  assert.equal(r.reason, "full");
  assert.equal(match.players.size, 3);
});

// ── ★ ပြတ်တောက်မှု နဲ့ ပြန်ဝင်ခြင်း ───────────────────────────────────────

test("a disconnect holds the seat and the score for 60 seconds", () => {
  const match = liveMatch();
  match.players.get("p0").score = 7;

  m.leaveMatch(match, "p0", T0 + 60_000, { voluntary: false });
  assert.ok(match.players.has("p0"), "seat is held");
  assert.equal(m.activeCount(match), 2, "a disconnected player does not count as present");

  // grace ကုန်မခင် ပြန်လာတယ်
  const r = m.joinMatch(match, { id: "p0", name: "P0" }, T0 + 90_000);
  assert.equal(r.rejoined, true);
  assert.equal(match.players.get("p0").score, 7, "score survived the reconnect");
  assert.equal(m.activeCount(match), 3);
});

test("a seat is released once the grace period expires", () => {
  const match = liveMatch();
  m.leaveMatch(match, "p0", T0 + 60_000, { voluntary: false });

  const events = m.tickMatch(match, T0 + 60_000 + m.DISCONNECT_GRACE_MS);
  assert.equal(match.players.has("p0"), false);
  assert.ok(events.some((e) => e.type === "dropped" && e.ids.includes("p0")));
});

test("rejoining after the grace period starts from zero", () => {
  const match = liveMatch();
  match.players.get("p0").score = 7;
  m.leaveMatch(match, "p0", T0 + 60_000, { voluntary: false });
  m.tickMatch(match, T0 + 60_000 + m.DISCONNECT_GRACE_MS);

  const r = m.joinMatch(match, { id: "p0", name: "P0" }, T0 + 200_000);
  assert.notEqual(r.rejoined, true);
  assert.equal(r.role, "spectator", "the match is still live, so they watch");
});

// ── ★ Rage quit ──────────────────────────────────────────────────────────

test("leaving a live match voluntarily blocks rejoining for five minutes", () => {
  const match = liveMatch();
  m.leaveMatch(match, "p0", T0 + 60_000, { voluntary: true });
  assert.equal(match.players.has("p0"), false);

  const blocked = m.joinMatch(match, { id: "p0" }, T0 + 61_000);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "penalty");

  const later = m.joinMatch(match, { id: "p0" }, T0 + 60_000 + m.REJOIN_PENALTY_MS + 1);
  assert.equal(later.ok, true);
});

test("leaving the lobby carries no penalty", () => {
  // ★ စောင့်ခန်းကနေ ထွက်တာက သာမန်ပါ — ဒဏ်ခတ်ရင် ကစားသမား ဆုံးရှုံးမယ်။
  const match = fill(newMatch(), 3);
  assert.equal(match.state, "waiting");
  m.leaveMatch(match, "p0", T0, { voluntary: true });
  assert.equal(match.penalties.has("p0"), false);
  assert.equal(m.joinMatch(match, { id: "p0" }, T0 + 1).ok, true);
});

test("a disconnect is not treated as a rage quit", () => {
  const match = liveMatch();
  m.leaveMatch(match, "p0", T0 + 60_000, { voluntary: false });
  assert.equal(match.penalties.has("p0"), false);
});

// ── ပွဲပြီးဆုံးခြင်း ──────────────────────────────────────────────────────

test("the match ends when time runs out and shows results for 15s", () => {
  const match = liveMatch();
  match.players.get("p1").score = 4;

  const events = m.tickMatch(match, match.endsAt);
  assert.equal(match.state, "ended");
  assert.equal(match.result.reason, "time");
  assert.equal(match.result.winnerId, "p1");
  assert.ok(events.some((e) => e.type === "end"));

  m.tickMatch(match, match.resultEndsAt - 1);
  assert.equal(match.state, "ended");
  m.tickMatch(match, match.resultEndsAt);
  assert.equal(match.state, "waiting");
});

test("a scoreless match has no winner", () => {
  // ★ ဘာမှမလုပ်ဘဲ ငြိမ်နေသူကို အနိုင်ပေးရင် ရပ်နေတာက အကောင်းဆုံး
  //   ဗျူဟာ ဖြစ်သွားမယ်။
  const match = liveMatch();
  m.tickMatch(match, match.endsAt);
  assert.equal(match.result.winnerId, null);
});

test("results are sorted by score, ties broken stably", () => {
  const match = liveMatch();
  match.players.get("p0").score = 2;
  match.players.get("p1").score = 5;
  match.players.get("p2").score = 2;
  m.tickMatch(match, match.endsAt);
  assert.deepEqual(
    match.result.scores.map((s) => s.id),
    ["p1", "p0", "p2"],
  );
});

test("everyone leaving mid-match ends it rather than leaving it live forever", () => {
  const match = liveMatch();
  for (const id of ["p0", "p1", "p2"]) m.leaveMatch(match, id, T0 + 60_000, { voluntary: true });
  const events = m.tickMatch(match, T0 + 60_000);

  assert.equal(match.state, "ended");
  assert.equal(match.result.reason, "abandoned");
  assert.ok(events.some((e) => e.type === "end"));
});

test("an emptied match reports itself collectable, and the room outlives it", () => {
  const match = fill(newMatch(), 3);
  assert.equal(m.isEmpty(match), false);
  for (const id of ["p0", "p1", "p2"]) m.leaveMatch(match, id, T0);
  assert.equal(m.isEmpty(match), true);
});

test("scores reset between rounds", () => {
  const match = liveMatch();
  match.players.get("p0").score = 9;
  m.tickMatch(match, match.endsAt);
  m.tickMatch(match, match.resultEndsAt);
  assert.equal(match.state, "waiting");
  assert.equal(match.players.get("p0").score, 0);
});

test("mode state is cleared between rounds", () => {
  // ★ ဒါမရှင်းရင် ဝှက်တမ်းရဲ့ ရှာဖွေသူက နောက်ပွဲမှာလည်း ရှာဖွေသူ ဖြစ်နေမယ်။
  const match = liveMatch();
  match.modeState.seekerId = "p0";
  m.tickMatch(match, match.endsAt);
  m.tickMatch(match, match.resultEndsAt);
  assert.deepEqual(match.modeState, {});
});

// ── အနားသတ် ─────────────────────────────────────────────────────────────

test("minPlayers can never be below two", () => {
  // ★ ၁ ဆိုရင် တစ်ယောက်တည်း ပွဲစပြီး ချက်ချင်း အနိုင်ရသွားမယ်။
  assert.equal(m.createMatch({ config: { minPlayers: 1 } }).minPlayers, 2);
});

test("a nonsense minPlayers falls back to the default, not to the floor", () => {
  // ★ ကွာခြားချက် အရေးကြီးတယ် — `0`/`-5`/`"abc"` က "အနည်းဆုံးနဲ့ လုပ်ပါ"
  //   လို့ တောင်းတာ မဟုတ်ဘဲ ရေးထားတာ မှားနေတာ။ အဲဒါကို ၂ လို့ ယူလိုက်ရင်
  //   config bug က ပွဲကို ၂ ယောက်နဲ့ စစေပြီး တိတ်တိတ်ကလေး ဖုံးသွားမယ်။
  for (const bad of [0, -5, NaN, "abc", null, undefined]) {
    assert.equal(m.createMatch({ config: { minPlayers: bad } }).minPlayers, 3, String(bad));
  }
});

test("a join without an id is rejected", () => {
  const match = newMatch();
  assert.equal(m.joinMatch(match, { id: "" }, T0).ok, false);
});

test("joining twice does not create a second seat", () => {
  const match = newMatch();
  m.joinMatch(match, { id: "p0", name: "A" }, T0);
  m.joinMatch(match, { id: "p0", name: "B" }, T0 + 5);
  assert.equal(match.players.size, 1);
  assert.equal(match.players.get("p0").name, "B");
});

test("names are bounded", () => {
  const match = newMatch();
  m.joinMatch(match, { id: "p0", name: "x".repeat(500) }, T0);
  assert.equal(match.players.get("p0").name.length, 24);
});
