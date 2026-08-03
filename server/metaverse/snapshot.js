"use strict";

/// Snapshot netcode (Arena spec A5) — server tick 20Hz。
///
/// ★ ဖြေရှင်းနေတဲ့ ပြဿနာ — လက်ရှိ metaverse က `update` ရောက်တိုင်း
///   ချက်ချင်း broadcast လုပ်တယ်။ ကစားသမား ၂၀ ယောက်၊ တစ်ယောက်စီ 15Hz
///   ပို့ရင် —
///
///       ၂၀ (ပို့သူ) × 15 (Hz) × ၁၉ (လက်ခံသူ) ≈ ၅,၇၀၀ message/s
///
///   Snapshot နဲ့ဆိုရင် server က ၂၀Hz မှာ တစ်ခါပဲ ပို့တယ် —
///
///       ၂၀ (လက်ခံသူ) × ၂၀ (Hz) = ၄၀၀ message/s  (★ ၉၃% လျော့)
///
/// ★ ဒီ file မှာ socket မရှိဘူး — snapshot ကို **ဆောက်ပေးရုံ**။ ပို့တာက
///   caller ရဲ့ တာဝန်။ ဒါမှ bandwidth တွက်ချက်မှုတွေကို test လုပ်လို့ရတယ်။

/// Server tick — ၂၀Hz。 ဒီထက်မြင့်ရင် ဖုန်း data ကုန်တယ်၊ နိမ့်ရင်
/// ရွေ့လျားမှု ခုန်တယ် (client interpolation က ဒါကို ဖုံးပေးတယ်)。
const TICK_HZ = 20;
const TICK_MS = 1000 / TICK_HZ;

/// ★ Interest management (spec 1.6) — ဒီအကွာအဝေးထက် ဝေးတဲ့သူရဲ့ နေရာကို
///   **လုံးဝ မပို့ဘူး**။ ဒါက bandwidth အတွက်တင် မဟုတ်ဘူး — radar/ESP hack
///   ကို အခြေခံကနေ တားတာ။ မပို့တဲ့ အချက်အလက်ကို client က မဖော်ပြနိုင်ဘူး။
const VISIBLE_RADIUS = 40;

/// နေရာကို ဒဿမ ၂ လုံးနဲ့ — millimeter တိကျမှုက ဘယ်သူမှ မမြင်ရဘဲ
/// bandwidth ၃၀% လောက် စားတယ်။
function q(n) {
  return Math.round(n * 100) / 100;
}

/// ★ Input queue — client က `seq` နံပါတ်နဲ့ ပို့တယ်၊ server က နောက်ဆုံး
///   လက်ခံလိုက်တဲ့ seq ကို ပြန်ပြောတယ် (`ackSeq`)。 Client က အဲဒီအထိ
///   ကိုယ့်ဘက်က မှတ်ထားတာတွေ ဖျက်ပြီး ကျန်တာကို ပြန်တွက်တယ်
///   (reconciliation, spec A5.3)。
function createInputQueue() {
  return { lastSeq: 0, pending: [] };
}

/// Input တစ်ခု ထည့်တယ်။ ★ အဟောင်း/ထပ်နေတဲ့ seq ကို ပစ်တယ် — network က
/// message တွေကို အစဉ်လွဲ ပို့တတ်တယ်၊ အဟောင်းကို ပြန်သုံးရင် ကစားသမား
/// နောက်ပြန် ခုန်သွားမယ်။
function pushInput(queue, cmd, maxPending = 64) {
  const seq = Number(cmd?.seq);
  if (!Number.isFinite(seq) || seq <= queue.lastSeq) return false;
  queue.pending.push({ ...cmd, seq });
  // ★ အကန့်အသတ်မဲ့ မကြီးလာစေရ — ပြတ်နေတဲ့ client တစ်ယောက်က
  //   memory ကုန်စေလို့ရမယ်။ အဟောင်းဆုံးကို ဖယ်တယ်။
  while (queue.pending.length > maxPending) queue.pending.shift();
  return true;
}

/// Tick တစ်ခုမှာ စုမိထားတဲ့ input အားလုံးကို ထုတ်ယူပြီး ack မှတ်တယ်။
function drainInputs(queue) {
  if (queue.pending.length === 0) return [];
  queue.pending.sort((a, b) => a.seq - b.seq);
  const out = queue.pending;
  queue.lastSeq = out[out.length - 1].seq;
  queue.pending = [];
  return out;
}

/// ★ တစ်ယောက်ချင်းစီအတွက် သီးသန့် snapshot — သူမြင်ရသူတွေပဲ ပါတယ်။
///
/// `viewer`  — ဘယ်သူ့အတွက် ဆောက်တာလဲ (`{ id, x, z }`)
/// `players` — iterable of `{ id, x, y, z, ry, st }`
/// `t`       — server အချိန် (client က interpolate လုပ်ဖို့)
function buildSnapshot(viewer, players, t, { radius = VISIBLE_RADIUS, ackSeq = 0 } = {}) {
  const out = [];
  const r2 = radius * radius;
  for (const p of players) {
    if (p.id === viewer.id) {
      // ★ ကိုယ့်ကိုယ်ကို အမြဲ ပါရမယ် — reconciliation က ဒါကို
      //   အခြေခံတယ်။ မပါရင် client က server နေရာကို ဘယ်တော့မှ မသိဘူး။
      out.push(view(p));
      continue;
    }
    const dx = p.x - viewer.x;
    const dz = p.z - viewer.z;
    if (dx * dx + dz * dz > r2) continue;
    out.push(view(p));
  }
  return { type: "snapshot", t, ackSeq, players: out };
}

function view(p) {
  const o = { id: p.id, x: q(p.x), y: q(p.y), z: q(p.z), ry: q(p.ry) };
  // ★ `st` (state bitfield) ပါမှ ကျသွားတဲ့သူ/ပုန်းနေသူကို ခွဲမြင်ရမယ်။
  //   မရှိရင် မပို့ဘူး — ကစားသမားတိုင်း byte အပို မကုန်စေချင်ဘူး။
  if (p.st) o.st = p.st;
  return o;
}

/// ★ Delta — ရှေ့ tick နဲ့ တူတဲ့ player ကို ချန်တယ်။ ငြိမ်နေတဲ့လူများတဲ့
///   စောင့်ခန်းမှာ ဒါက အများကြီး လျော့တယ်။
///
///   `prev` က viewer တစ်ယောက်ချင်းစီရဲ့ နောက်ဆုံး snapshot map
///   (`id -> serialized`)。 ပြောင်းသွားတာနဲ့ အသစ်ဝင်လာတာကိုသာ ပို့ပြီး၊
///   ★ ပျောက်သွားသူတွေကို `gone` နဲ့ အတိအလင်း ပြောတယ် — မပြောရင်
///   client မှာ တစ်ယောက်တည်း ငြိမ်ရပ်နေတဲ့ ဂိုးစ် ကျန်နေမယ်။
function diffSnapshot(prev, snap) {
  const changed = [];
  const seen = new Set();
  for (const p of snap.players) {
    seen.add(p.id);
    const before = prev.get(p.id);
    const now = `${p.x},${p.y},${p.z},${p.ry},${p.st ?? 0}`;
    if (before !== now) {
      changed.push(p);
      prev.set(p.id, now);
    }
  }
  const gone = [];
  for (const id of prev.keys()) {
    if (!seen.has(id)) {
      gone.push(id);
      prev.delete(id);
    }
  }
  const out = { type: "snapshot", t: snap.t, ackSeq: snap.ackSeq, players: changed };
  if (gone.length) out.gone = gone;
  return out;
}

/// ★ ခန့်မှန်း bandwidth — acceptance criterion "၁၂ ယောက်မှာ တစ်ယောက်
///   ၃၀ KB/s အောက်" ကို test က ဒီနဲ့ တွက်တယ်။ ခန့်မှန်းချက်ကို ခေါင်းထဲက
///   မထုတ်ဘဲ တကယ့် JSON အရွယ်ကနေ တွက်တာ။
function snapshotBytes(snap) {
  return Buffer.byteLength(JSON.stringify(snap), "utf8");
}

module.exports = {
  TICK_HZ,
  TICK_MS,
  VISIBLE_RADIUS,
  createInputQueue,
  pushInput,
  drainInputs,
  buildSnapshot,
  diffSnapshot,
  snapshotBytes,
};
