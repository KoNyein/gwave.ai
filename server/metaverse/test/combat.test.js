"use strict";

/// Server-side hit registration (Arena spec A4) ရဲ့ စစ်ဆေးချက်များ။
///
/// ★ ဒါက ဂိမ်းရဲ့ အရေးအကြီးဆုံး လုံခြုံရေးအလွှာ — client က "ငါ ခေါင်းထိတယ်"
///   ပြောရင် server က မယုံဘဲ ကိုယ်တိုင် တွက်ရမယ်။ ဒါကြောင့် test တွေက
///   အဓိကအားဖြင့် **cheat ကို ဖမ်းလား** စစ်တာ ဖြစ်တယ်။

const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveShot, rayPlayer, EYE_Y, HITBOX } = require("../combat");

/// ပစ်သူ — origin မှာ ရပ်ပြီး +z ကို မျက်နှာမူ
function shooter(over = {}) {
  return { id: "me", x: 0, y: 0, z: 0, ry: 0, alive: true, ...over };
}
/// ပစ်မှတ် — (x,z) မှာ ရပ်နေတယ်
function target(id, x, z, over = {}) {
  return { id, x, y: 0, z, alive: true, ...over };
}

/// +z ကို တည့်တည့် ကြည့်ခြင်း (ကစားသမား ry=0 ရဲ့ ရှေ့)
const FORWARD = { x: 0, y: 0, z: 1 };

test("a shot straight ahead at chest height hits the body", () => {
  const me = shooter();
  const you = target("you", 0, 5);
  // ရင်ဘတ်အမြင့်ကို ချိန် — eye (1.6) ကနေ body ဗဟို (~0.78) ဆီ အနည်းငယ် အောက်
  const dir = { x: 0, y: (0.78 - EYE_Y) / 5, z: 1 };
  const hit = resolveShot(me, dir, [me, you], 45);
  assert.ok(hit, "should hit");
  assert.equal(hit.victim.id, "you");
  assert.equal(hit.part, "body");
});

test("aiming at the head returns a head hit", () => {
  const me = shooter();
  const you = target("you", 0, 5);
  const dir = { x: 0, y: (HITBOX.head.c[1] - EYE_Y) / 5, z: 1 };
  const hit = resolveShot(me, dir, [me, you], 45);
  assert.ok(hit);
  assert.equal(hit.part, "head");
});

test("looking away from everyone misses", () => {
  const me = shooter();
  const you = target("you", 0, 5);
  // +z မှာ ရန်သူ ရှိပေမယ့် −z ကို ကြည့်တယ်
  const hit = resolveShot(me, { x: 0, y: 0, z: -1 }, [me, you], 45);
  assert.equal(hit, null);
});

test("a target beyond weapon range is not hit", () => {
  const me = shooter();
  const you = target("you", 0, 40);
  // ranges: 40 unit ဝေးတဲ့သူကို range 30 လက်နက်နဲ့ မထိရ
  assert.equal(resolveShot(me, FORWARD, [me, you], 30), null);
  // range 45 ဆိုရင် ထိတယ်
  assert.ok(resolveShot(me, { x: 0, y: (0.78 - EYE_Y) / 40, z: 1 }, [me, you], 45));
});

// ── ★ Cheat တွေ ဖမ်းမိလား ────────────────────────────────────────────────

test("the client cannot claim a head hit it did not aim at", () => {
  // ★ အရင်က cheat — `hitPart:"head"` ပို့ရုံ။ အခု client က ဦးတည်ချက်ပဲ
  //   ပို့လို့ ရင်ဘတ်ကို ချိန်ရင် server က body လို့ပဲ တွက်တယ်၊ head မဟုတ်ဘူး။
  const me = shooter();
  const you = target("you", 0, 5);
  const dir = { x: 0, y: (0.78 - EYE_Y) / 5, z: 1 }; // ရင်ဘတ်ကို ချိန်
  const hit = resolveShot(me, dir, [me, you], 45);
  assert.equal(hit.part, "body", "aiming at the chest can never be scored as a headshot");
});

test("you cannot shoot someone standing behind you", () => {
  // ★ Wallhack/ESP — ကိုယ့်နောက်က ရန်သူကို range အတွင်းဆို ပစ်လို့ရ
  //   အောင် အရင် bug က ခွင့်ပြုတယ်။ အခု ray က ကြည့်တဲ့ဘက်ကိုပဲ သွားတယ်။
  const me = shooter();
  const behind = target("behind", 0, -3); // range အတွင်း ဒါပေမယ့် နောက်မှာ
  const hit = resolveShot(me, FORWARD, [me, behind], 45);
  assert.equal(hit, null);
});

test("a dead target cannot be hit", () => {
  const me = shooter();
  const you = target("you", 0, 5, { alive: false });
  assert.equal(resolveShot(me, FORWARD, [me, you], 45), null);
});

test("you cannot shoot yourself", () => {
  const me = shooter();
  assert.equal(resolveShot(me, FORWARD, [me], 45), null);
});

test("a zero-length direction is rejected", () => {
  // ★ Client bug ဒါမှမဟုတ် တမင် — (0,0,0) ဆိုရင် ray direction မရှိဘူး။
  const me = shooter();
  const you = target("you", 0, 5);
  assert.equal(resolveShot(me, { x: 0, y: 0, z: 0 }, [me, you], 45), null);
});

test("a non-finite direction is rejected", () => {
  const me = shooter();
  const you = target("you", 0, 5);
  for (const bad of [
    { x: NaN, y: 0, z: 1 },
    { x: 0, y: Infinity, z: 1 },
    { x: "1", y: 0, z: 1 },
    null,
    undefined,
  ]) {
    assert.equal(resolveShot(me, bad, [me, you], 45), null, JSON.stringify(bad));
  }
});

// ── အနီးဆုံး ပစ်မှတ် ─────────────────────────────────────────────────────

test("the nearer of two aligned targets is hit", () => {
  // ★ ကျည်က ပထမတွေ့တဲ့သူကို ထိရမယ် — နောက်ကလူကို ဖောက်ပြီး မထိရ။
  const me = shooter();
  const near = target("near", 0, 4);
  const far = target("far", 0, 8);
  const dir = { x: 0, y: (0.78 - EYE_Y) / 4, z: 1 };
  const hit = resolveShot(me, dir, [me, near, far], 45);
  assert.equal(hit.victim.id, "near");
});

test("direction is normalised, so magnitude does not matter", () => {
  const me = shooter();
  const you = target("you", 0, 5);
  const small = resolveShot(me, { x: 0, y: (0.78 - EYE_Y) / 5, z: 1 }, [me, you], 45);
  const big = resolveShot(me, { x: 0, y: ((0.78 - EYE_Y) / 5) * 100, z: 100 }, [me, you], 45);
  assert.ok(small && big);
  assert.equal(small.part, big.part);
});

// ── ★ Origin spoofing ─────────────────────────────────────────────────

test("the ray always starts from the server's shooter position", () => {
  // ★ Client က origin ပို့လို့ မရဘူး — resolveShot က shooter object ကနေပဲ
  //   ယူတယ်။ ပစ်သူကို (0,0) မှာ ထားပြီး ရန်သူကို (20,0) မှာ ထားတယ်။
  //   +x ကို ကြည့်မှ ထိရမယ် — client က origin လိမ်လို့ မရဘူး၊ direction ပဲ
  //   ပေးလို့ရတယ်။
  const me = shooter();
  const you = target("you", 20, 0);
  const miss = resolveShot(me, { x: 0, y: 0, z: 1 }, [me, you], 45); // +z ကြည့်
  assert.equal(miss, null, "aiming +z misses a target on +x");
  const hitDir = { x: 1, y: (0.78 - EYE_Y) / 20, z: 0 };
  assert.ok(resolveShot(me, hitDir, [me, you], 45), "aiming +x hits");
});

test("a shot near a rotated shooter still resolves from their eye", () => {
  // ry ဘယ်လောက်ပဲ ဖြစ်ဖြစ် origin က (x, y+EYE_Y, z) — ry က ray မှာ မပါဘူး
  // (client က ရွှေ့ပြီးသား direction ပေးတယ်)。
  const me = shooter({ x: 5, z: 5, ry: 1.2 });
  const you = target("you", 5, 10);
  const dir = { x: 0, y: (0.78 - EYE_Y) / 5, z: 1 };
  const hit = resolveShot(me, dir, [me, you], 45);
  assert.ok(hit);
  assert.equal(hit.victim.id, "you");
});

// ── rayPlayer တိုက်ရိုက် ─────────────────────────────────────────────────

test("aiming low still hits the body (no separate legs mesh, per the model)", () => {
  // ★ Client toon model မှာ ခြေထောက် hit mesh မရှိဘူး — body capsule ရဲ့
  //   အောက်ခြေ hemisphere က မြေအထိ လွှမ်းတယ်။ ဒါကြောင့် အောက်ချိန်ပစ်ရင်
  //   body ပဲ ထိတယ်၊ ကစားသမား မြင်တဲ့အတိုင်း။
  const you = target("you", 0, 5);
  const dir = { x: 0, y: (0.2 - EYE_Y) / 5, z: 1 };
  const len = Math.hypot(dir.x, dir.y, dir.z);
  const hit = rayPlayer(0, EYE_Y, 0, dir.x / len, dir.y / len, dir.z / len, you, 45);
  assert.ok(hit);
  assert.equal(hit.part, "body");
});
