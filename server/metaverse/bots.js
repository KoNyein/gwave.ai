"use strict";

const assassin = require("./assassin.js");

/// 🏴‍☠️ ဓားပြ Bot NPC များ — arena ရဲ့ server-side AI。
///
/// ဒီဇိုင်း (user နဲ့ အတည်ပြုပြီး + balance feedback အရ ညှိပြီး):
///   · NPC တွေက ပုံမှန် **ငြိမ်းချမ်းစွာ** လှည့်လည်နေတယ် — **avatar က
///     စပစ်မှသာ** ရန်ငြိုးထား (grudge ~၂၅ စက္ကန့်) ပြီး ပြန်တုံ့ပြန်တယ်။
///     အနားကပ်ရုံနဲ့ ဘယ်တော့မှ မတိုက်ဘူး။
///   · 👋 wave နဲ့ **မိတ်ဆွေဖွဲ့လို့ရတယ်** — friend ဖြစ်ရင် နောက်က
///     လိုက်ပြီး ကိုယ့်ကို ပစ်တဲ့သူကို ပြန်ကူပစ်ပေးတယ်။ Friend ကို
///     ပစ်မိရင် မိတ်ဆွေပျက်ပြီး ရန်သူ ပြန်ဖြစ်တယ်။
///   · သေရင် လက်နက် ကျတယ် (assassin.js ရဲ့ drop system) — ကောက်လို့ရတယ်။
///
/// ★ ဒီ file မှာ socket မရှိဘူး — assassin.js လိုပဲ state + စည်းမျဉ်းသာ။
///   Transport (server.js) က tick() ကို ခေါ်ပြီး ပြန်လာတဲ့ event တွေကို
///   broadcast လုပ်ရုံပဲ။ ဒါမှ browser မလိုဘဲ စမ်းလို့ရတယ်။
/// ★ Bot တွေက match.players ထဲမှာ `bot: true` နဲ့ နေတယ် — hit-reg၊
///   damage၊ respawn၊ scoreboard အားလုံး လမ်းကြောင်းအဟောင်းအတိုင်း
///   အလုပ်လုပ်တယ်၊ code လမ်းကြောင်း ဒုတိယတစ်ခု မဆောက်ဘူး။

/// id prefix — client id တွေက uuid/guest token မို့ မတိုက်ဆိုင်နိုင်ဘူး
const BOT_PREFIX = "bot:";
/// 🐕 ခွေးတွေက လူထက်မြန်တယ် (ပြေးရင်တော့ လွတ်နိုင်သေးတယ်)၊ ကိုက်တာက
/// melee သီးသန့် — ဓားပြတွေကတော့ သေနတ်နဲ့။
const BOT_DEFS = [
  { name: "ဓားပြ ဖိုးသောက်", weapon: "smg", skin: "phantom", speed: 3.8 },
  { name: "ဓားပြ ငစိန်", weapon: "shotgun", skin: "commander", speed: 3.8 },
  { name: "ဓားပြ ရွှေတုတ်", weapon: "revolver", skin: "ranger", speed: 3.8 },
  { name: "🐕 ခွေးနက်", weapon: "bite", skin: "phantom", speed: 5.2, dog: true },
  { name: "🐕 ရွှေဝါ", weapon: "bite", skin: "knight", speed: 5.2, dog: true },
];
const BOT_COUNT = BOT_DEFS.length;

/// ရန်ငြိုး ကြာချိန် — ပစ်ခံရရင် ဒီလောက်ကြာ လိုက်တယ်။
/// ★ User feedback: NPC တွေ ရန်လိုလွန်း/စွမ်းအားကြီးလွန်း — အခု **avatar
///   က စပစ်မှသာ** ရန်ဖြစ်တယ် (အနားကပ်ရုံနဲ့ မတိုက်တော့ဘူး)၊ ရန်ငြိုးလည်း
///   တိုတိုပဲ ထားပြီး မြန်မြန် မေ့တယ်။
const GRUDGE_MS = 25000;
/// 👋 မိတ်ဆွေဖွဲ့နိုင်တဲ့ အကွာအဝေး
const FRIEND_RANGE = 4;
/// Friend နောက်လိုက်ရင် ထားမယ့် အကွာအဝေး
const FOLLOW_DIST = 3.5;
/// ခြေလှမ်း (m/s) — လူထက် နှေးတယ်၊ ပြေးရင် လွတ်နိုင်တယ်
const WANDER_SPEED = 2.4;
const CHASE_SPEED = 3.8;
/// ပစ်မှတ် တွေ့ပြီး ချက်ချင်း မပစ်ဘူး — ချိန်ချိန်ဆဆ (လူဆန်အောင်၊
/// ရှောင်ဖို့/ပြေးဖို့ အချိန်ရအောင် ရှည်ရှည်ထားတယ်)
const AIM_SETTLE_MS = 900;
/// ကျည်ကုန်ရင် ပြန်ဖြည့်ချိန်
const RELOAD_MS = 1400;

const isBot = (p) => !!p && !!p.bot;

function humans(match) {
  return [...match.players.values()].filter((p) => !p.bot);
}

function bots(match) {
  return [...match.players.values()].filter((p) => p.bot);
}

/// Room ထဲ လူရှိရင် ဓားပြ ၃ ယောက် အပြည့်ရှိအောင် ထည့်တယ်။
/// ပြန်လာတဲ့ event တွေက aEnter — client တွေက board + avatar ထည့်ဖို့။
function ensureBots(match) {
  const out = [];
  if (humans(match).length === 0) return out;
  const have = new Set(bots(match).map((b) => b.id));
  for (let i = 0; i < BOT_COUNT; i++) {
    const id = BOT_PREFIX + (i + 1);
    if (have.has(id)) continue;
    const def = BOT_DEFS[i % BOT_DEFS.length];
    const b = assassin.makeBot(id, def.name, match.seq++, def.weapon, def.skin);
    if (def.dog) b.dog = true;
    b.botSpeed = def.speed;
    // Spawn ကွဲအောင် နည်းနည်း ရွှေ့ — လူ spawn ပေါ် တည့်တည့် မကျအောင်
    b.x += (i - 1) * 1.5;
    b.grudge = {};
    b.friendOf = null;
    b.wanderX = b.x;
    b.wanderZ = b.z;
    b.aimSince = 0;
    b.reloadUntil = 0;
    match.players.set(id, b);
    out.push({ all: true, msg: { type: "aEnter", player: assassin.publicPlayer(b) } });
    out.push({
      all: true,
      msg: { type: "aMove", id: b.id, x: r2(b.x), y: 0, z: r2(b.z), ry: r2(b.ry) },
    });
  }
  return out;
}

/// ⚔️ ထိမှန်မှုတိုင်းနောက် ခေါ်တယ် — ရန်ငြိုး/ခုခံမှု စည်းမျဉ်းတွေ:
///   · Bot အထိခံရရင် → ပစ်သူကို ရန်ငြိုး (friend ဆိုရင် မိတ်ဆွေပျက်)
///   · Friend လူသား အထိခံရရင် → သူ့ friend bot က ပစ်သူကို ရန်ငြိုး (ကူညီ)
/// Bot အချင်းချင်းက ဘယ်တော့မှ မတိုက်ဘူး — bot ပစ်သူကို လျစ်လျူရှုတယ်။
function noteHit(match, attackerId, victimId, now = Date.now()) {
  const attacker = match.players.get(attackerId);
  const victim = match.players.get(victimId);
  if (!attacker || isBot(attacker)) return;
  if (isBot(victim)) {
    if (victim.friendOf === attackerId) victim.friendOf = null;
    victim.grudge[attackerId] = now + GRUDGE_MS;
    return;
  }
  // လူသားချင်း — victim ရဲ့ friend bot တွေ ခုခံတယ်
  for (const b of bots(match)) {
    if (b.friendOf === victimId && attackerId !== victimId) {
      b.grudge[attackerId] = now + GRUDGE_MS;
    }
  }
}

/// 👋 Wave နဲ့ မိတ်ဆွေဖွဲ့ခြင်း — အနီးဆုံး bot (ရန်ငြိုးမရှိ၊ friend
/// မဟုတ်သေး) တစ်ယောက်နဲ့ ဖြစ်တယ်။ Event ပြန်မလာရင် ဘာမှ မဖြစ်ဘူး။
function befriend(match, playerId, now = Date.now()) {
  const me = match.players.get(playerId);
  if (!me || isBot(me) || !me.alive) return [];
  let best = null;
  let bestD = FRIEND_RANGE;
  for (const b of bots(match)) {
    if (!b.alive || b.friendOf === playerId) continue;
    if ((b.grudge[playerId] ?? 0) > now) continue; // ရန်ငြိုးရှိရင် လက်မခံဘူး
    const d = Math.hypot(b.x - me.x, b.z - me.z);
    if (d < bestD) {
      best = b;
      bestD = d;
    }
  }
  if (!best) return [];
  best.friendOf = playerId;
  return [
    {
      all: true,
      msg: {
        type: "aBotMood",
        id: best.id,
        name: best.name,
        mood: "friend",
        of: playerId,
        /// 🐕 Client က ခွေးအတွက် banner စာသား ကွဲပြဖို့
        dog: !!best.dog,
      },
    },
  ];
}

/// Bot တစ်ယောက်ရဲ့ ပစ်မှတ် — ရန်ငြိုး သက်တမ်းရှိပြီး အသက်ရှင်တဲ့
/// အနီးဆုံးလူ။
function pickTarget(match, b, now) {
  let best = null;
  let bestD = Infinity;
  for (const [pid, until] of Object.entries(b.grudge)) {
    if (until <= now) {
      delete b.grudge[pid];
      continue;
    }
    const p = match.players.get(pid);
    if (!p || !p.alive || isBot(p)) continue;
    const d = Math.hypot(p.x - b.x, p.z - b.z);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best ? { target: best, dist: bestD } : null;
}

const r2 = (n) => Math.round(n * 100) / 100;

/// ── AI tick — transport က ~150ms တိုင်း ခေါ်တယ် ─────────────────────────
/// ပြန်လာတာ: broadcast လုပ်ရမယ့် event စာရင်း (aMove/aShot/aHit/aKill…)。
function tick(match, now = Date.now(), dt = 0.15) {
  const out = [];
  const hs = humans(match);
  if (hs.length === 0) return out;

  for (const b of bots(match)) {
    if (!b.alive) continue;

    // ★ အနားကပ်ရုံနဲ့ **မတိုက်ဘူး** — ရန်ငြိုးက noteHit (ပစ်ခံရမှ) ကနေသာ
    //   လာတယ်။ NPC တွေက ပုံမှန် ငြိမ်းချမ်းပြီး avatar က စမှသာ ပြန်တုံ့ပြန်တယ်။
    const picked = pickTarget(match, b, now);
    const friend = b.friendOf ? match.players.get(b.friendOf) : null;
    if (b.friendOf && !friend) b.friendOf = null; // friend ထွက်သွားရင်

    let moved = false;
    if (picked) {
      // ── လိုက်ပစ် ────────────────────────────────────────────────────
      const { target, dist } = picked;
      const w = assassin.WEAPONS[b.weapon] ?? assassin.WEAPONS.pistol;
      b.ry = Math.atan2(target.x - b.x, target.z - b.z);
      if (b.aimSince === 0) b.aimSince = now;
      // 🐕 Melee (ကိုက်/ဓား) ဆို ကိုက်နိုင်တဲ့အကွာအထိ ကပ်ရမယ် — သေနတ်ဆို
      //   range ရဲ့ တစ်ဝက်လောက်မှာ ရပ်ပြီး ပစ်တယ်။
      const wantD = w.range < 5 ? w.range * 0.6 : Math.max(2.5, w.range * 0.55);
      if (dist > wantD) {
        moved = stepToward(b, target.x, target.z, (b.botSpeed ?? CHASE_SPEED) * dt);
      }
      const canFire =
        dist <= w.range * 0.95 &&
        now - b.aimSince >= AIM_SETTLE_MS &&
        now >= b.reloadUntil;
      if (canFire) {
        out.push(...botFire(match, b, target, dist, now));
      }
    } else {
      b.aimSince = 0;
      if (friend && friend.alive) {
        // ── Friend နောက်လိုက် ────────────────────────────────────────
        const d = Math.hypot(friend.x - b.x, friend.z - b.z);
        if (d > FOLLOW_DIST) {
          moved = stepToward(b, friend.x, friend.z, (b.botSpeed ?? CHASE_SPEED) * dt);
          b.ry = Math.atan2(friend.x - b.x, friend.z - b.z);
        }
      } else {
        // ── လှည့်လည် — ရောက်ရင် နေရာအသစ် မဲတယ် ─────────────────────
        const d = Math.hypot(b.wanderX - b.x, b.wanderZ - b.z);
        if (d < 1) {
          const a = Math.random() * Math.PI * 2;
          const r = 6 + Math.random() * (assassin.ARENA - 8);
          b.wanderX = Math.cos(a) * r;
          b.wanderZ = Math.sin(a) * r;
        } else {
          moved = stepToward(b, b.wanderX, b.wanderZ, WANDER_SPEED * dt);
          b.ry = Math.atan2(b.wanderX - b.x, b.wanderZ - b.z);
        }
      }
    }

    if (moved) {
      out.push({
        all: true,
        msg: { type: "aMove", id: b.id, x: r2(b.x), y: 0, z: r2(b.z), ry: r2(b.ry) },
      });
    }
  }
  return out;
}

function stepToward(b, tx, tz, step) {
  const dx = tx - b.x;
  const dz = tz - b.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-3) return false;
  const k = Math.min(1, step / d);
  b.x += dx * k;
  b.z += dz * k;
  const r = Math.hypot(b.x, b.z);
  if (r > assassin.ARENA) {
    b.x = (b.x / r) * assassin.ARENA;
    b.z = (b.z / r) * assassin.ARENA;
  }
  return true;
}

/// Bot ပစ်ချက် — assassin.handleFire ကိုပဲ သုံးတယ် (fire-rate/ကျည်/hit-reg
/// စည်းမျဉ်း တစ်ပုံစံတည်း)။ ချိန်ချက်မှာ **လွဲချက်** ထည့်ထားတယ် — ဝေးလေ
/// လွဲလေ၊ ဒါမှ လူက ရွေ့ရင်း ရှောင်လို့ရတယ် (aimbot မဟုတ်ဘူး)。
function botFire(match, b, target, dist, now) {
  // ★ လွဲချက်ကြီးကြီး — NPC က လူလို မမှန်ရဘူး (user feedback: အရမ်း
  //   စွမ်းအားကြီး)။ ရွေ့နေရင် အများကြီး လွဲမယ်။
  const err = 0.12 + dist * 0.012;
  const dx = target.x - b.x + (Math.random() - 0.5) * err * dist;
  const dy = target.y + 0.9 - (b.y + 1.6) + (Math.random() - 0.5) * err * dist;
  const dz = target.z - b.z + (Math.random() - 0.5) * err * dist;
  const events = assassin.handleFire(match, b, { dx, dy, dz }, now);
  // ပစ်ချက်ကြား ပိုကြာကြာ နား — bot ရဲ့ DPS ကို လူ့အောက် ချထားတယ်
  if (events.some((e) => e.msg?.type === "aShot")) {
    b.reloadUntil = Math.max(b.reloadUntil, now + (assassin.WEAPONS[b.weapon]?.fireMs ?? 400));
  }
  // ကျည်ကုန်ရင် — bot က HUD မရှိလို့ သူ့ဘာသာ ပြန်ဖြည့်တယ် (ခဏ ရပ်ပြီး)
  const w = assassin.WEAPONS[b.weapon];
  if (w && w.ammo !== Infinity && b.ammo[b.weapon] <= 0) {
    b.ammo[b.weapon] = w.ammo;
    b.reloadUntil = Math.max(b.reloadUntil, now + RELOAD_MS);
  }
  // aNoAmmo လို bot-ဆီပို့မယ့် personal event တွေ ဖယ် — socket မရှိဘူး
  return events.filter((e) => !(e.to && String(e.to).startsWith(BOT_PREFIX)));
}

module.exports = {
  AIM_SETTLE_MS,
  BOT_COUNT,
  BOT_PREFIX,
  FRIEND_RANGE,
  GRUDGE_MS,
  befriend,
  ensureBots,
  isBot,
  noteHit,
  tick,
};
