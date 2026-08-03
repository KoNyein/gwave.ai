"use strict";

/// ဝှက်တမ်း mode ရဲ့ စည်းမျဉ်းများ။
///
/// ★ ဒီ mode ရဲ့ တန်ဖိုးက combat မပါဘဲ lifecycle တစ်ခုလုံးကို စမ်းသပ်တာ —
///   ဒါကြောင့် ဒီ test တွေက အဓိကအားဖြင့် **server က ဆုံးဖြတ်တယ်၊ client
///   မဟုတ်ဘူး** ဆိုတာကို သေချာစေတာ ဖြစ်တယ်။

const test = require("node:test");
const assert = require("node:assert/strict");

const { hide, BLIND_MS, TAG_RANGE, TAG_COOLDOWN_MS, SURVIVE_POINT_MS } = require("../modes/hide");
const m = require("../match");

const T0 = 2_000_000;

function setup(playerCount = 4) {
  const match = m.createMatch({
    id: "match-hide-1",
    roomId: "hide-1",
    mode: "hide",
    config: { minPlayers: 3, maxPlayers: 12, matchMinutes: 5 },
  });
  for (let i = 0; i < playerCount; i++) {
    m.joinMatch(match, { id: `p${i}`, name: `P${i}` }, T0);
    const p = match.players.get(`p${i}`);
    // ကစားသမားတွေကို ဝေးဝေးထား — မတော်တဆ ဖမ်းမိမှု မဖြစ်အောင်
    p.x = i * 50;
    p.z = 0;
  }
  m.tickMatch(match, T0);
  m.tickMatch(match, T0 + m.COUNTDOWN_MS);
  hide.onStart(match, T0 + m.COUNTDOWN_MS);
  return { match, start: T0 + m.COUNTDOWN_MS };
}

function seeker(match) {
  return match.players.get(match.modeState.seekerId);
}
function aHider(match) {
  return [...match.players.values()].find((p) => p.id !== match.modeState.seekerId);
}

test("the mode declares itself combat-free", () => {
  // ★ ဒါက ဒီ mode ရဲ့ အခြေခံ — server က ဒါကို ကြည့်ပြီး combat စနစ်ကို
  //   လုံးဝ မဖွင့်ဘူး။
  assert.equal(hide.usesCombat, false);
});

test("one seeker is chosen at the start", () => {
  const { match } = setup();
  assert.ok(match.modeState.seekerId);
  assert.ok(match.players.has(match.modeState.seekerId));
});

test("the seeker choice is reproducible for a given match id", () => {
  // ★ `Math.random()` ဆိုရင် bug report တစ်ခုကို ပြန်စမ်းလို့ မရဘူး။
  const a = setup().match.modeState.seekerId;
  const b = setup().match.modeState.seekerId;
  assert.equal(a, b);
});

test("the seeker is blind for fifteen seconds", () => {
  const { match, start } = setup();
  assert.equal(match.modeState.blindUntil, start + BLIND_MS);
});

// ── ★ ဖမ်းခြင်း — server က ဆုံးဖြတ်တယ် ─────────────────────────────────

function tagAttempt(match, now, { at = null } = {}) {
  const s = seeker(match);
  const h = aHider(match);
  if (at !== null) {
    s.x = 0;
    s.z = 0;
    h.x = at;
    h.z = 0;
  }
  return { events: hide.onPlayerAction(match, s, { type: "tag", targetId: h.id }, now), s, h };
}

test("a tag inside range transfers the seeker role", () => {
  const { match, start } = setup();
  const now = start + BLIND_MS + 1000;
  const { events, s, h } = tagAttempt(match, now, { at: 1.5 });

  assert.equal(match.modeState.seekerId, h.id, "the caught player becomes the seeker");
  assert.ok(events.some((e) => e.type === "tagged" && e.id === h.id && e.by === s.id));
  assert.ok(events.some((e) => e.type === "role" && e.id === h.id));
});

test("a tag out of range does nothing", () => {
  // ★ Client က ဘယ်လောက် ကပ်နေတယ် ပြောပြောရ — server က နေရာနဲ့ တွက်တယ်။
  const { match, start } = setup();
  const before = match.modeState.seekerId;
  const { events } = tagAttempt(match, start + BLIND_MS + 1000, { at: TAG_RANGE + 0.5 });
  assert.deepEqual(events, []);
  assert.equal(match.modeState.seekerId, before);
});

test("the range boundary is inclusive", () => {
  const { match, start } = setup();
  const { events } = tagAttempt(match, start + BLIND_MS + 1000, { at: TAG_RANGE });
  assert.ok(events.length > 0);
});

test("nobody can tag during the blind period", () => {
  const { match, start } = setup();
  const before = match.modeState.seekerId;
  const { events } = tagAttempt(match, start + 1000, { at: 0.5 });
  assert.deepEqual(events, []);
  assert.equal(match.modeState.seekerId, before);
});

test("only the seeker can tag", () => {
  // ★ ဒါမရှိရင် ဘယ်သူမဆို ဘယ်သူ့ကိုမဆို "ဖမ်းမိပြီ" လုပ်လို့ရမယ်။
  const { match, start } = setup();
  const hider = aHider(match);
  const other = [...match.players.values()].find(
    (p) => p.id !== hider.id && p.id !== match.modeState.seekerId,
  );
  hider.x = 0;
  hider.z = 0;
  other.x = 0.5;
  other.z = 0;
  const events = hide.onPlayerAction(
    match,
    hider,
    { type: "tag", targetId: other.id },
    start + BLIND_MS + 1000,
  );
  assert.deepEqual(events, []);
});

test("you cannot tag yourself", () => {
  const { match, start } = setup();
  const s = seeker(match);
  const events = hide.onPlayerAction(
    match,
    s,
    { type: "tag", targetId: s.id },
    start + BLIND_MS + 1000,
  );
  assert.deepEqual(events, []);
});

test("tagging a disconnected player does nothing", () => {
  const { match, start } = setup();
  const s = seeker(match);
  const h = aHider(match);
  h.disconnectedUntil = start + 60_000;
  s.x = 0;
  s.z = 0;
  h.x = 1;
  h.z = 0;
  assert.deepEqual(
    hide.onPlayerAction(match, s, { type: "tag", targetId: h.id }, start + BLIND_MS + 1000),
    [],
  );
});

test("tagging an unknown id does nothing", () => {
  const { match, start } = setup();
  const s = seeker(match);
  for (const bad of ["ghost", "", null, undefined, 42]) {
    assert.deepEqual(
      hide.onPlayerAction(match, s, { type: "tag", targetId: bad }, start + BLIND_MS + 1000),
      [],
      String(bad),
    );
  }
});

test("a non-tag action is ignored", () => {
  const { match, start } = setup();
  assert.deepEqual(
    hide.onPlayerAction(match, seeker(match), { type: "fire" }, start + BLIND_MS + 1000),
    [],
  );
});

test("tag-back is blocked by the cooldown", () => {
  // ★ ဒါမရှိရင် ရှာဖွေသူ ၂ ယောက် အပြန်အလှန် ဖမ်းနေပြီး ပွဲ ရပ်သွားမယ်။
  const { match, start } = setup();
  const now = start + BLIND_MS + 1000;
  const { s, h } = tagAttempt(match, now, { at: 1 });
  assert.equal(match.modeState.seekerId, h.id);

  // အသစ်ဖြစ်လာတဲ့ ရှာဖွေသူက ချက်ချင်း ပြန်ဖမ်းကြည့်တယ်
  const back = hide.onPlayerAction(match, h, { type: "tag", targetId: s.id }, now + 100);
  assert.deepEqual(back, []);
  assert.equal(match.modeState.seekerId, h.id);

  // cooldown ကုန်ရင် ရတယ်
  const later = hide.onPlayerAction(
    match,
    h,
    { type: "tag", targetId: s.id },
    now + TAG_COOLDOWN_MS + 1,
  );
  assert.ok(later.length > 0);
});

test("catching someone is worth points", () => {
  const { match, start } = setup();
  const before = seeker(match).score;
  const { s } = tagAttempt(match, start + BLIND_MS + 1000, { at: 1 });
  assert.ok(s.score > before);
});

// ── အမှတ် — အသက်ရှင်နေတာ ────────────────────────────────────────────────

test("hiders score for staying alive", () => {
  const { match, start } = setup();
  hide.onTick(match, start + SURVIVE_POINT_MS);
  for (const p of match.players.values()) {
    if (p.id === match.modeState.seekerId) continue;
    assert.equal(p.score, 1, p.id);
  }
});

test("the seeker does not score for surviving", () => {
  // ★ ရှာဖွေသူက ရှာရမှာ — ပုန်းနေရင် အမှတ်ရနေရင် ဂိမ်း ပျက်တယ်။
  const { match, start } = setup();
  hide.onTick(match, start + SURVIVE_POINT_MS * 3);
  assert.equal(seeker(match).score, 0);
});

test("survival points accrue steadily, not in bursts", () => {
  const { match, start } = setup();
  const h = aHider(match);
  hide.onTick(match, start + SURVIVE_POINT_MS);
  assert.equal(h.score, 1);
  hide.onTick(match, start + SURVIVE_POINT_MS * 2);
  assert.equal(h.score, 2);
  // tick ကျော်သွားလည်း တွက်ချက်မှု မှန်ရမယ် (server နှေးတဲ့အခါ)
  hide.onTick(match, start + SURVIVE_POINT_MS * 5);
  assert.equal(h.score, 5);
});

test("a disconnected hider stops earning", () => {
  const { match, start } = setup();
  const h = aHider(match);
  h.disconnectedUntil = start + 60_000;
  hide.onTick(match, start + SURVIVE_POINT_MS * 3);
  assert.equal(h.score, 0);
});

test("a freshly caught player does not immediately bank survival time", () => {
  // ★ ဖမ်းမိတဲ့အခါ သူ့ရဲ့ နာရီကို ပြန်စတယ် — မဟုတ်ရင် ရှာဖွေသူ ဖြစ်သွားတဲ့
  //   ခဏမှာ ပုန်းခဲ့တဲ့ အချိန်အားလုံးအတွက် အမှတ် တစ်ပြိုင်နက် ရမယ်။
  const { match, start } = setup();
  const now = start + BLIND_MS + SURVIVE_POINT_MS * 3;
  const { h } = tagAttempt(match, now, { at: 1 });
  const scoreAtTag = h.score;
  hide.onTick(match, now + 1000);
  assert.equal(h.score, scoreAtTag, "no points for the seconds before being caught");
});

// ── ပွဲပြီးဆုံးခြင်း ──────────────────────────────────────────────────────

test("the match is not over while hiders remain", () => {
  const { match, start } = setup();
  assert.equal(hide.checkEnd(match, start + 1000), null);
});

test("time running out means the best hider wins", () => {
  // ★ ရှာဖွေသူကို အနိုင်ပေးလို့ မရဘူး — အဆုံးထိ ရှာဖွေသူ ဖြစ်နေတာ ရှုံးတာပါ။
  const { match } = setup();
  const hiders = [...match.players.values()].filter((p) => p.id !== match.modeState.seekerId);
  hiders[0].score = 3;
  hiders[1].score = 9;
  seeker(match).score = 100;

  const result = hide.checkEnd(match, match.endsAt);
  assert.equal(result.reason, "time");
  assert.equal(result.winnerId, hiders[1].id);
});

test("everyone caught means the seeker wins", () => {
  const { match, start } = setup(3);
  // ရှာဖွေသူကလွဲပြီး ကျန်တာအားလုံး ထွက်သွား = ဖမ်းမိပြီးသား သဘော
  for (const p of [...match.players.values()]) {
    if (p.id !== match.modeState.seekerId) p.disconnectedUntil = start;
  }
  const result = hide.checkEnd(match, start + 1000);
  assert.equal(result.reason, "last-player");
  assert.equal(result.winnerId, match.modeState.seekerId);
});

// ── ★ ရှာဖွေသူ ထွက်သွားခြင်း ────────────────────────────────────────────

test("the seeker leaving hands the role to someone else", () => {
  // ★ ဒါမရှိရင် ပွဲက ရှာဖွေသူ မရှိဘဲ ဆက်သွားပြီး ဘယ်တော့မှ မပြီးဘူး။
  const { match, start } = setup(4);
  const gone = match.modeState.seekerId;
  match.players.delete(gone);

  const events = hide.onPlayerLeft(match, gone, start + 5000);
  assert.notEqual(match.modeState.seekerId, gone);
  assert.ok(match.players.has(match.modeState.seekerId));
  assert.ok(events.some((e) => e.type === "role" && e.reason === "seeker-left"));
});

test("a hider leaving does not disturb the seeker", () => {
  const { match, start } = setup(4);
  const before = match.modeState.seekerId;
  const hider = aHider(match);
  match.players.delete(hider.id);
  assert.deepEqual(hide.onPlayerLeft(match, hider.id, start + 5000), []);
  assert.equal(match.modeState.seekerId, before);
});

test("the last player leaving clears the seeker rather than crashing", () => {
  const { match, start } = setup(3);
  const gone = match.modeState.seekerId;
  match.players.clear();
  assert.deepEqual(hide.onPlayerLeft(match, gone, start), []);
  assert.equal(match.modeState.seekerId, null);
  assert.equal(hide.checkEnd(match, start), null);
});

test("mode callbacks tolerate being called before the match starts", () => {
  // ★ Lifecycle က state အားလုံးမှာ tick ခေါ်တယ် — waiting မှာ modeState
  //   မရှိသေးဘူး။ ကျရင် ပွဲ ဘယ်တော့မှ မစတော့ဘူး။
  const match = m.createMatch({ id: "x", config: { minPlayers: 3 } });
  assert.deepEqual(hide.onTick(match, T0), []);
  assert.equal(hide.checkEnd(match, T0), null);
  assert.deepEqual(hide.onPlayerLeft(match, "nobody", T0), []);
});
