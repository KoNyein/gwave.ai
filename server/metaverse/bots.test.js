"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const assassin = require("./assassin.js");
const bots = require("./bots.js");

/// 🏴‍☠️ ဓားပြ bot AI — socket မလိုဘဲ စည်းမျဉ်းတွေ စမ်းတယ်။
/// (assassin.test.js နဲ့ ပုံစံတူ — match object ကို တိုက်ရိုက် ကိုင်တယ်)

function matchWithHuman(id = "h1", name = "လူသား") {
  const match = assassin.createMatch();
  match.players.set(id, assassin.makePlayer(id, name, match.seq++));
  return match;
}

function firstBot(match) {
  return [...match.players.values()].find((p) => p.bot);
}

const msgsOf = (events) => events.map((e) => e.msg?.type).filter(Boolean);

test("ensureBots: လူရှိမှ ဓားပြ ၃ ယောက် ဝင်တယ်၊ ထပ်ခေါ်လည်း မထပ်ဘူး", () => {
  const empty = assassin.createMatch();
  assert.equal(bots.ensureBots(empty).length, 0);

  const match = matchWithHuman();
  const ev = bots.ensureBots(match);
  const botList = [...match.players.values()].filter((p) => p.bot);
  assert.equal(botList.length, bots.BOT_COUNT);
  assert.equal(ev.filter((e) => e.msg?.type === "aEnter").length, bots.BOT_COUNT);
  // Idempotent
  assert.equal(bots.ensureBots(match).length, 0);
  // publicPlayer မှာ bot flag ပါတယ် — client က ခွဲမြင်ဖို့
  assert.equal(assassin.publicPlayer(botList[0]).bot, true);
});

test("assignTargets: bot တွေ သံသရာထဲ မပါဘူး", () => {
  const match = matchWithHuman("h1");
  match.players.set("h2", assassin.makePlayer("h2", "လူ၂", match.seq++));
  bots.ensureBots(match);
  assassin.assignTargets(match);
  const h1 = match.players.get("h1");
  const h2 = match.players.get("h2");
  assert.equal(h1.targetId, "h2");
  assert.equal(h2.targetId, "h1");
  for (const b of [...match.players.values()].filter((p) => p.bot)) {
    assert.equal(b.targetId, null);
    assert.equal(b.hunterId, null);
  }
});

test("noteHit: bot ကို ပစ်ရင် ရန်ငြိုးထားပြီး လိုက်ပစ်တယ်", () => {
  const now = 1_000_000;
  const match = matchWithHuman();
  bots.ensureBots(match, now);
  const h = match.players.get("h1");
  const b = firstBot(match);
  // ဝေးဝေးမှာ ထား — mug-range ကာကွယ်
  h.x = 25;
  h.z = 0;
  b.x = -25;
  b.z = 0;

  bots.noteHit(match, "h1", b.id, now);
  assert.ok(b.grudge["h1"] > now);

  // Tick — bot က h1 ဆီ ချဉ်းကပ်ရမယ်
  const before = Math.hypot(h.x - b.x, h.z - b.z);
  bots.tick(match, now + 100);
  const after = Math.hypot(h.x - b.x, h.z - b.z);
  assert.ok(after < before, "bot must chase its grudge target");

  // ရန်ငြိုး သက်တမ်းကုန်ရင် မလိုက်တော့ဘူး
  const later = now + bots.GRUDGE_MS + 1000;
  bots.tick(match, later);
  assert.equal(b.grudge["h1"], undefined);
});

test("bot: ချိန်ပြီး fireMs/settle ပြည့်ရင် ပစ်တယ် (aShot ထွက်တယ်)", () => {
  const now = 2_000_000;
  const match = matchWithHuman();
  bots.ensureBots(match, now);
  const h = match.players.get("h1");
  const b = firstBot(match);
  h.x = 3;
  h.z = 0;
  b.x = 0;
  b.z = 0;
  bots.noteHit(match, "h1", b.id, now);

  bots.tick(match, now); // aimSince စမှတ်
  const ev = bots.tick(match, now + bots.AIM_SETTLE_MS + 200);
  assert.ok(msgsOf(ev).includes("aShot"), "bot should fire after settling");
});

test("bot သတ်ရင်: အမှတ်မထိ၊ လက်နက် drop ကျတယ်", () => {
  const match = matchWithHuman();
  match.players.set("h2", assassin.makePlayer("h2", "လူ၂", match.seq++));
  bots.ensureBots(match);
  assassin.assignTargets(match);
  const h = match.players.get("h1");
  const b = firstBot(match);
  b.weapon = "smg";

  const ev = assassin.applyDamage(match, h, b, 999, h.weapon, "body");
  const types = msgsOf(ev);
  assert.ok(types.includes("aKill"));
  assert.ok(types.includes("aDrop"), "bot death must drop its weapon");
  const kill = ev.find((e) => e.msg?.type === "aKill").msg;
  assert.equal(kill.victimBot, true);
  assert.equal(kill.correct, false);
  // Assassin အမှတ်စနစ် မထိရ
  assert.equal(h.score, 0);
  assert.equal(h.wrongKills, 0);
  assert.equal(h.kills, 0);
  // Drop ထဲမှာ bot ရဲ့ လက်နက်
  const drop = [...match.drops.values()][0];
  assert.equal(drop.weapon, "smg");
});

test("drops: ကောက်ရင် ကျည်တိုး + aPickup၊ TTL ကုန်ရင် ပျောက်တယ်", () => {
  const now = 3_000_000;
  const match = matchWithHuman();
  const h = match.players.get("h1");
  const victim = assassin.makePlayer("h2", "လူ၂", match.seq++);
  victim.weapon = "revolver";
  victim.x = 5;
  victim.z = 5;
  match.players.set("h2", victim);

  assassin.applyDamage(match, h, victim, 999, "pistol", "body", now);
  assert.equal(match.drops.size, 1);

  // ဝေးရင် မကောက်ဘူး
  h.x = 20;
  h.z = 20;
  assert.equal(assassin.collectDrops(match, h, now).length, 0);

  // အနားရောက်ရင် ကောက်တယ်
  h.x = 5;
  h.z = 5.5;
  const before = h.ammo.revolver;
  const ev = assassin.collectDrops(match, h, now);
  const types = msgsOf(ev);
  assert.ok(types.includes("aDropGone"));
  assert.ok(types.includes("aPickup"));
  assert.ok(h.ammo.revolver > before);
  assert.equal(match.drops.size, 0);

  // TTL — မကောက်ဘဲ ထားရင် expireDrops က ရှင်းတယ်
  const v2 = assassin.makePlayer("h3", "လူ၃", match.seq++);
  match.players.set("h3", v2);
  assassin.applyDamage(match, h, v2, 999, "pistol", "body", now);
  assert.equal(match.drops.size, 1);
  assert.equal(assassin.expireDrops(match, now + 1000).length, 0);
  const gone = assassin.expireDrops(match, now + assassin.DROP_TTL_MS + 1);
  assert.equal(msgsOf(gone)[0], "aDropGone");
  assert.equal(match.drops.size, 0);
});

test("befriend: wave နဲ့ မိတ်ဆွေဖြစ်၊ ရန်ငြိုးရှိရင် ငြင်းတယ်", () => {
  const now = 4_000_000;
  const match = matchWithHuman();
  bots.ensureBots(match, now);
  const h = match.players.get("h1");
  const b = firstBot(match);
  b.x = h.x + 2;
  b.z = h.z;

  // ရန်ငြိုးရှိရင် လက်မခံ — ★ ဒါပေမယ့် feedback တော့ ပြန်ရမယ် (တောင်းသူဆီသာ)
  b.grudge["h1"] = now + 10000;
  const rej = bots.befriend(match, "h1", now);
  assert.equal(rej.length, 1);
  assert.equal(rej[0].to, "h1");
  assert.equal(rej[0].msg.type, "aBotMood");
  assert.equal(rej[0].msg.mood, "none");
  assert.equal(rej[0].msg.reason, "grudge");

  delete b.grudge["h1"];
  const ev = bots.befriend(match, "h1", now);
  assert.equal(ev[0]?.msg?.type, "aBotMood");
  assert.equal(ev[0].msg.mood, "friend");
  assert.equal(b.friendOf, "h1");
});

test("befriend: ဝေးရင် mood:none + reason:far + အကွာအဝေး ပြန်တယ်", () => {
  const now = 4_100_000;
  const match = matchWithHuman();
  bots.ensureBots(match, now);
  const h = match.players.get("h1");
  // Bot အားလုံး ဝေးအောင် — h1 spawn (0,-22) ကနေ bot တွေက တခြား spawn တွေမှာ
  const ev = bots.befriend(match, "h1", now);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].to, "h1");
  assert.equal(ev[0].msg.mood, "none");
  assert.equal(ev[0].msg.reason, "far");
  assert.ok(ev[0].msg.dist > bots.FRIEND_RANGE);

  // ကပ်လိုက်ရင် အောင်တယ် — FRIEND_RANGE အတွင်း
  const b = firstBot(match);
  b.x = h.x + 3;
  b.z = h.z;
  const ok = bots.befriend(match, "h1", now);
  assert.equal(ok[0].msg.mood, "friend");
});

test("friend bot: ကိုယ့် friend အထိခံရရင် ပစ်သူကို ရန်ငြိုး၊ friend ကို ပစ်မိရင် မိတ်ဆွေပျက်", () => {
  const now = 5_000_000;
  const match = matchWithHuman("h1");
  match.players.set("h2", assassin.makePlayer("h2", "လူ၂", match.seq++));
  bots.ensureBots(match, now);
  const b = firstBot(match);
  b.friendOf = "h1";

  // h2 က friend (h1) ကို ပစ်တယ် → bot က h2 ကို ရန်ငြိုး
  bots.noteHit(match, "h2", "h1", now);
  assert.ok(b.grudge["h2"] > now);

  // h1 က ကိုယ့် friend bot ကို ပစ်မိရင် — မိတ်ဆွေပျက်ပြီး ရန်သူပြန်ဖြစ်
  bots.noteHit(match, "h1", b.id, now);
  assert.equal(b.friendOf, null);
  assert.ok(b.grudge["h1"] > now);
});

test("🐕 ခွေး: bite (npc weapon) နဲ့ ဝင်လာပြီး အနီးကပ်မှ ကိုက်တယ်", () => {
  const now = 7_000_000;
  const match = matchWithHuman();
  bots.ensureBots(match, now);
  const dogs = [...match.players.values()].filter((p) => p.dog);
  assert.equal(dogs.length, 2, "two wild dogs join");
  const d = dogs[0];
  assert.equal(d.weapon, "bite");
  assert.equal(assassin.WEAPONS.bite.npc, true, "bite must be npc-only");
  assert.equal(assassin.publicPlayer(d).dog, true);

  const h = match.players.get("h1");
  // ဝေးရင် မကိုက်နိုင် — ကပ်လာအောင် ပြေးတယ် (လူထက်မြန်)
  h.x = d.x + 10;
  h.z = d.z;
  bots.noteHit(match, "h1", d.id, now);
  const before = Math.hypot(h.x - d.x, h.z - d.z);
  bots.tick(match, now + 100);
  assert.ok(Math.hypot(h.x - d.x, h.z - d.z) < before, "dog chases");

  // ကိုက်နိုင်တဲ့အကွာ — settle ပြီးရင် aShot(bite) ထွက်တယ်
  h.x = d.x + 1.5;
  h.z = d.z;
  bots.tick(match, now + 200);
  const ev = bots.tick(match, now + 200 + bots.AIM_SETTLE_MS + 300);
  const shot = ev.find((e) => e.msg?.type === "aShot" && e.msg.id === d.id);
  assert.ok(shot, "dog should bite when close and settled");
  assert.equal(shot.msg.weapon, "bite");

  // ခွေးသေရင် drop မကျဘူး (bite က ammo Infinity)
  const dropsBefore = match.drops.size;
  assassin.applyDamage(match, h, d, 999, "pistol", "body", now);
  assert.equal(match.drops.size, dropsBefore, "dog death drops nothing");
});

test("NPC ငြိမ်းချမ်းရေး: အနားကပ်ရုံနဲ့ ရန်မဖြစ်ဘူး — ပစ်ခံရမှသာ", () => {
  const now = 6_000_000;
  const match = matchWithHuman();
  bots.ensureBots(match, now);
  const h = match.players.get("h1");
  const b = firstBot(match);
  // ကပ်လျက် ရပ်နေလည်း — tick ဘယ်နှခါပဲ ပြေးပြေး ရန်ငြိုး မထားရဘူး
  h.x = b.x + 1.5;
  h.z = b.z;
  bots.tick(match, now);
  bots.tick(match, now + 200);
  assert.equal(b.grudge["h1"], undefined, "NPCs must stay peaceful until attacked");
  // ပစ်လိုက်မှသာ ရန်ဖြစ်တယ်
  bots.noteHit(match, "h1", b.id, now + 300);
  assert.ok((b.grudge["h1"] ?? 0) > now, "grudge only after being shot");
});

test("Balance: bot ဒဏ် ၆၀% + HP 70 — လူထက် အားနည်းရမယ်", () => {
  const match = matchWithHuman();
  bots.ensureBots(match);
  const b = firstBot(match);
  assert.equal(b.hp, assassin.BOT_HP);
  assert.equal(assassin.BOT_HP < assassin.MAX_HP, true);
  // Bot ပစ်ချက်ရဲ့ ဒဏ်လျှော့ — handleFire ကနေ တိုက်ရိုက်စစ် (smg 17 → 10)
  const h = match.players.get("h1");
  b.weapon = "smg";
  b.x = 0;
  b.z = 0;
  b.ry = 0;
  h.x = 0;
  h.z = 4;
  const ev = assassin.handleFire(match, b, { dx: 0, dy: -0.15, dz: 1 }, 9_000_000);
  const hit = ev.find((e) => e.msg?.type === "aHit");
  assert.ok(hit, "point-blank straight shot should land");
  assert.ok(hit.msg.dmg <= Math.round(17 * 0.6) + 1, "bot damage must be scaled down");
});
