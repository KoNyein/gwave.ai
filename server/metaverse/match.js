"use strict";

/// Match lifecycle — ပွဲစဉ်တစ်ခုရဲ့ သက်တမ်း (Arena spec A3)。
///
/// ★ ဒီ file မှာ socket, timer, DB ဘာမှ မရှိဘူး — **သက်သက် logic** ပါ။
///   ဘာလို့လဲ: "ကစားသမား ၃ ယောက်ပြည့်ရင် countdown စတယ်၊ အလယ်မှာ
///   ၂ ယောက်ကျသွားရင် ပြန်စောင့်တယ်" ဆိုတဲ့ စည်းမျဉ်းတွေက test ရေးရ
///   အလွယ်ဆုံး အပိုင်းဖြစ်ပြီး၊ တစ်ချိန်တည်းမှာ လက်တွေ့မှာ အခက်ဆုံး
///   ပြန်ဖြစ်အောင်လုပ်ရတဲ့ အပိုင်းလည်း ဖြစ်တယ် (လူ ၃ ယောက် စုရမယ်)。
///   Timer နဲ့ ရောထားရင် ဘယ်တော့မှ စမ်းလို့မရဘူး။
///
/// ★ အချိန်ကို `now` parameter နဲ့ ထည့်ပေးရတယ် — `Date.now()` ကို အထဲမှာ
///   မခေါ်ဘူး။ ဒါမှ test က နာရီပေါင်းများစွာကို millisecond နဲ့
///   ဖြတ်သန်းပြနိုင်တယ်။
///
/// State machine (spec A3.1) —
///
///   waiting ──(ကစားသမား ≥ minPlayers)──► countdown ──(၂၀s)──► live
///      ▲                                     │                  │
///      │                                     │ (< minPlayers)   │ (အနိုင်ရ /
///      │                                     ▼                  │  အချိန်ကုန်)
///      └────────────(၁၅s)──────────────── ended ◄───────────────┘

const COUNTDOWN_MS = 20_000;
/// ရလဒ်ပြချိန် — ဒီပြီးရင် waiting ပြန်
const ENDED_MS = 15_000;
/// ★ ပြတ်သွားလည်း နေရာ ချန်ထားတဲ့ အချိန် (spec A3.2)。 Mae Sot ဘက်
///   network မတည်ငြိမ်လို့ ပြတ်တာနဲ့ ပွဲထဲက ထုတ်ပစ်ရင် ကစားလို့ မရတော့ဘူး။
const DISCONNECT_GRACE_MS = 60_000;
/// ★ ကိုယ်တိုင်ထွက်သွားရင် ၅ မိနစ် ပြန်ဝင်ခွင့်ပိတ် — rage quit ကာကွယ်ဖို့။
///   ရှုံးနေတိုင်း ထွက်ပြီး ပွဲအသစ် ဝင်နေရင် ကျန်တဲ့သူတွေ ပွဲပျက်တယ်။
const REJOIN_PENALTY_MS = 5 * 60_000;

const STATES = Object.freeze(["waiting", "countdown", "live", "ended"]);

/// ★ Config တန်ဖိုးတစ်ခုကို ဖတ်တယ် — အပြုသဘောကိန်း မဟုတ်ရင် default。
///   `Number(v) || fallback` နဲ့ မရဘူး: `-5` က truthy မို့ ဖြတ်ကျော်သွားပြီး
///   clamp က ၂ လုပ်လိုက်တယ် — config bug က "အနည်းဆုံးနဲ့ လုပ်ပါ" ဆိုတဲ့
///   တောင်းဆိုချက် ယောင်ဆောင်ပြီး တိတ်တိတ်ကလေး ဖုံးသွားတယ်။
function posOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function createMatch(opts = {}) {
  const config = opts.config ?? {};
  return {
    id: opts.id ?? null,
    roomId: opts.roomId ?? null,
    mode: opts.mode ?? null,
    state: "waiting",
    /// ★ `minPlayers` ကို ၂ အောက် မခွင့်ပြုဘူး — ၁ ဆိုရင် တစ်ယောက်တည်း
    ///   ပွဲစပြီး ချက်ချင်း အနိုင်ရသွားမယ်။
    minPlayers: Math.max(2, posOr(config.minPlayers, 3)),
    maxPlayers: Math.max(2, posOr(config.maxPlayers, 12)),
    matchMs: Math.max(30_000, posOr(config.matchMinutes, 5) * 60_000),
    countdownEndsAt: null,
    startedAt: null,
    endsAt: null,
    /// ရလဒ်ပြချိန် ကုန်မယ့်အချိန် (state === 'ended' မှာသာ)
    resultEndsAt: null,
    result: null,
    /// id -> MatchPlayer
    players: new Map(),
    /// id -> Set (ကြည့်ရှုသူ — ပွဲထဲမပါ)
    spectators: new Set(),
    /// ★ ကိုယ်တိုင်ထွက်သွားသူ id -> ပြန်ဝင်ခွင့်ရမယ့်အချိန်
    penalties: new Map(),
    /// mode တွေ ကိုယ်ပိုင် state သိမ်းဖို့ နေရာ (hide mode က seeker id
    /// စတာတွေ ဒီထဲ ထားတယ်)。 Lifecycle က ဒါကို လုံးဝ မဖတ်ဘူး။
    modeState: {},
  };
}

function makeMatchPlayer(id, name, now) {
  return {
    id,
    name: String(name ?? "Gwave").slice(0, 24),
    joinedAt: now,
    /// ★ ပွဲအလယ် ဝင်လာသူက spectator ဖြစ်ပြီး၊ နောက်ပွဲကျမှ ကစားသမား
    ///   ဖြစ်တယ်။ ဒီ flag က "ဒီပွဲမှာ တကယ်ကစားခဲ့လား" ကို မှတ်တယ်။
    playing: false,
    score: 0,
    /// ပြတ်သွားရင် ဒီအချိန်ကုန်တဲ့အထိ နေရာချန်ထားတယ် (null = ချိတ်ဆက်နေဆဲ)
    disconnectedUntil: null,
  };
}

// ── ဝင်/ထွက် ─────────────────────────────────────────────────────────────

/// ပွဲထဲ ဝင်တယ်။ ပြန်လာတာက `{ ok, role, reason? }`。
///
/// - `role: 'player'`    — ပွဲမစသေးလို့ တကယ် ကစားရမယ်
/// - `role: 'spectator'` — ပွဲ လက်ရှိ ဖြစ်နေတယ်၊ နောက်ပွဲစောင့်
function joinMatch(match, { id, name }, now) {
  if (!id) return { ok: false, reason: "no-id" };

  // ★ ပြတ်သွားပြီး ပြန်လာတာလား — အမှတ်တွေ ဒီအတိုင်း ကျန်နေရမယ်
  const existing = match.players.get(id);
  if (existing) {
    existing.disconnectedUntil = null;
    existing.name = String(name ?? existing.name).slice(0, 24);
    return { ok: true, role: existing.playing ? "player" : "spectator", rejoined: true };
  }

  // ★ Rage-quit ဒဏ် — ကိုယ်တိုင်ထွက်သွားပြီး ချက်ချင်း ပြန်ဝင်လို့ မရဘူး
  const penaltyUntil = match.penalties.get(id);
  if (penaltyUntil && penaltyUntil > now) {
    return { ok: false, reason: "penalty", until: penaltyUntil };
  }
  if (penaltyUntil) match.penalties.delete(id);

  // ပွဲဖြစ်နေရင် ကြည့်ရှုသူပဲ (spec A3.2)
  if (match.state === "live" || match.state === "ended") {
    match.spectators.add(id);
    return { ok: true, role: "spectator" };
  }

  if (match.players.size >= match.maxPlayers) {
    match.spectators.add(id);
    return { ok: true, role: "spectator", reason: "full" };
  }

  const p = makeMatchPlayer(id, name, now);
  p.playing = true;
  match.players.set(id, p);
  match.spectators.delete(id);
  return { ok: true, role: "player" };
}

/// ကစားသမား ထွက်သွားတယ်။
/// `voluntary` = ကိုယ်တိုင် ခလုတ်နှိပ်ထွက်တာ (ဒဏ်ရှိ)。
/// `voluntary: false` = connection ပြတ်တာ — ၆၀ စက္ကန့် နေရာချန်ထားတယ်။
function leaveMatch(match, id, now, { voluntary = true } = {}) {
  match.spectators.delete(id);
  const p = match.players.get(id);
  if (!p) return { removed: false };

  if (!voluntary) {
    // ★ ပြတ်တာ — ချက်ချင်း မထုတ်ဘူး။ `sweepDisconnected` က အချိန်စေ့မှ ထုတ်တယ်။
    p.disconnectedUntil = now + DISCONNECT_GRACE_MS;
    return { removed: false, heldUntil: p.disconnectedUntil };
  }

  match.players.delete(id);
  // ★ ဒဏ်က **ပွဲဖြစ်နေချိန်မှာ ထွက်မှသာ** — စောင့်ခန်းကနေ ထွက်တာက
  //   သာမန်ပါ၊ ဒါကို ဒဏ်ခတ်ရင် ကစားသမား ဆုံးရှုံးမယ်။
  if (match.state === "live" || match.state === "countdown") {
    match.penalties.set(id, now + REJOIN_PENALTY_MS);
  }
  return { removed: true };
}

/// Grace ကုန်သွားတဲ့ ပြတ်နေသူတွေကို ထုတ်တယ်။ ထုတ်လိုက်တဲ့ id စာရင်း ပြန်ပေးတယ်။
function sweepDisconnected(match, now) {
  const dropped = [];
  for (const [id, p] of match.players) {
    if (p.disconnectedUntil !== null && p.disconnectedUntil <= now) {
      match.players.delete(id);
      dropped.push(id);
    }
  }
  return dropped;
}

/// လက်ရှိ တကယ် ချိတ်ဆက်နေပြီး ကစားနေသူ အရေအတွက်。
/// ★ ပြတ်နေသူကို **မရေတွက်ဘူး** — ရေတွက်ရင် ပြတ်သွားသူ ၂ ယောက်နဲ့
///   ပွဲက ဆက်စနေမယ်၊ ဘယ်သူမှ မကစားဘဲ။
function activeCount(match) {
  let n = 0;
  for (const p of match.players.values()) if (p.disconnectedUntil === null) n++;
  return n;
}

// ── State machine ────────────────────────────────────────────────────────

/// အချိန်ရွေ့တဲ့အခါ ခေါ်တယ်။ ဖြစ်သွားတဲ့ အပြောင်းအလဲတွေကို ပြန်ပေးတယ် —
/// caller က အဲဒါတွေကို broadcast လုပ်ရုံပဲ။
///
/// ★ Event array ပြန်ပေးတာက အရေးကြီးတယ် — အထဲကနေ တိုက်ရိုက် broadcast
///   လုပ်ရင် ဒီ file က socket ကို မှီခိုသွားပြီး test မရေးနိုင်တော့ဘူး။
function tickMatch(match, now) {
  const events = [];
  const dropped = sweepDisconnected(match, now);
  if (dropped.length) events.push({ type: "dropped", ids: dropped });

  const ready = activeCount(match);

  switch (match.state) {
    case "waiting": {
      if (ready >= match.minPlayers) {
        match.state = "countdown";
        match.countdownEndsAt = now + COUNTDOWN_MS;
        events.push({ type: "countdown", endsAt: match.countdownEndsAt });
      }
      break;
    }

    case "countdown": {
      // ★ လူကျသွားရင် ပြန်စောင့် — countdown ဆက်သွားပြီး ၂ ယောက်နဲ့
      //   ပွဲစရင် ချက်ချင်း ပြီးသွားမယ်။
      if (ready < match.minPlayers) {
        match.state = "waiting";
        match.countdownEndsAt = null;
        events.push({ type: "waiting", reason: "not-enough-players" });
        break;
      }
      if (now >= match.countdownEndsAt) {
        match.state = "live";
        match.startedAt = now;
        match.endsAt = now + match.matchMs;
        match.countdownEndsAt = null;
        for (const p of match.players.values()) {
          p.playing = true;
          p.score = 0;
        }
        events.push({ type: "start", endsAt: match.endsAt });
      }
      break;
    }

    case "live": {
      // ★ လူအားလုံး ထွက်သွားရင် ပွဲရပ် — room ကတော့ ကျန်နေရမယ်
      //   (spec A3.3)。 Match ကို room နဲ့ တွဲဖျက်ရင် ဝင်လာတဲ့သူတိုင်း
      //   room အသစ် ဆောက်နေရမယ်။
      if (ready === 0) {
        endMatch(match, now, { reason: "abandoned", winnerId: null });
        events.push({ type: "end", result: match.result });
        break;
      }
      if (now >= match.endsAt) {
        endMatch(match, now, { reason: "time", winnerId: topScorer(match) });
        events.push({ type: "end", result: match.result });
      }
      break;
    }

    case "ended": {
      if (now >= match.resultEndsAt) {
        resetToWaiting(match);
        events.push({ type: "waiting", reason: "next-round" });
      }
      break;
    }
  }

  return events;
}

/// ပွဲပြီးစေတယ် — mode က အနိုင်ရသူကို ဆုံးဖြတ်ပြီး ဒါကို ခေါ်တယ်။
function endMatch(match, now, { reason, winnerId = null } = {}) {
  match.state = "ended";
  match.resultEndsAt = now + ENDED_MS;
  match.endsAt = null;
  match.result = {
    reason: reason ?? "unknown",
    winnerId,
    scores: [...match.players.values()]
      .map((p) => ({ id: p.id, name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)),
  };
  return match.result;
}

function resetToWaiting(match) {
  match.state = "waiting";
  match.startedAt = null;
  match.endsAt = null;
  match.countdownEndsAt = null;
  match.resultEndsAt = null;
  match.result = null;
  match.modeState = {};
  // ★ ကြည့်ရှုသူတွေကို ကစားသမား ဖြစ်စေတယ် — နောက်ပွဲကို စောင့်နေတာမို့။
  for (const id of match.spectators) {
    if (match.players.size >= match.maxPlayers) break;
    if (!match.players.has(id)) {
      const p = makeMatchPlayer(id, "Gwave", Date.now());
      p.playing = true;
      match.players.set(id, p);
    }
  }
  match.spectators.clear();
  for (const p of match.players.values()) {
    p.score = 0;
    p.playing = true;
  }
}

function topScorer(match) {
  let best = null;
  for (const p of match.players.values()) {
    if (!best || p.score > best.score || (p.score === best.score && p.id < best.id)) best = p;
  }
  // ★ အမှတ် ၀ ချည်းဆိုရင် အနိုင်ရသူ မရှိဘူး — ဘာမှမလုပ်ဘဲ ငြိမ်နေသူကို
  //   အနိုင်ပေးရင် ရပ်နေတာက အကောင်းဆုံး ဗျူဟာ ဖြစ်သွားမယ်။
  return best && best.score > 0 ? best.id : null;
}

/// Match ကို ဖျက်သင့်ပြီလား — ကစားသမားရော ကြည့်ရှုသူရော မကျန်တော့ရင်။
function isEmpty(match) {
  return match.players.size === 0 && match.spectators.size === 0;
}

module.exports = {
  COUNTDOWN_MS,
  ENDED_MS,
  DISCONNECT_GRACE_MS,
  REJOIN_PENALTY_MS,
  STATES,
  createMatch,
  joinMatch,
  leaveMatch,
  sweepDisconnected,
  activeCount,
  tickMatch,
  endMatch,
  resetToWaiting,
  topScorer,
  isEmpty,
};
