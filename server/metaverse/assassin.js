"use strict";

const combat = require("./combat");

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
/// 💣 ဗုံး fuse — ပစ်လွှတ်ပြီး ဒီအချိန်ကြာမှ ပေါက်ကွဲတယ်
const BOMB_FUSE_MS = 900;

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
  // 🐕 ခွေးကိုက် — NPC သီးသန့် (npc flag)။ လူက ရွေးလို့ မရဘူး — server ရဲ့
  // aWeapon က ငြင်းတယ်၊ client ရဲ့ လက်နက်တန်းကလည်း ဖျောက်ထားတယ်။
  bite: { my: "ကိုက်", dmg: 14, range: 2.2, fireMs: 700, ammo: Infinity, headMult: 1.0, splash: 0, npc: true },
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

/// 🏴‍☠️ ဓားပြ bot — ကစားသမားနဲ့ တူတူပဲ၊ `bot: true` ပဲ ကွာတယ်။
/// AI (ရန်ငြိုး/မိတ်ဆွေ/လှည့်လည်) က bots.js မှာ — ဒီမှာ state ပဲ ဆောက်တယ်။
/// ★ Bot က assassin ရဲ့ ပစ်မှတ်သံသရာ ထဲ **မပါဘူး** (assignTargets မှာ
///   ဖယ်ထားတယ်) — bot သတ်လို့ ပွဲမနိုင်သလို လူမှားလည်း မဖြစ်ဘူး။
/// Bot HP — လူ (100) ထက် နည်းတယ်။ User feedback: NPC စွမ်းအားကြီးလွန်း —
/// အလွယ်တကူ ပြန်နှိမ်လို့ရရမယ်။
const BOT_HP = 70;

function makeBot(id, name, index, weapon = "pistol", skin = "phantom") {
  const b = makePlayer(id, name, index);
  b.bot = true;
  b.hp = BOT_HP;
  if (WEAPONS[weapon]) b.weapon = weapon;
  if (SKINS[skin]) b.skin = skin;
  return b;
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
  /// `drops` — မြေပေါ်ကျနေတဲ့ လက်နက်တွေ (သေသူဆီက)။ ကောက်ရင် ကျည်ရတယ်။
  return { players: new Map(), seq: 0, endsAt: 0, drops: new Map(), dropSeq: 0 };
}

/// ── ပစ်မှတ် ခွဲဝေခြင်း — သံသရာပုံစံ (A → B → C → A) ─────────────────────
///
/// ★ ဒါမှ ကစားသမားတိုင်း ပစ်မှတ်တစ်ခုစီ ရပြီး၊ တစ်ယောက်ချင်းစီကိုလည်း
///   တစ်ယောက်တည်းက လိုက်ရှာတယ်။
function assignTargets(match, rng = crypto) {
  // ★ Bot တွေ သံသရာထဲ မပါဘူး — ပါရင် bot ကို လျှို့ဝှက်ပစ်မှတ် ရသူက
  //   AI ကို သတ်ရုံနဲ့ ပွဲနိုင်သွားမယ် (farm ဖြစ်တယ်)။
  const alive = [...match.players.values()].filter((p) => p.alive && !p.bot);
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
    /// Client က ဓားပြ NPC ကို လူသားနဲ့ ခွဲမြင်ဖို့ (nametag/avatar)
    bot: !!p.bot,
    /// 🐕 ခွေး NPC — client က လူပုံစားမယ့်အစား ခွေး 3D model ဆောက်ဖို့
    dog: !!p.dog,
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

  let correct = false;
  if (killer.bot || victim.bot) {
    // 🏴‍☠️ ဓားပြပါတဲ့ သတ်ဖြတ်မှုက assassin အမှတ်စနစ်ကို **မထိဘူး** —
    //   bot သတ်တာ လူမှားမဟုတ်သလို ပွဲနိုင်မှတ်လည်း မတက်ဘူး။ ဆုက
    //   သူ့ဆီက ကျတဲ့ လက်နက် (drop) ပဲ။
  } else if (killer.targetId === victim.id) {
    correct = true;
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
    p.hp = p.bot ? BOT_HP : MAX_HP;
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
    p.hp = p.bot ? BOT_HP : MAX_HP;
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
    // 💣 ဗုံးက ချက်ချင်း မပေါက်ကွဲဘူး — arc နဲ့ ပျံသွားပြီး fuse ချိန်ပြည့်မှ
    //   ပေါက်ကွဲတယ် (standard grenade)။ Transport (server.js) က `fuse`
    //   marker ကို ဖတ်ပြီး BOMB_FUSE_MS အကြာမှာ `detonate()` ကို ခေါ်တယ် —
    //   ဒဏ်တွက်ချက်မှုက **ပေါက်ကွဲချိန်က နေရာတွေ** နဲ့ (ရှောင်လို့ရတယ်)။
    const bx = Number.isFinite(Number(msg.x)) ? Number(msg.x) : me.x;
    const bz = Number.isFinite(Number(msg.z)) ? Number(msg.z) : me.z;
    if (Math.hypot(bx - me.x, bz - me.z) > w.range) return out;
    out.push({
      all: true,
      msg: {
        type: "aThrown",
        fromX: round2(me.x),
        fromZ: round2(me.z),
        x: round2(bx),
        z: round2(bz),
        ms: BOMB_FUSE_MS,
      },
    });
    out.push({ fuse: { x: bx, z: bz, attackerId: me.id } });
    return out;
  }

  // ★★ Server-authoritative hit registration (Arena spec A4)。
  //   အရင်က client က `targetId`/`hitPart` ပို့ပြီး server က အကွာအဝေးပဲ
  //   စစ်တယ် — `hitPart:"head"` အမြဲပို့ရင် ခေါင်းထိချက် အမြဲရတယ်၊
  //   နောက်ကျောက လူကိုလည်း range အတွင်းဆို ပစ်လို့ရတယ်။ Aimbot ဆိုတာ
  //   message တစ်ကြောင်းပဲ။
  //
  //   အခုက client က **ကြည့်နေတဲ့ ဦးတည်ချက်** (`dx,dy,dz`) ပဲ ပို့တယ်။
  //   ဘယ်သူထိလဲ၊ ဘယ်အပိုင်းလဲ — server က ကိုယ့် position data နဲ့
  //   ray ပစ်ပြီး ဆုံးဖြတ်တယ်။ `targetId`/`hitPart` ပါလာလည်း **မဖတ်ဘူး**。
  const hit = combat.resolveShot(
    me,
    { x: msg.dx, y: msg.dy, z: msg.dz },
    match.players.values(),
    w.range,
  );
  if (!hit) return out;

  let dmg = computeDamage(me.weapon, hit.part, hit.dist);
  // 🏴‍☠️ NPC ရဲ့ ဒဏ်က လူ့ရဲ့ ၆၀% ပဲ — user feedback: NPC စွမ်းအားကြီးလွန်း။
  if (me.bot) dmg = Math.max(1, Math.round(dmg * 0.6));
  out.push(...applyDamage(match, me, hit.victim, dmg, me.weapon, hit.part, now));
  return out;
}

/// 💣 ဗုံး ပေါက်ကွဲမှု — fuse ပြည့်ချိန် transport က ခေါ်တယ်။ ဒဏ်ကို
/// **ပေါက်ကွဲချိန်က player နေရာတွေ** နဲ့ တွက်တယ် — ကြားထဲ ရှောင်ပြေးလို့ရ။
/// ပစ်သူ ထွက်သွားပြီးရင် မြင်ကွင်း (aBoom) ပဲ ပြပြီး ဒဏ်မရှိ — ကိုယ်စားလှယ်
/// မဲ့ kill credit က resolveKill ကို ချိုးမယ်။
function detonate(match, attackerId, bx, bz, now = Date.now()) {
  const w = WEAPONS.bomb;
  const out = [
    { all: true, msg: { type: "aBoom", x: round2(bx), z: round2(bz), radius: w.splash } },
  ];
  const me = match.players.get(attackerId);
  if (!me) return out;
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
      /// 🏴‍☠️ Client က ဓားပြသတ်တာကို "လူမှား ✗" လို့ မပြမိအောင်
      victimBot: !!victim.bot,
      killerBot: !!attacker.bot,
      killerKills: attacker.kills,
      killerScore: attacker.score,
    },
  });
  // 🔫 သေသူ့လက်နက် မြေပေါ်ကျတယ် — ကောက်ရင် ကျည်ရတယ်။ ဓားက drop မဖြစ်ဘူး
  // (ကျည်မရှိလို့ ကောက်စရာ မရှိဘူး)။
  out.push(...spawnDrop(match, victim, now));
  if (r.won) {
    out.push({
      all: true,
      msg: { type: "aWin", winnerId: attacker.id, winnerName: attacker.name, kills: attacker.kills },
    });
  }
  return out;
}

// ── 🔫 လက်နက် drop / ကောက်ယူမှု ─────────────────────────────────────────
/// ကောက်နိုင်တဲ့ အကွာအဝေး
const PICKUP_RANGE = 1.6;
/// မကောက်ဘဲ ထားရင် ပျောက်သွားချိန်
const DROP_TTL_MS = 30000;

/// သေသူ့နေရာမှာ သူ့လက်နက် ကျတယ် — ကျည် တစ်ဝက်မောင်းပါတယ်။
function spawnDrop(match, victim, now = Date.now()) {
  const w = WEAPONS[victim.weapon];
  if (!w || w.ammo === Infinity) return [];
  const id = ++match.dropSeq;
  const drop = {
    id,
    x: round2(victim.x),
    z: round2(victim.z),
    weapon: victim.weapon,
    ammo: Math.max(1, Math.ceil(w.ammo / 2)),
    expiresAt: now + DROP_TTL_MS,
  };
  match.drops.set(id, drop);
  return [
    { all: true, msg: { type: "aDrop", id, x: drop.x, z: drop.z, weapon: drop.weapon } },
  ];
}

/// ရွေ့တိုင်း စစ်တယ် — အနီးက drop ကို အလိုအလျောက် ကောက်တယ်။
/// ကျည်က မောင်းနှစ်မောင်းစာထက် မကျော်ဘူး (သိုမကုန်အောင်)။
function collectDrops(match, me, now = Date.now()) {
  const out = [];
  if (!me.alive) return out;
  for (const drop of match.drops.values()) {
    if (drop.expiresAt <= now) continue; // expireDrops က မကြာခင် ရှင်းလိမ့်မယ်
    if (Math.hypot(drop.x - me.x, drop.z - me.z) > PICKUP_RANGE) continue;
    match.drops.delete(drop.id);
    const mag = WEAPONS[drop.weapon]?.ammo ?? 0;
    const before = me.ammo[drop.weapon] ?? 0;
    me.ammo[drop.weapon] = Math.min(mag * 2, before + drop.ammo);
    out.push({ all: true, msg: { type: "aDropGone", id: drop.id } });
    out.push({
      to: me.id,
      msg: {
        type: "aPickup",
        weapon: drop.weapon,
        gained: me.ammo[drop.weapon] - before,
      },
    });
  }
  return out;
}

/// သက်တမ်းကုန်တဲ့ drop တွေ ရှင်းတယ် — transport ticker က ခေါ်တယ်။
function expireDrops(match, now = Date.now()) {
  const out = [];
  for (const drop of match.drops.values()) {
    if (drop.expiresAt > now) continue;
    match.drops.delete(drop.id);
    out.push({ all: true, msg: { type: "aDropGone", id: drop.id } });
  }
  return out;
}

module.exports = {
  ARENA,
  BOMB_FUSE_MS,
  BOT_HP,
  DROP_TTL_MS,
  PICKUP_RANGE,
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
  collectDrops,
  computeDamage,
  createMatch,
  detonate,
  expireDrops,
  freshAmmo,
  handleFire,
  makeBot,
  makePlayer,
  personalState,
  publicPlayer,
  relinkAfterRemoval,
  resetRound,
  resolveKill,
  respawnDue,
};
