"use strict";

/// Gwave Assassin — match logic (၁၈+ mini-game)。
///
/// ကစားနည်း — ကစားသမားတိုင်းမှာ **လျှို့ဝှက်ပစ်မှတ်** တစ်ယောက်စီ ရှိတယ်။
/// ကိုယ့်ကို ဘယ်သူ ပစ်မှတ်ထားလဲ မသိရဘူး။ မှန်တဲ့ပစ်မှတ် ရရင် +၁၊ လူမှားရင် −၁။
///
/// ★ ဒီ file မှာ HTTP/WebSocket မပါဘူး — state နဲ့ စည်းမျဉ်းသာ။ Transport က
///   metaverse server (server.js) ပဲ ဖြစ်တယ်။ ဒါက အရေးကြီးတယ်:
///   (၁) auth/၁၈+ gate/room/ghost fan-out အားလုံး ရှိပြီးသားကို ပြန်သုံးတယ်၊
///   (၂) စည်းမျဉ်းတွေကို socket မလိုဘဲ စမ်းလို့ရတယ်၊
///   (၃) "app တစ်ခု၊ pipeline တစ်ခု" — server ဒုတိယတစ်ခု မထပ်ဆောက်ဘူး။
///
/// ★★ Skin တွေက **အလှသက်သက်** — မူရင်း prototype မှာ ပိုက်ဆံပေးရတဲ့ skin က
///    armor ၄၂% နဲ့ helmet ၄၅% အထိ ပေးထားပြီး ကိုယ်တိုင်လည်း
///    "⚠️ pay-to-win ဒီဇိုင်း" လို့ မှတ်ထားတယ်။ Gwave ရဲ့ စည်းမျဉ်းက
///    ဆုလာဘ်တွေဟာ cosmetic သာ ဖြစ်ရမယ် ဆိုတာမို့ ကာကွယ်မှုတန်ဖိုးတွေကို
///    ဖယ်ထားတယ် — အရောင်ရွေးလို့ရပေမယ့် ဘယ် skin ကမှ ပိုမခံနိုင်ဘူး။

const crypto = require("crypto");

const MAX_HP = 100;
const KILLS_TO_WIN = 3;
const RESPAWN_MS = 4000;
const ROUND_RESET_MS = 5000;

/// ကွင်းအကျယ် (radius) — ဒီအပြင် ထွက်လို့ မရဘူး။
const ARENA = 30;

/// ★ လက်နက်တွေရဲ့ တန်ဖိုးက **server မှာသာ** ရှိတယ်။ Client က ပြဖို့သာ
///   မိတ္တူယူတယ် — client ကနေ ပြင်ပို့လာတာကို ဘယ်တော့မှ မယုံရ။
const WEAPONS = {
  pistol: { my: "ပစ္စတို", dmg: 34, range: 45, fireMs: 320, ammo: 12, headMult: 2.0, splash: 0 },
  knife: { my: "ဓား", dmg: 55, range: 2.6, fireMs: 520, ammo: Infinity, headMult: 1.6, splash: 0 },
  sniper: { my: "စနိုက်ပါ", dmg: 85, range: 140, fireMs: 1400, ammo: 5, headMult: 2.0, splash: 0 },
  bomb: { my: "ဗုံး", dmg: 90, range: 18, fireMs: 2600, ammo: 2, headMult: 1.0, splash: 6 },
  // ── လက်နက်အသစ်များ ─────────────────────────────────────────────────────
  // ★ တစ်ခုချင်းစီမှာ **သီးသန့် အသုံးဝင်ချက်** ရှိရမယ် — ပစ္စတိုထက် အရာရာ
  //   ပိုကောင်းတဲ့ လက်နက် ထည့်လိုက်ရင် ရွေးစရာ မကျန်တော့ဘူး။
  //   smg     — မြန်ပေမယ့် အားနည်း၊ အနီးကပ်တိုက်ပွဲအတွက်
  //   shotgun — အနီးမှာ ကြောက်စရာ၊ ၈ မီတာကျော်ရင် အလကား
  //   revolver— နှေးပေမယ့် ခေါင်းထိရင် တစ်ချက်တည်း
  smg: { my: "အက်စ်အမ်ဂျီ", dmg: 17, range: 30, fireMs: 95, ammo: 30, headMult: 1.6, splash: 0 },
  shotgun: { my: "သေနတ်ကြီး", dmg: 96, range: 9, fireMs: 900, ammo: 6, headMult: 1.2, splash: 0 },
  revolver: { my: "ရီဗော်လ်ဗာ", dmg: 62, range: 55, fireMs: 1100, ammo: 6, headMult: 2.1, splash: 0 },
};

/// ★ `armor`/`helmet` မရှိတော့ဘူး — အပေါ်က မှတ်ချက် ကြည့်ပါ။
const SKINS = {
  rookie: { my: "အစပြု", color: 0xe07a5f },
  scout: { my: "ကင်းထောက်", color: 0x81b29a },
  ranger: { my: "တောစောင့်", color: 0x3d5a80 },
  knight: { my: "သူရဲ", color: 0xf2cc8f },
  phantom: { my: "တစ္ဆေ", color: 0x6b4e71 },
  commander: { my: "တပ်မှူး", color: 0xd4a373 },
};

const SPAWNS = [
  { x: 0, z: -22 }, { x: 20, z: -12 }, { x: 24, z: 10 }, { x: 8, z: 24 },
  { x: -14, z: 20 }, { x: -24, z: 2 }, { x: -18, z: -16 }, { x: 12, z: 6 },
];

/// ★ အမြန်ဆုံး ခြေလှမ်း (m/s) + ခွင့်လွှတ်ချက်။ Client က နေရာကို ကိုယ်တိုင်
///   ပြောတာမို့ စစ်ဖို့ လိုတယ် — မစစ်ရင် "ငါ ဒီမှာရှိတယ်" ဆိုပြီး ပစ်မှတ်ဘေး
///   ခုန်ရောက်သွားလို့ ပစ်ခတ်မှုရဲ့ အကွာအဝေးစစ်ဆေးချက် တစ်ခုလုံး အလကား
///   ဖြစ်သွားမယ် (ဓားနဲ့ ကွင်းတစ်ဖက်ကနေ သတ်လို့ရသွားမယ်)。
const MAX_SPEED = 9;
const SPEED_GRACE = 1.6;

function makePlayer(id, name, index) {
  const sp = SPAWNS[index % SPAWNS.length];
  return {
    id,
    name,
    skin: "rookie",
    x: sp.x, y: 0, z: sp.z, ry: 0,
    hp: MAX_HP,
    alive: true,
    /// မှန်ကန်တဲ့ ပစ်မှတ်ကို ရတာသာ ရေတွက်တယ်
    kills: 0,
    wrongKills: 0,
    deaths: 0,
    score: 0,
    /// ကိုယ် ရှာရမယ့်သူ
    targetId: null,
    /// ★ ကိုယ့်ကို ရှာနေသူ — client ဆီ **ဘယ်တော့မှ မပို့ရ**။ ပို့မိရင်
    ///   ဂိမ်းရဲ့ အနှစ်သာရ (ဘယ်သူက လိုက်နေမှန်း မသိရတာ) ပျက်သွားမယ်။
    hunterId: null,
    weapon: "pistol",
    ammo: freshAmmo(),
    lastFire: 0,
    lastMoveAt: 0,
    respawnAt: 0,
  };
}

/// ★ WEAPONS ကနေ တွက်တယ် — လက်နက်အသစ် ထည့်တိုင်း ဒီ function ကို
///   ပြင်ဖို့ မမေ့သွားအောင် (မေ့ရင် ကျည် undefined ဖြစ်ပြီး ဘယ်တော့မှ
///   မပစ်နိုင်တော့ဘူး)。
function freshAmmo() {
  const out = {};
  for (const [id, w] of Object.entries(WEAPONS)) out[id] = w.ammo;
  return out;
}

/// Match တစ်ခု — room တစ်ခုစီမှာ တစ်ခုစီ။
///
/// ★ မူရင်း prototype မှာ `players` က module-level Map တစ်ခုတည်း ဖြစ်နေတယ် —
///   ဆိုလိုတာက ကမ္ဘာပေါ်က ကစားသမား အားလုံး တစ်ပွဲထဲမှာ ရောနေမယ်။ Room
///   အလိုက် ခွဲထားမှ ပွဲတွေ သီးခြားဖြစ်တယ်။
function createMatch() {
  return { players: new Map(), seq: 0, endsAt: 0 };
}

/// ── ပစ်မှတ် ခွဲဝေခြင်း — သံသရာပုံစံ (A → B → C → A) ─────────────────────
///
/// ★ ဒါမှ ကစားသမားတိုင်း ပစ်မှတ်တစ်ခုစီ ရပြီး၊ တစ်ယောက်ချင်းစီကိုလည်း
///   တစ်ယောက်တည်းက လိုက်ရှာတယ်။
function assignTargets(match, rng = crypto) {
  const alive = [...match.players.values()].filter((p) => p.alive);
  if (alive.length < 2) {
    for (const p of match.players.values()) {
      p.targetId = null;
      p.hunterId = null;
    }
    return;
  }
  const order = alive.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.randomInt(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (const p of match.players.values()) {
    p.targetId = null;
    p.hunterId = null;
  }
  for (let i = 0; i < order.length; i++) {
    const me = order[i];
    const next = order[(i + 1) % order.length];
    me.targetId = next.id;
    next.hunterId = me.id;
  }
}

/// တစ်ယောက် ထွက်/သေသွားရင် သံသရာကို ချိတ်ဆက်ပြန်တယ် — A → B → C မှာ B
/// ထွက်ရင် A → C ဖြစ်ရမယ်။
///
/// ★ ဒါက ပွဲပြီးတိုင်း အားလုံးကို ပြန်ရောတာထက် သိသိသာသာ ကောင်းတယ်:
///   ရောလိုက်တိုင်း လူတိုင်းရဲ့ ပစ်မှတ် ပြောင်းသွားလို့ လိုက်ရှာနေတာတွေ
///   အလကားဖြစ်သွားတယ်။ မူရင်း prototype က သတ်တိုင်း `assignTargets()`
///   ပြန်ခေါ်နေတာမို့ relink လုပ်ထားတာ အချည်းနှီး ဖြစ်နေတယ်။
function relinkAfterRemoval(match, gone) {
  const hunter = gone.hunterId ? match.players.get(gone.hunterId) : null;
  const target = gone.targetId ? match.players.get(gone.targetId) : null;

  if (hunter && target && hunter.id !== target.id) {
    hunter.targetId = target.id;
    target.hunterId = hunter.id;
  } else {
    if (hunter) hunter.targetId = null;
    if (target) target.hunterId = null;
  }
  gone.targetId = null;
  gone.hunterId = null;
}

/// ── Client ဆီ ပို့မယ့် ပုံစံ ─────────────────────────────────────────────
///
/// ★ `hunterId` ရော တခြားသူရဲ့ `targetId` ရော ဒီမှာ **မပါဘူး** — ပါသွားရင်
///   browser ရဲ့ network tab တစ်ချက်ကြည့်ရုံနဲ့ ဂိမ်းပြီးသွားမယ်။
function publicPlayer(p) {
  return {
    id: p.id,
    name: p.name,
    skin: p.skin,
    x: round2(p.x), y: round2(p.y), z: round2(p.z), ry: round2(p.ry),
    hp: p.hp,
    alive: p.alive,
    kills: p.kills,
    score: p.score,
    weapon: p.weapon,
  };
}

function personalState(match, me) {
  const t = me.targetId ? match.players.get(me.targetId) : null;
  return {
    id: me.id,
    hp: me.hp,
    alive: me.alive,
    kills: me.kills,
    score: me.score,
    wrongKills: me.wrongKills,
    weapon: me.weapon,
    skin: me.skin,
    ammo: serializeAmmo(me.ammo),
    target: t ? { id: t.id, name: t.name } : null,
  };
}

/// `Infinity` က JSON မှာ `null` ဖြစ်သွားလို့ −၁ နဲ့ ကိုယ်စားပြုတယ်။
///
/// ★ WEAPONS ကနေ တွက်တယ် — အရင်က လက်နက် ၄ ခုကို လက်နဲ့ စာရင်းရေးထားလို့
///   အသစ်ထည့်ရင် သူ့ကျည်က client ဆီ လုံးဝ မရောက်ဘဲ HUD မှာ ဗလာ ပြနေမယ်။
const serializeAmmo = (a) => {
  const out = {};
  for (const id of Object.keys(WEAPONS)) {
    const n = a[id];
    out[id] = n === Infinity || n === undefined ? -1 : n;
  }
  return out;
};

const round2 = (n) => Math.round(n * 100) / 100;

/// ── ထိမှန်မှု ────────────────────────────────────────────────────────────
///
/// ★ Skin က ထိခိုက်မှုကို လုံးဝ မပြောင်းတော့ဘူး (အပေါ်က မှတ်ချက်)。
function computeDamage(weaponKey, hitPart, dist) {
  const w = WEAPONS[weaponKey];
  if (!w) return 0;
  let dmg = w.dmg;
  if (w.splash === 0 && dist > w.range * 0.6) {
    const falloff = 1 - ((dist - w.range * 0.6) / (w.range * 0.4)) * 0.4;
    dmg *= Math.max(0.6, falloff);
  }
  if (hitPart === "head") dmg *= w.headMult;
  return Math.max(1, Math.round(dmg));
}

/// ── ရွေ့လျားမှု စစ်ဆေးခြင်း ──────────────────────────────────────────────
///
/// ★ Client က နေရာကို ကိုယ်တိုင် ပြောတယ်။ လက်ခံတဲ့အခါ **ဘယ်လောက် မြန်မြန်
///   ရောက်လာလဲ** စစ်ရမယ်။ မစစ်ရင် ပစ်ခတ်မှုရဲ့ range စစ်ဆေးချက်က
///   အလကားဖြစ်တယ် — ပစ်မှတ်ဘေး ခဏခုန်ရောက်ပြီး ဓားနဲ့ထိုး၊ ပြန်ခုန်ပြန်။
/// ★ ရောက်ရမယ့်ထက် ဝေးရင် **ငြင်းမပစ်ဘဲ ဆွဲထားတယ်** — ငြင်းလိုက်ရင် ping
///   မကောင်းတဲ့သူတွေ တုန်နေမယ်။ တားထားတာက အကွာအဝေးသာ။
function applyMove(match, me, msg, now = Date.now()) {
  if (!me.alive) return false;
  const nx = Number(msg.x);
  const nz = Number(msg.z);
  const ny = Number(msg.y);
  const nry = Number(msg.ry);
  if (!Number.isFinite(nx) || !Number.isFinite(nz)) return false;

  const dt = me.lastMoveAt ? Math.min(1, (now - me.lastMoveAt) / 1000) : 1;
  me.lastMoveAt = now;
  const maxStep = MAX_SPEED * dt * SPEED_GRACE + 0.5;

  let tx = nx;
  let tz = nz;
  const dx = tx - me.x;
  const dz = tz - me.z;
  const d = Math.hypot(dx, dz);
  if (d > maxStep) {
    tx = me.x + (dx / d) * maxStep;
    tz = me.z + (dz / d) * maxStep;
  }
  // ကွင်းအပြင် မထွက်ရ
  const r = Math.hypot(tx, tz);
  if (r > ARENA) {
    tx = (tx / r) * ARENA;
    tz = (tz / r) * ARENA;
  }
  me.x = tx;
  me.z = tz;
  me.y = Number.isFinite(ny) ? Math.max(0, Math.min(6, ny)) : 0;
  if (Number.isFinite(nry)) me.ry = nry;
  return true;
}

/// ── သတ်ဖြတ်မှု ဆုံးဖြတ်ခြင်း ─────────────────────────────────────────────
function resolveKill(match, killer, victim, now = Date.now()) {
  victim.alive = false;
  victim.hp = 0;
  victim.deaths++;
  victim.respawnAt = now + RESPAWN_MS;

  const correct = killer.targetId === victim.id;
  if (correct) {
    killer.kills++;
    killer.score += 1;
  } else {
    // ★ လူမှားသတ်ရင် အမှတ်လျော့ — ဒါက ဂိမ်းကို "အားလုံးကို ပစ်" မဟုတ်ဘဲ
    //   "မှန်တဲ့သူကို ရှာ" ဖြစ်စေတဲ့ တစ်ခုတည်းသော အရာ။
    killer.wrongKills++;
    killer.score -= 1;
  }

  relinkAfterRemoval(match, victim);
  const won = correct && killer.kills >= KILLS_TO_WIN;
  return { correct, won };
}

/// ပြန်ရှင်ချိန် ရောက်သူတွေကို ပြန်ရှင်စေတယ်။ ပြန်ရှင်သွားသူ စာရင်း ပြန်ပေးတယ်။
function respawnDue(match, now = Date.now(), rng = crypto) {
  const back = [];
  for (const p of match.players.values()) {
    if (p.alive || now < p.respawnAt) continue;
    const sp = SPAWNS[rng.randomInt(SPAWNS.length)];
    p.alive = true;
    p.hp = MAX_HP;
    p.x = sp.x;
    p.z = sp.z;
    p.y = 0;
    p.ammo = freshAmmo();
    p.lastMoveAt = 0;
    back.push(p);
  }
  return back;
}

function resetRound(match, rng = crypto) {
  for (const p of match.players.values()) {
    p.kills = 0;
    p.score = 0;
    p.wrongKills = 0;
    p.deaths = 0;
    p.hp = MAX_HP;
    p.alive = true;
    const sp = SPAWNS[rng.randomInt(SPAWNS.length)];
    p.x = sp.x;
    p.z = sp.z;
    p.y = 0;
    p.ammo = freshAmmo();
    p.lastMoveAt = 0;
  }
  assignTargets(match, rng);
}

/// ── ပစ်ခတ်မှု — server က ဆုံးဖြတ်တယ် ────────────────────────────────────
///
/// Client က "ငါ ထိတယ်" ပြောတာကို တစ်ခုတည်းနဲ့ မယုံဘူး: ပစ်နှုန်း၊ ကျည်၊
/// အကွာအဝေး အားလုံး ဒီမှာ ပြန်စစ်တယ်။
///
/// Return: ဖြစ်ပျက်တာတွေရဲ့ စာရင်း — transport က ဒါကို broadcast လုပ်ရုံပဲ။
function handleFire(match, me, msg, now = Date.now()) {
  const out = [];
  if (!me.alive) return out;
  const w = WEAPONS[me.weapon];
  if (!w) return out;
  if (now - me.lastFire < w.fireMs) return out;
  if (w.ammo !== Infinity && me.ammo[me.weapon] <= 0) {
    return [{ to: me.id, msg: { type: "aNoAmmo" } }];
  }
  me.lastFire = now;
  if (w.ammo !== Infinity) me.ammo[me.weapon]--;

  out.push({
    all: true,
    msg: { type: "aShot", id: me.id, weapon: me.weapon, x: round2(me.x), y: round2(me.y), z: round2(me.z), ry: round2(me.ry) },
  });

  if (w.splash > 0) {
    const bx = Number.isFinite(Number(msg.x)) ? Number(msg.x) : me.x;
    const bz = Number.isFinite(Number(msg.z)) ? Number(msg.z) : me.z;
    if (Math.hypot(bx - me.x, bz - me.z) > w.range) return out;
    out.push({ all: true, msg: { type: "aBoom", x: round2(bx), z: round2(bz), radius: w.splash } });
    for (const v of match.players.values()) {
      if (!v.alive) continue;
      const d = Math.hypot(v.x - bx, v.z - bz);
      if (d > w.splash) continue;
      const fall = 1 - d / w.splash;
      const dmg = Math.max(1, Math.round(computeDamage("bomb", "body", 0) * fall));
      out.push(...applyDamage(match, me, v, dmg, "bomb", "body", now));
    }
    return out;
  }

  const victim = match.players.get(msg.targetId);
  if (!victim || !victim.alive || victim.id === me.id) return out;
  const dist = Math.hypot(victim.x - me.x, victim.z - me.z);
  if (dist > w.range) return out;

  const hitPart = msg.hitPart === "head" ? "head" : "body";
  const dmg = computeDamage(me.weapon, hitPart, dist);
  out.push(...applyDamage(match, me, victim, dmg, me.weapon, hitPart, now));
  return out;
}

function applyDamage(match, attacker, victim, dmg, weapon, hitPart, now = Date.now()) {
  const out = [];
  victim.hp -= dmg;
  out.push({
    all: true,
    msg: {
      type: "aHit",
      victimId: victim.id,
      attackerId: attacker.id,
      dmg,
      hitPart,
      hp: Math.max(0, victim.hp),
    },
  });
  if (victim.hp > 0) return out;

  const r = resolveKill(match, attacker, victim, now);
  out.push({
    all: true,
    msg: {
      type: "aKill",
      killerId: attacker.id,
      killerName: attacker.name,
      victimId: victim.id,
      victimName: victim.name,
      weapon,
      hitPart,
      correct: r.correct,
      killerKills: attacker.kills,
      killerScore: attacker.score,
    },
  });
  if (r.won) {
    out.push({
      all: true,
      msg: { type: "aWin", winnerId: attacker.id, winnerName: attacker.name, kills: attacker.kills },
    });
  }
  return out;
}

module.exports = {
  ARENA,
  KILLS_TO_WIN,
  MAX_HP,
  MAX_SPEED,
  RESPAWN_MS,
  ROUND_RESET_MS,
  SKINS,
  SPAWNS,
  WEAPONS,
  applyDamage,
  applyMove,
  assignTargets,
  computeDamage,
  createMatch,
  freshAmmo,
  handleFire,
  makePlayer,
  personalState,
  publicPlayer,
  relinkAfterRemoval,
  resetRound,
  resolveKill,
  respawnDue,
};
