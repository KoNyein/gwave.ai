/// Arena map (spec A2.3) — acceptance criteria တစ်ခုချင်းစီကို data နဲ့ စစ်တယ်။
///
/// ★ ဒါတွေက "ရေးထားတဲ့အတိုင်း ဟုတ်လား" စစ်တာ မဟုတ်ဘူး — **ဂိမ်းဒီဇိုင်း
///   စည်းမျဉ်း** တွေကို စစ်တာ။ "ကွယ်လို့မရတဲ့ လွင်ပြင် မရှိရ" ဆိုတာ ဖတ်ရုံနဲ့
///   မသိနိုင်ဘူး — ကွက်ချင်း လိုက်တိုင်းမှ သိရတယ်။ Map ကို ပြင်တိုင်း
///   အဲဒီစည်းတွေ မကျိုးဘူးဆိုတာ ဒီ test တွေက အာမခံတယ်။

import test from "node:test";
import assert from "node:assert/strict";

import { ARENA, pickSpawns, zoneAt, type ArenaMap } from "./map.ts";

test("five zones, as designed", () => {
  assert.equal(ARENA.zones.length, 5);
  const ids = ARENA.zones.map((z) => z.id);
  assert.equal(new Set(ids).size, 5, "zone ids are unique");
});

test("every zone is inside the world", () => {
  for (const z of ARENA.zones) {
    const reach = Math.hypot(z.x, z.z) + z.r;
    assert.ok(reach <= ARENA.worldRadius, `${z.id} reaches ${reach.toFixed(1)}`);
  }
});

test("at least three routes, and no zone is a dead end", () => {
  assert.ok(ARENA.routes.length >= 3);
  const degree = new Map<string, number>();
  for (const r of ARENA.routes) {
    degree.set(r.from, (degree.get(r.from) ?? 0) + 1);
    degree.set(r.to, (degree.get(r.to) ?? 0) + 1);
  }
  for (const z of ARENA.zones) {
    // ★ လမ်းတစ်ကြောင်းတည်းရှိတဲ့ zone က ထောင်ချောက် — အဝကို တစ်ယောက်က
    //   စောင့်ရုံနဲ့ ပိတ်လို့ရတယ်။
    assert.ok((degree.get(z.id) ?? 0) >= 2, `${z.id} has fewer than two routes`);
  }
});

test("routes only connect zones that exist", () => {
  const ids = new Set(ARENA.zones.map((z) => z.id));
  for (const r of ARENA.routes) {
    assert.ok(ids.has(r.from), r.from);
    assert.ok(ids.has(r.to), r.to);
    assert.notEqual(r.from, r.to);
  }
});

test("every zone is reachable from every other", () => {
  // ★ Zone တစ်ခုက ကျွန်းဖြစ်နေရင် အဲဒီထဲ ဝင်သွားသူကို ဘယ်သူမှ မတွေ့ဘူး။
  const adj = new Map<string, string[]>();
  for (const z of ARENA.zones) adj.set(z.id, []);
  for (const r of ARENA.routes) {
    adj.get(r.from)!.push(r.to);
    adj.get(r.to)!.push(r.from);
  }
  const seen = new Set<string>([ARENA.zones[0]!.id]);
  const queue = [ARENA.zones[0]!.id];
  while (queue.length) {
    for (const next of adj.get(queue.shift()!)!) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  assert.equal(seen.size, ARENA.zones.length, "the zone graph is disconnected");
});

// ── ★ Spawn ─────────────────────────────────────────────────────────────

test("sixteen spawns", () => {
  assert.equal(ARENA.spawns.length, 16);
});

test("spawns are at least 8 units apart", () => {
  // ★ နီးကပ်နေရင် ပွဲစချင်း တွေ့ကုန်ပြီး ပထမပစ်သူပဲ နိုင်တယ်။
  for (let i = 0; i < ARENA.spawns.length; i++) {
    for (let j = i + 1; j < ARENA.spawns.length; j++) {
      const a = ARENA.spawns[i]!;
      const b = ARENA.spawns[j]!;
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      assert.ok(d >= 8, `spawns ${i} and ${j} are ${d.toFixed(1)} apart`);
    }
  }
});

test("spawns sit inside the world and name a real zone", () => {
  const ids = new Set(ARENA.zones.map((z) => z.id));
  for (const sp of ARENA.spawns) {
    assert.ok(Math.hypot(sp.x, sp.z) <= ARENA.worldRadius, `${sp.x},${sp.z} is outside`);
    assert.ok(ids.has(sp.zone), sp.zone);
  }
});

test("spawns are spread across zones, not stacked in one", () => {
  const perZone = new Map<string, number>();
  for (const sp of ARENA.spawns) perZone.set(sp.zone, (perZone.get(sp.zone) ?? 0) + 1);
  assert.equal(perZone.size, 5, "every zone hosts spawns");
  for (const [zone, n] of perZone) {
    assert.ok(n <= 5, `${zone} holds ${n} spawns — too concentrated`);
  }
});

test("pickSpawns is deterministic for a seed and never repeats a point", () => {
  const a = pickSpawns(ARENA, 8, 1234);
  const b = pickSpawns(ARENA, 8, 1234);
  assert.deepEqual(a, b, "the same seed gives the same layout");
  assert.equal(new Set(a.map((s) => `${s.x},${s.z}`)).size, 8, "no two players share a spawn");
});

test("different seeds give different layouts", () => {
  // ★ တူညီနေရင် ပထမ ၂ ယောက်က ပွဲတိုင်း ဘေးချင်းကပ် ဖြစ်နေမယ်။
  const a = pickSpawns(ARENA, 8, 1);
  const b = pickSpawns(ARENA, 8, 99);
  assert.notDeepEqual(a, b);
});

test("asking for more spawns than exist returns what there is", () => {
  assert.equal(pickSpawns(ARENA, 999, 7).length, ARENA.spawns.length);
});

// ── ★ ကွယ်စရာ ────────────────────────────────────────────────────────────

test("all three cover kinds are used", () => {
  const kinds = new Set(ARENA.covers.map((c) => c.kind));
  assert.deepEqual([...kinds].sort(), ["full", "half", "soft"]);
});

test("cover is denser where the design says it should be", () => {
  const density = (zoneId: string) => {
    const z = ARENA.zones.find((x) => x.id === zoneId)!;
    const n = ARENA.covers.filter((c) => Math.hypot(c.x - z.x, c.z - z.z) <= z.r).length;
    return n / (Math.PI * z.r * z.r);
  };
  // ဈေး (high) က မျှော်စင် (low) ထက် ကွယ်စရာ ပိုသိပ်ရမယ်
  assert.ok(density("market") > density("tower"), "market should be denser than tower");
  assert.ok(density("garden") > density("tower"), "garden should be denser than tower");
});

test("no open ground larger than 8 units anywhere a player can walk", () => {
  // ★ Spec A2.3 — "ကွယ်လို့မရတဲ့ လွင်ပြင်ကြီး မရှိ (၈ unit ကျော်
  //   ဘာမှမရှိတဲ့နေရာ)"。 ကွက်ချင်း စစ်တယ်: မြေပြင်ကို ၂ unit grid နဲ့
  //   ဖြတ်ပြီး၊ ကွက်တိုင်းက အနီးဆုံး ကွယ်စရာနဲ့ ၈ unit အတွင်း ရှိရမယ်။
  const STEP = 2;
  const LIMIT = 8;
  const bad: Array<[number, number, number]> = [];
  for (let x = -ARENA.worldRadius; x <= ARENA.worldRadius; x += STEP) {
    for (let z = -ARENA.worldRadius; z <= ARENA.worldRadius; z += STEP) {
      // ကစားကွင်းအတွင်းသာ — ပြင်ပက ဘယ်သူမှ မရောက်ဘူး
      if (Math.hypot(x, z) > ARENA.worldRadius) continue;
      let nearest = Infinity;
      for (const c of ARENA.covers) {
        const d = Math.hypot(x - c.x, z - c.z);
        if (d < nearest) nearest = d;
      }
      if (nearest > LIMIT) bad.push([x, z, nearest]);
    }
  }
  assert.equal(
    bad.length,
    0,
    `${bad.length} exposed spot(s), worst ${bad
      .slice(0, 3)
      .map(([x, z, d]) => `(${x},${z})=${d.toFixed(1)}`)
      .join(" ")}`,
  );
});

test("cover exists along every route, on both sides", () => {
  // ★ Zone ကြားက လမ်းမှာ ကွယ်စရာ မရှိရင် ဖြတ်ကူးသူက ပစ်မှတ်သက်သက် ဖြစ်တယ်။
  const byId = new Map(ARENA.zones.map((z) => [z.id, z]));
  for (const r of ARENA.routes) {
    const a = byId.get(r.from)!;
    const b = byId.get(r.to)!;
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    const near = ARENA.covers.filter((c) => Math.hypot(c.x - mx, c.z - mz) <= 6);
    assert.ok(near.length >= 2, `route ${r.from}->${r.to} midpoint has ${near.length} cover(s)`);
  }
});

test("covers have positive extents", () => {
  for (const c of ARENA.covers) {
    assert.ok(c.w > 0 && c.d > 0 && c.h > 0, `${c.kind} at ${c.x},${c.z}`);
  }
});

// ── ★ မျှတမှု — ရာသီဥတု/အချိန် ─────────────────────────────────────────

test("weather and time of day are pinned", () => {
  // ★ ပွဲအလယ်မှာ ည ဖြစ်သွားရင် ပုန်းရလွယ်သူတွေ အားသာသွားတယ်။
  assert.equal(ARENA.weather.fixed, "clear");
  assert.ok(ARENA.timeOfDay.fixed > 0.2 && ARENA.timeOfDay.fixed < 0.8, "daylight");
});

// ── zoneAt ──────────────────────────────────────────────────────────────

test("zoneAt names the zone you are standing in", () => {
  const plaza = ARENA.zones.find((z) => z.id === "plaza")!;
  assert.equal(zoneAt(ARENA, plaza.x, plaza.z)?.id, "plaza");
  const market = ARENA.zones.find((z) => z.id === "market")!;
  assert.equal(zoneAt(ARENA, market.x, market.z)?.id, "market");
});

test("zoneAt returns null out in the open", () => {
  assert.equal(zoneAt(ARENA, 39, 39), null);
});

test("overlapping zones resolve to the nearer centre", () => {
  // ★ Zone တွေ ထပ်နေတဲ့နေရာမှာ HUD က တစ်ခုတည်း ပြရမယ် — မဟုတ်ရင်
  //   လမ်းလျှောက်ရင်း အမည် ၂ ခုကြား တဝဲဝဲ ဖြစ်နေမယ်။
  const fake: ArenaMap = {
    ...ARENA,
    zones: [
      { id: "a", name: "A", x: 0, z: 0, r: 10, cover: "low" },
      { id: "b", name: "B", x: 5, z: 0, r: 10, cover: "low" },
    ],
  };
  assert.equal(zoneAt(fake, 1, 0)?.id, "a");
  assert.equal(zoneAt(fake, 4, 0)?.id, "b");
});
