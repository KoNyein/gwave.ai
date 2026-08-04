"use strict";

/// Assassin — စည်းမျဉ်းတွေကို socket မလိုဘဲ စမ်းတယ်။
///
/// ★ ဒီစည်းမျဉ်းတွေက ဂိမ်းရဲ့ ကစားနည်း တစ်ခုလုံးကို ဆုံးဖြတ်တယ်၊ ဒါပေမယ့်
///   ဖန်သားပြင်ပေါ်မှာ တစ်ချက်ကြည့်ရုံနဲ့ မမြင်ရဘူး — ပစ်မှတ်က လျှို့ဝှက်၊
///   ခိုးကစားမှုကာကွယ်မှုက မမြင်ရ။ ဒါကြောင့် ဒီမှာ ချည်ထားတယ်။

const test = require("node:test");
const assert = require("node:assert");

const A = require("../assassin.js");

/// ခန့်မှန်းလို့ရတဲ့ ရွေးချယ်မှု — Fisher-Yates ကို အမြဲ တစ်မျိုးတည်း ဖြစ်စေတယ်
const fixedRng = { randomInt: () => 0 };

function matchWith(n) {
  const m = A.createMatch();
  for (let i = 0; i < n; i++) {
    m.players.set(`p${i}`, A.makePlayer(`p${i}`, `P${i}`, i));
  }
  return m;
}

/// ★ ပစ်သူ့ မျက်လုံး (y+1.6) ကနေ ရန်သူရဲ့ ခန္ဓာအပိုင်းဆီ ချိန်တဲ့ ဦးတည်ချက်။
///   `part` = "body" (ရင်ဘတ် ~0.78) ဒါမှမဟုတ် "head" (~1.62)。 client က
///   ကင်မရာ ray direction ပို့တာနဲ့ တူအောင် — combat.js ရဲ့ EYE_Y=1.6။
function aimAt(shooter, victim, part = "body") {
  const ty = part === "head" ? 1.62 : 0.78;
  return {
    dx: victim.x - shooter.x,
    dy: ty - ((shooter.y ?? 0) + 1.6),
    dz: victim.z - shooter.z,
  };
}

// ── ပစ်မှတ် ခွဲဝေမှု ─────────────────────────────────────────────────────
test("★ ကစားသမားတိုင်း ပစ်မှတ်တစ်ခုစီ ရပြီး၊ တစ်ယောက်တည်းက လိုက်ရှာတယ်", () => {
  const m = matchWith(4);
  A.assignTargets(m, fixedRng);
  const targets = [...m.players.values()].map((p) => p.targetId);
  const hunters = [...m.players.values()].map((p) => p.hunterId);
  assert.equal(new Set(targets).size, 4, "ပစ်မှတ် ထပ်နေတယ်");
  assert.equal(new Set(hunters).size, 4, "လိုက်ရှာသူ ထပ်နေတယ်");
  for (const p of m.players.values()) {
    assert.notEqual(p.targetId, p.id, "ကိုယ့်ကိုယ်ကို ပစ်မှတ်ထားလို့ မရ");
  }
});

test("★ ပစ်မှတ်တွေက သံသရာ တစ်ခုတည်း ဖြစ်ရမယ် (အုပ်စု ကွဲမသွားရ)", () => {
  // ခွဲပြီး သံသရာ ၂ ခု ဖြစ်သွားရင် အုပ်စုတစ်ခုက တခြားအုပ်စုကို ဘယ်တော့မှ
  // မတွေ့တော့ဘဲ ပွဲက ရပ်သွားမယ်။
  const m = matchWith(5);
  A.assignTargets(m, fixedRng);
  const first = [...m.players.values()][0];
  const seen = new Set();
  let cur = first;
  for (let i = 0; i < 5; i++) {
    assert.ok(!seen.has(cur.id), "သံသရာက စောစောပိတ်သွားတယ်");
    seen.add(cur.id);
    cur = m.players.get(cur.targetId);
  }
  assert.equal(seen.size, 5, "လူတိုင်း သံသရာထဲ မပါဘူး");
  assert.equal(cur.id, first.id, "သံသရာက အစကို ပြန်မရောက်ဘူး");
});

test("တစ်ယောက်တည်း ဖြစ်နေရင် ပစ်မှတ် မရှိရ", () => {
  const m = matchWith(1);
  A.assignTargets(m, fixedRng);
  assert.equal([...m.players.values()][0].targetId, null);
});

test("★ တစ်ယောက် ထွက်သွားရင် သံသရာ ပြန်ချိတ်တယ် (A→B→C ⇒ A→C)", () => {
  const m = matchWith(3);
  const [a, b, c] = [...m.players.values()];
  a.targetId = b.id; b.hunterId = a.id;
  b.targetId = c.id; c.hunterId = b.id;
  c.targetId = a.id; a.hunterId = c.id;

  A.relinkAfterRemoval(m, b);
  assert.equal(a.targetId, c.id, "A က C ကို မဆက်ဘူး");
  assert.equal(c.hunterId, a.id);
  assert.equal(b.targetId, null);
  assert.equal(b.hunterId, null);
});

// ── လျှို့ဝှက်ချက် ────────────────────────────────────────────────────────
test("★★ client ဆီ ပို့တဲ့ ပုံစံမှာ hunterId နဲ့ တခြားသူရဲ့ targetId မပါရ", () => {
  // ★ ဒါက ဂိမ်းရဲ့ အနှစ်သာရ — ဘယ်သူက ကိုယ့်ကို လိုက်နေမှန်း မသိရတာ။
  //   ပါသွားရင် network tab တစ်ချက် ကြည့်ရုံနဲ့ ဂိမ်းပြီးပြီ။
  const m = matchWith(3);
  A.assignTargets(m, fixedRng);
  const me = [...m.players.values()][0];

  const pub = JSON.stringify(A.publicPlayer(me));
  assert.ok(!pub.includes("hunterId"), "publicPlayer မှာ hunterId ပါနေတယ်");
  assert.ok(!pub.includes("targetId"), "publicPlayer မှာ targetId ပါနေတယ်");

  const mine = JSON.stringify(A.personalState(m, me));
  assert.ok(!mine.includes("hunterId"), "personalState မှာ hunterId ပါနေတယ်");
  // ကိုယ့်ပစ်မှတ်ကိုတော့ ပြရမယ်
  assert.ok(A.personalState(m, me).target, "ကိုယ့်ပစ်မှတ် မပြဘူး");
});

// ── ဆုလာဘ်က အလှသာ ───────────────────────────────────────────────────────
test("★★ skin ဘယ်ဟာမှ ကာကွယ်မှု မပေးရ (cosmetic သာ)", () => {
  // ★ မူရင်း prototype မှာ ပိုက်ဆံပေးရတဲ့ skin တွေက armor ၄၂% / helmet ၄၅%
  //   ပေးထားပြီး "⚠️ pay-to-win" လို့ ကိုယ်တိုင် မှတ်ထားတယ်။ Gwave မှာ
  //   ဆုလာဘ်တွေ cosmetic သာ ဖြစ်ရမယ်။
  for (const [id, s] of Object.entries(A.SKINS)) {
    assert.equal(s.armor, undefined, `${id} မှာ armor ကျန်နေတယ်`);
    assert.equal(s.helmet, undefined, `${id} မှာ helmet ကျန်နေတယ်`);
    assert.ok(typeof s.color === "number", `${id} မှာ အရောင် မရှိဘူး`);
  }
});

test("★ ထိခိုက်မှုက skin အပေါ် လုံးဝ မမူတည်ရ", () => {
  // computeDamage က skin ကို လက်ခံတောင် မခံတော့ဘူး — signature ကိုယ်တိုင်က
  // အာမခံချက်။ ခေါင်းထိမှုက ပိုနာရမယ်၊ အဝေးကနေ ပစ်ရင် လျော့ရမယ်။
  const near = A.computeDamage("pistol", "body", 1);
  const far = A.computeDamage("pistol", "body", 40);
  const head = A.computeDamage("pistol", "head", 1);
  assert.ok(head > near, "ခေါင်းထိမှု မပိုနာဘူး");
  assert.ok(far < near, "အဝေးကနေ ပစ်တာ မလျော့ဘူး");
  assert.equal(A.computeDamage("pistol", "body", 1), near, "တူညီတဲ့ input က တူညီတဲ့ output မဟုတ်ဘူး");
});

// ── ခိုးကစားမှု ကာကွယ်ခြင်း ──────────────────────────────────────────────
test("★★ ကွင်းတစ်ဖက်ကနေ ခုန်ရောက်ပြီး ဓားနဲ့ သတ်လို့ မရရ", () => {
  // ★ ဒါက အရေးအကြီးဆုံး ကာကွယ်ချက်။ ပစ်ခတ်မှုမှာ အကွာအဝေး စစ်ပေမယ့်
  //   နေရာကို client က ပြောတာမို့ — ရွေ့လျားမှု မစစ်ရင် ပစ်မှတ်ဘေး
  //   ခုန်ရောက်ပြီး ထိုးလို့ရသွားမယ်။ ဓားရဲ့ range က ၂.၆ မီတာပဲ။
  const m = matchWith(2);
  const [me, victim] = [...m.players.values()];
  me.weapon = "knife";
  me.x = 0; me.z = 0;
  victim.x = 25; victim.z = 0;
  me.lastMoveAt = 1000;

  // "ငါ ပစ်မှတ်ဘေးမှာ ရှိတယ်" — ၅၀ ms အတွင်း ၂၅ မီတာ။
  A.applyMove(m, me, { x: 25, z: 0, y: 0, ry: 0 }, 1050);
  assert.ok(Math.hypot(me.x - 25, me.z) > 2.6, `ခုန်ရောက်သွားတယ် — x=${me.x}`);

  // ★ ရန်သူဆီ တည့်တည့် ချိန်ပေမယ့် ဓားရဲ့ range (၂.၆) ကို ကျော်လို့
  //   server က မထိဘူး — ခုန်ရောက်တာ အလကား။
  const dir = aimAt(me, victim);
  const events = A.handleFire(m, me, { dx: dir.dx, dy: dir.dy, dz: dir.dz }, 2000);
  const hit = events.find((e) => e.msg?.type === "aHit");
  assert.equal(hit, undefined, "အဝေးကနေ ဓားနဲ့ ထိသွားတယ်");
});

test("ပုံမှန် ရွေ့လျားမှုကို မတားရ", () => {
  const m = matchWith(1);
  const [me] = [...m.players.values()];
  me.x = 0; me.z = 0;
  me.lastMoveAt = 1000;
  A.applyMove(m, me, { x: 0, z: 4, y: 0, ry: 0 }, 1500); // ၀.၅ စက္ကန့်မှာ ၄ မီတာ
  assert.ok(Math.abs(me.z - 4) < 0.01, `ပုံမှန်ရွေ့လျားမှု တားခံရတယ် — z=${me.z}`);
});

test("★ ကွင်းအပြင် ထွက်လို့ မရရ", () => {
  const m = matchWith(1);
  const [me] = [...m.players.values()];
  for (let i = 0; i < 40; i++) {
    A.applyMove(m, me, { x: 1000, z: 1000, y: 0, ry: 0 }, 1000 + i * 1000);
  }
  assert.ok(Math.hypot(me.x, me.z) <= A.ARENA + 0.01, "ကွင်းအပြင် ရောက်သွားတယ်");
});

test("★ ပစ်နှုန်း ကန့်သတ်ချက် — ခလုတ်ကို အဆက်မပြတ် နှိပ်လို့ မရရ", () => {
  const m = matchWith(2);
  const [me, victim] = [...m.players.values()];
  me.x = 0; me.z = 0; victim.x = 2; victim.z = 0;
  const dir = aimAt(me, victim);
  const first = A.handleFire(m, me, { dx: dir.dx, dy: dir.dy, dz: dir.dz }, 1000);
  assert.ok(first.some((e) => e.msg?.type === "aShot"), "ပထမတစ်ချက် မထွက်ဘူး");
  const second = A.handleFire(m, me, { dx: dir.dx, dy: dir.dy, dz: dir.dz }, 1050);
  assert.equal(second.length, 0, "ပစ်နှုန်း ကန့်သတ်ချက် အလုပ်မလုပ်ဘူး");
});

test("★ ကျည်ကုန်ရင် မထွက်ရ", () => {
  const m = matchWith(2);
  const [me, victim] = [...m.players.values()];
  me.x = 0; me.z = 0; victim.x = 2; victim.z = 0;
  me.ammo.pistol = 0;
  const dir = aimAt(me, victim);
  const out = A.handleFire(m, me, { dx: dir.dx, dy: dir.dy, dz: dir.dz }, 1000);
  assert.equal(out.length, 1);
  assert.equal(out[0].msg.type, "aNoAmmo");
});

// ── ★★ Server-authoritative hit registration (Arena spec A4) ──────────────

test("★★ ရန်သူကို တည့်တည့်ချိန်ရင် server က ထိချက် တွက်ပေးတယ်", () => {
  const m = matchWith(2);
  const [me, victim] = [...m.players.values()];
  me.x = 0; me.z = 0; victim.x = 0; victim.z = 5;
  const dir = aimAt(me, victim, "body");
  const out = A.handleFire(m, me, { dx: dir.dx, dy: dir.dy, dz: dir.dz }, 1000);
  assert.ok(out.some((e) => e.msg?.type === "aShot"), "ပစ်သံ ထွက်ရမယ်");
  assert.ok(out.some((e) => e.msg?.type === "aHit"), "ထိချက် ဖြစ်ရမယ်");
});

test("★★ client က 'ခေါင်းထိတယ်' လို့ လိမ်လို့ မရ — server က ကိုယ်တိုင် တွက်တယ်", () => {
  // အရင် cheat — targetId + hitPart:'head' ပို့ရုံ။ အခု အဲဒီ field တွေ
  // ပါလာလည်း server က လုံးဝ မဖတ်ဘူး၊ direction ကိုပဲ ကြည့်တယ်။
  const m = matchWith(2);
  const [me, victim] = [...m.players.values()];
  me.x = 0; me.z = 0; victim.x = 0; victim.z = 5;
  // ရင်ဘတ်ကို ချိန်ပေမယ့် "head" လို့ လိမ်ပို့တယ်
  const dir = aimAt(me, victim, "body");
  const out = A.handleFire(
    m,
    me,
    { dx: dir.dx, dy: dir.dy, dz: dir.dz, targetId: victim.id, hitPart: "head" },
    1000,
  );
  // ★ ရင်ဘတ်ချိန်တာမို့ body damage ပဲ ရရမယ် — head mult မရ။
  //   Pistol body = 34, head = 68။ HP 100 ကနေ 66 ကျရင် body ဖြစ်တယ်။
  assert.equal(victim.hp, 100 - 34, "ရင်ဘတ်ချိန်တာကို ခေါင်းအဖြစ် တွက်လို့ မရ");
});

test("★★ ရန်သူကို ကျော်ကြည့်ရင် လွဲတယ် — targetId ပါလာလည်း အသုံးမဝင်", () => {
  const m = matchWith(2);
  const [me, victim] = [...m.players.values()];
  me.x = 0; me.z = 0; victim.x = 0; victim.z = 5;
  // ရန်သူက +z မှာ ဒါပေမယ့် −z ကို ကြည့်ပြီး targetId လိမ်ပို့တယ်
  const out = A.handleFire(
    m,
    me,
    { dx: 0, dy: 0, dz: -1, targetId: victim.id, hitPart: "body" },
    1000,
  );
  assert.equal(victim.hp, 100, "မချိန်ဘဲ targetId နဲ့ ထိလို့ မရရ");
  assert.ok(!out.some((e) => e.msg?.type === "aHit"), "ထိချက် မဖြစ်ရ");
});

// ── အမှတ်ပေးစနစ် ─────────────────────────────────────────────────────────
test("★ မှန်တဲ့ပစ်မှတ် ရရင် +၁၊ လူမှားရင် −၁", () => {
  const m = matchWith(3);
  const [a, b, c] = [...m.players.values()];
  a.targetId = b.id; b.hunterId = a.id;

  const right = A.resolveKill(m, a, b, 1000);
  assert.equal(right.correct, true);
  assert.equal(a.kills, 1);
  assert.equal(a.score, 1);

  const wrong = A.resolveKill(m, a, c, 1000);
  assert.equal(wrong.correct, false);
  assert.equal(a.kills, 1, "လူမှားသတ်တာ kills မတိုးရ");
  assert.equal(a.wrongKills, 1);
  assert.equal(a.score, 0, "လူမှားသတ်ရင် အမှတ် မလျော့ဘူး");
});

test("★ လူမှားသတ်တာနဲ့ ဘယ်တော့မှ မနိုင်ရ", () => {
  const m = matchWith(2);
  const [a, b] = [...m.players.values()];
  a.kills = A.KILLS_TO_WIN - 1;
  a.targetId = null; // b က ပစ်မှတ် မဟုတ်ဘူး
  const r = A.resolveKill(m, a, b, 1000);
  assert.equal(r.won, false, "လူမှားသတ်ပြီး နိုင်သွားတယ်");
});

test("မှန်တဲ့ပစ်မှတ်နဲ့ အရေအတွက် ပြည့်ရင် နိုင်တယ်", () => {
  const m = matchWith(2);
  const [a, b] = [...m.players.values()];
  a.kills = A.KILLS_TO_WIN - 1;
  a.targetId = b.id;
  const r = A.resolveKill(m, a, b, 1000);
  assert.equal(r.won, true);
});

// ── ပြန်ရှင်ခြင်း ────────────────────────────────────────────────────────
test("ပြန်ရှင်ချိန် မရောက်သေးရင် မရှင်ရ", () => {
  const m = matchWith(1);
  const [p] = [...m.players.values()];
  p.alive = false;
  p.respawnAt = 5000;
  assert.equal(A.respawnDue(m, 4000, fixedRng).length, 0);
  assert.equal(A.respawnDue(m, 5000, fixedRng).length, 1);
  assert.equal(p.hp, A.MAX_HP);
  assert.equal(p.alive, true);
});

test("★ ပွဲပြန်စရင် အမှတ်တွေ သုညပြန်ဖြစ်ပြီး ပစ်မှတ် ပြန်ခွဲရမယ်", () => {
  const m = matchWith(3);
  const [a] = [...m.players.values()];
  a.kills = 2;
  a.score = 2;
  a.alive = false;
  A.resetRound(m, fixedRng);
  assert.equal(a.kills, 0);
  assert.equal(a.score, 0);
  assert.equal(a.alive, true);
  assert.ok(a.targetId, "ပွဲပြန်စပြီးမှ ပစ်မှတ် မရှိဘူး");
});

// ── လက်နက်များ ───────────────────────────────────────────────────────────
test("★ လက်နက်တိုင်းအတွက် ကျည် ရှိရမယ်", () => {
  // ★ freshAmmo() က WEAPONS ကနေ တွက်တယ် — အရင်က လက်နက် ၄ ခုကို လက်နဲ့
  //   စာရင်းရေးထားလို့ အသစ်ထည့်ရင် ကျည် `undefined` ဖြစ်ပြီး
  //   `undefined <= 0` က false မို့ အကန့်အသတ်မဲ့ ပစ်လို့ရသွားမယ်။
  const p = A.makePlayer("x", "X", 0);
  for (const id of Object.keys(A.WEAPONS)) {
    assert.notEqual(p.ammo[id], undefined, `${id} မှာ ကျည် မရှိဘူး`);
  }
});

test("★ လက်နက်တိုင်းမှာ သီးသန့် အသုံးဝင်ချက် ရှိရမယ်", () => {
  // အားလုံးထက် သာတဲ့ လက်နက် တစ်ခု ရှိသွားရင် ကျန်တာတွေ ရွေးစရာ မဟုတ်တော့ဘူး။
  const ids = Object.keys(A.WEAPONS).filter((k) => k !== "knife");
  for (const a of ids) {
    const wa = A.WEAPONS[a];
    const dominated = ids.some((b) => {
      if (a === b) return false;
      const wb = A.WEAPONS[b];
      return (
        wb.dmg >= wa.dmg &&
        wb.range >= wa.range &&
        wb.fireMs <= wa.fireMs &&
        wb.ammo >= wa.ammo &&
        (wb.dmg > wa.dmg || wb.range > wa.range || wb.fireMs < wa.fireMs)
      );
    });
    assert.equal(dominated, false, `${a} က တခြားလက်နက်တစ်ခုအောက် လုံးဝ ရှုံးနေတယ်`);
  }
});

test("★ သေနတ်ကြီးက အဝေးကနေ မထိရ", () => {
  const m = matchWith(2);
  const [me, victim] = [...m.players.values()];
  me.weapon = "shotgun";
  me.x = 0; me.z = 0;
  victim.x = 20; victim.z = 0; // range 9 ထက် ဝေးတယ်
  const out = A.handleFire(m, me, { targetId: victim.id, hitPart: "body" }, 1000);
  assert.equal(out.find((e) => e.msg?.type === "aHit"), undefined);
});

test("★ SMG က မြန်ပေမယ့် တစ်ချက်ချင်း အားနည်းရမယ်", () => {
  const smg = A.computeDamage("smg", "body", 1);
  const pistol = A.computeDamage("pistol", "body", 1);
  assert.ok(smg < pistol, "SMG က ပစ္စတိုထက် အားကြီးနေတယ်");
  assert.ok(A.WEAPONS.smg.fireMs < A.WEAPONS.pistol.fireMs, "SMG က မမြန်ဘူး");
});

test("★ လက်နက်တိုင်းရဲ့ ကျည်က client ဆီ ရောက်ရမယ်", () => {
  // ★ serializeAmmo လည်း လက်နဲ့ စာရင်းရေးထားခဲ့တယ် — အသစ်ထည့်ရင် သူ့ကျည်
  //   HUD မှာ ဗလာ ပြနေမယ် (ကစားသမားက ဘယ်လောက်ကျန်လဲ မသိရဘူး)。
  const m = matchWith(1);
  const [me] = [...m.players.values()];
  const sent = A.personalState(m, me).ammo;
  for (const id of Object.keys(A.WEAPONS)) {
    assert.notEqual(sent[id], undefined, `${id} ရဲ့ ကျည် client ဆီ မရောက်ဘူး`);
  }
  assert.equal(sent.knife, -1, "အကန့်အသတ်မဲ့ ကျည်ကို −၁ နဲ့ ပြရမယ်");
});
