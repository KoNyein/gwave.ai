"use strict";

/// Server-side hit registration (Arena spec A4)。
///
/// ★ ဖြေရှင်းတဲ့ ပြဿနာ — အရင်က client က `targetId` နဲ့ `hitPart` ကို
///   ပို့ပြီး server က အကွာအဝေးပဲ စစ်တယ်။ ဆိုလိုတာက —
///   · နံရံနောက်က မမြင်ရတဲ့သူကို range အတွင်းဆို ပစ်လို့ရတယ်
///   · `hitPart:"head"` လို့ အမြဲပို့ရင် ခေါင်းထိချက် အမြဲရတယ်
///   · Aimbot ဆိုတာ WebSocket message တစ်ကြောင်း ပို့ရုံပဲ
///
/// ★ အခုက client က **ကြည့်နေတဲ့ ဦးတည်ချက်ပဲ** ပို့တယ်။ Ray ရဲ့ အစမှတ်ကို
///   client ဆီက **လုံးဝ မယူဘူး** — server က သိမ်းထားတဲ့ shooter နေရာ +
///   မျက်လုံးအမြင့်ကနေ ပစ်တယ်။ ဒါက origin spoofing ကို အမြစ်ကနေ ဖြတ်တယ်။
///   ဘယ်သူ ထိလဲ၊ ခေါင်းလား ကိုယ်လား ခြေထောက်လား — အားလုံး ဒီမှာ တွက်တယ်။
///
/// ★ ဒီ file မှာ socket/match ဘာမှ မသိဘူး — geometry သက်သက်။ Test က
///   browser မလိုဘဲ ထောင်ချီ ပစ်ကြည့်လို့ရတယ်။

/// Hitbox — player base (ခြေဖဝါး) ကနေ တိုင်းတယ်။
///
/// ★★ တန်ဖိုးတွေက **client ရဲ့ toon model** (`toon.ts` ရဲ့ headHit/bodyHit)
///   နဲ့ တစ်ထပ်တည်း ဖြစ်ရမယ် — spec A4.2 ရဲ့ ကိန်းတွေ မဟုတ်ဘူး။
///   ကစားသမားက မြင်နေတဲ့ ခေါင်းကို ချိန်ပစ်တာမို့ server hitbox က
///   တခြားနေရာမှာ ရှိရင် "ချိန်မိပြီးသားကို လွဲတယ်" ဆိုတဲ့ အဆိုးဆုံး
///   ခံစားချက် ဖြစ်တယ်။
///   toon.ts: headHit sphere r=0.28 @ y=1.62 ·
///   bodyHit capsule r=0.34, length 0.9 @ y=0.78 (segment 0.33..1.23)。
///   ★ ခြေထောက် hitbox သီးသန့် မထားဘူး — မြင်ကွင်းမှာ ခြေထောက် hit mesh
///     မရှိသလို၊ body capsule ရဲ့ အောက်ခြေ hemisphere က မြေအထိ လွှမ်းလို့
///     အောက်ချိန်ပစ်ရင် body ပဲ ထိတယ် (client မြင်တဲ့အတိုင်း)。
const HITBOX = Object.freeze({
  head: { c: [0, 1.62, 0], r: 0.28 },
  body: { a: [0, 0.33, 0], b: [0, 1.23, 0], r: 0.34 },
});

/// ပစ်သူ့ မျက်လုံးအမြင့် — client ကင်မရာနဲ့ ကိုက်ရမယ်။ မကိုက်ရင်
/// ကစားသမား ချိန်တဲ့နေရာနဲ့ server မြင်တဲ့နေရာ ကွာပြီး "ထိပြီးသားကို
/// မထိဘူး" ခံစားချက် ဖြစ်တယ်။
const EYE_Y = 1.6;

/// Ray ∩ sphere — အနီးဆုံး ထိမှတ် t (ray အကွာအဝေး) ဒါမှမဟုတ် null。
function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox;
  const ly = cy - oy;
  const lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return null;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  const r2 = r * r;
  if (d2 > r2) return null;
  const thc = Math.sqrt(r2 - d2);
  const t = tca - thc;
  return t >= 0 ? t : tca + thc;
}

/// Ray ∩ capsule (ဒေါင်လိုက် ဝင်ရိုး) — capsule ကို segment [a,b] + radius
/// အဖြစ် မြင်တယ်။ ★ တိတိကျကျ analytic ဖြေရှင်းချက်အပြည့် မလိုဘူး —
/// hitbox တွေက ဒေါင်လိုက်ချည်းမို့ ray ကို အလျားလိုက် နမူနာယူပြီး
/// segment နဲ့ အနီးဆုံးအကွာအဝေး စစ်တာက ရိုးရှင်းပြီး လုံလောက်တယ်။
/// နမူနာခြေလှမ်း r/2 — hitbox ကို ကျော်ခုန်လို့ မရအောင်။
function rayCapsule(ox, oy, oz, dx, dy, dz, ax, ay, az, bx, by, bz, r, maxT) {
  const step = r / 2;
  for (let t = 0; t <= maxT; t += step) {
    const px = ox + dx * t;
    const py = oy + dy * t;
    const pz = oz + dz * t;
    // အနီးဆုံး point on segment
    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;
    const len2 = abx * abx + aby * aby + abz * abz || 1;
    let s = ((px - ax) * abx + (py - ay) * aby + (pz - az) * abz) / len2;
    s = Math.max(0, Math.min(1, s));
    const qx = ax + abx * s;
    const qy = ay + aby * s;
    const qz = az + abz * s;
    const ddx = px - qx;
    const ddy = py - qy;
    const ddz = pz - qz;
    if (ddx * ddx + ddy * ddy + ddz * ddz <= r * r) return t;
  }
  return null;
}

/// Player တစ်ယောက်အပေါ် ray — ထိရင် `{ part, t }`၊ မထိရင် null。
/// ★ ခေါင်းကို အရင်စစ်ပေမယ့် body ထက် **ဦးစားပေးတာ မဟုတ်ဘူး** —
///   အနီးဆုံး t ကို ယူတယ်။ ခေါင်းက ကိုယ်ရဲ့နောက်မှာ ရှိနေရင် ကိုယ်ကပဲ ထိတယ်။
function rayPlayer(ox, oy, oz, dx, dy, dz, p, maxT) {
  let best = null;
  const th = raySphere(
    ox, oy, oz, dx, dy, dz,
    p.x + HITBOX.head.c[0], p.y + HITBOX.head.c[1], p.z + HITBOX.head.c[2],
    HITBOX.head.r,
  );
  if (th !== null && th <= maxT) best = { part: "head", t: th };
  const seg = HITBOX.body;
  const tb = rayCapsule(
    ox, oy, oz, dx, dy, dz,
    p.x + seg.a[0], p.y + seg.a[1], p.z + seg.a[2],
    p.x + seg.b[0], p.y + seg.b[1], p.z + seg.b[2],
    seg.r, maxT,
  );
  if (tb !== null && (best === null || tb < best.t)) best = { part: "body", t: tb };
  return best;
}

/// ★ ပစ်ချက်တစ်ချက်ကို ဆုံးဖြတ်တယ် — **server data သီးသန့်နဲ့**。
///
/// `shooter`  — server သိမ်းထားတဲ့ ပစ်သူ (x/y/z/ry)
/// `dir`      — client ကြည့်နေတဲ့ ဦးတည်ချက် `{x,y,z}` (server မှာ ပြန် normalize)
/// `players`  — iterable of players (ပစ်သူပါ ပါလို့ရတယ် — ကျော်တယ်)
/// `maxRange` — လက်နက်ရဲ့ အကွာအဝေး
///
/// ပြန်တာ — `{ victim, part, dist }` ဒါမှမဟုတ် `null` (လွဲ)。
function resolveShot(shooter, dir, players, maxRange) {
  const dx0 = Number(dir?.x);
  const dy0 = Number(dir?.y);
  const dz0 = Number(dir?.z);
  if (![dx0, dy0, dz0].every(Number.isFinite)) return null;
  const len = Math.hypot(dx0, dy0, dz0);
  // ★ သုညနီးပါး vector = client bug ဒါမှမဟုတ် တမင်ပို့တာ — လွဲအဖြစ် သတ်မှတ်
  if (len < 1e-6) return null;
  const dx = dx0 / len;
  const dy = dy0 / len;
  const dz = dz0 / len;

  const ox = shooter.x;
  const oy = (shooter.y ?? 0) + EYE_Y;
  const oz = shooter.z;

  let best = null;
  for (const p of players) {
    if (p.id === shooter.id) continue;
    if (!p.alive) continue;
    // ကြမ်းတမ်းစစ် — hitbox ထိပ်ဆုံး radius 0.31, ကစားသမား လုံးပတ် ~0.4。
    // ဝေးလွန်းသူကို geometry မတွက်ဘူး (player ၁၂ ယောက် × ပစ်နှုန်းမြင့်ရင်
    // ဒါက အလုပ်များတယ်)。
    const rough = Math.hypot(p.x - ox, p.z - oz);
    if (rough > maxRange + 1) continue;
    const hit = rayPlayer(ox, oy, oz, dx, dy, dz, p, maxRange);
    if (hit && (best === null || hit.t < best.dist)) {
      best = { victim: p, part: hit.part, dist: hit.t };
    }
  }
  return best;
}

module.exports = { HITBOX, EYE_Y, raySphere, rayCapsule, rayPlayer, resolveShot };
