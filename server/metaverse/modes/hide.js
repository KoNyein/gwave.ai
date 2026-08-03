"use strict";

/// ဝှက်တမ်း (hide-and-seek) — ★ ပထမဆုံး ထုတ်မယ့် mode。
///
/// ★ ဘာလို့ ဒါကို အရင်ထုတ်ရလဲ (Arena spec အပိုင်း ၂) — ထိခိုက်မှု မပါဘူး၊
///   ဒါကြောင့် projectile, hitbox, lag compensation, anti-cheat ဘာမှ မလိုဘူး။
///   ဒါပေမယ့် lobby, match lifecycle, snapshot, HUD, scoreboard, persistence
///   အားလုံးကို **တကယ့် ကစားသမားတွေနဲ့** စမ်းသပ်ပြီးသား ဖြစ်သွားတယ်။
///   Combat ရောက်တဲ့အခါ အခြေခံအားလုံး ခိုင်နေပြီ။
///
/// ★ ကစားနည်း —
///   · ရှာဖွေသူ (seeker) ၁ ယောက်၊ ကျန်တာ ပုန်းသူ (hider)
///   · ပွဲစချင်း ရှာဖွေသူက ၁၅ စက္ကန့် မျက်စိပိတ် (ပုန်းသူတွေ ပြေးဖို့)
///   · ရှာဖွေသူက ပုန်းသူကို ၂ မီတာအတွင်း ကပ်ရင် ဖမ်းမိတယ်
///   · ဖမ်းမိတဲ့သူက **ရှာဖွေသူ ဖြစ်သွားတယ်** — ဒါက ဂိမ်းကို အဆုံးထိ
///     အရှိန်မကျစေဘူး (ပုန်းသူတွေ တစ်ယောက်ပြီးတစ်ယောက် ကျရင်
///     နောက်ပိုင်းမှာ ရှာဖွေသူတစ်ယောက်တည်း ငြီးငွေ့စရာ ဖြစ်သွားမယ်)
///   · အချိန်ကုန်တဲ့အခါ **မဖမ်းမိသေးသူတွေ အနိုင်ရ**
///
/// ★ Server-authoritative — ဖမ်းမိမမိကို server က နေရာနဲ့ တွက်တယ်။
///   Client က "ငါဖမ်းမိပြီ" လို့ ပြောလို့ မရဘူး။

/// ရှာဖွေသူ မျက်စိပိတ်ချိန်
const BLIND_MS = 15_000;
/// ဖမ်းမိတဲ့ အကွာအဝေး (မီတာ)。 ★ ကျယ်လွန်းရင် ကပ်ရုံနဲ့ ဖမ်းမိပြီး ping
/// မြင့်သူ မခံနိုင်ဘူး၊ ကျဉ်းလွန်းရင် ဘယ်တော့မှ မဖမ်းမိဘူး။
const TAG_RANGE = 2.0;
/// ★ ဖမ်းပြီးချင်း ပြန်ဖမ်းလို့ မရအောင် — မဟုတ်ရင် ရှာဖွေသူ ၂ ယောက်
/// အပြန်အလှန် ဖမ်းနေပြီး ပွဲ ရပ်သွားမယ် (tag-back loop)。
const TAG_COOLDOWN_MS = 3_000;
/// ပုန်းသူ တစ်ယောက် အသက်ရှင်နေရင် စက္ကန့်တိုင်း ရမယ့် အမှတ်
const SURVIVE_POINT_MS = 10_000;

/// ★ Mode တစ်ခုချင်းစီက ဒီပုံစံအတိုင်း ရေးရမယ် (spec အပိုင်း ၂)。
///   Lifecycle က mode ကို ဒီ ၄ ခုကနေပဲ ခေါ်တယ် — mode က lifecycle ရဲ့
///   အထဲကို လက်မထိုးရဘူး။
const hide = {
  id: "hide",
  nameMy: "ဝှက်တမ်း",
  minPlayers: 3,
  maxPlayers: 12,
  /// ★ ဒါက ဒီ mode ရဲ့ အဓိကချက် — combat စနစ်တစ်ခုလုံး ပိတ်ထားတယ်။
  usesCombat: false,

  /// ပွဲစတဲ့အခါ — ရှာဖွေသူ ရွေးတယ်။
  onStart(match, now) {
    const ids = [...match.players.keys()];
    if (ids.length === 0) return [];
    // ★ ရွေးချယ်မှုက match id ကို seed အဖြစ်သုံးတယ် — `Math.random()`
    //   ဆိုရင် ပွဲကို ပြန်စမ်းလို့ မရဘူး၊ report တစ်ခုကို ခြေရာခံရ ခက်တယ်。
    const pick = ids[hashSeed(match.id ?? "seed") % ids.length];
    match.modeState = {
      seekerId: pick,
      blindUntil: now + BLIND_MS,
      lastTagAt: 0,
      /// id -> နောက်ဆုံး အမှတ်ရတဲ့အချိန်
      scoredAt: Object.fromEntries(ids.map((id) => [id, now])),
      /// ဖမ်းမိပြီးသားသူတွေ (တစ်ခါဖမ်းမိရင် ဒီပွဲအတွက် မှတ်တမ်းတင်)
      caught: [],
    };
    for (const p of match.players.values()) p.score = 0;
    return [
      { type: "role", id: pick, role: "seeker" },
      { type: "blind", until: match.modeState.blindUntil },
    ];
  },

  /// စက္ကန့်တိုင်း ခေါ်တယ် — ပုန်းသူတွေ အမှတ်ရတယ်။
  onTick(match, now) {
    const st = match.modeState;
    if (!st || !st.seekerId) return [];
    const events = [];
    for (const p of match.players.values()) {
      if (p.id === st.seekerId) continue;
      if (p.disconnectedUntil !== null) continue;
      const since = now - (st.scoredAt[p.id] ?? now);
      if (since >= SURVIVE_POINT_MS) {
        const points = Math.floor(since / SURVIVE_POINT_MS);
        p.score += points;
        st.scoredAt[p.id] = (st.scoredAt[p.id] ?? now) + points * SURVIVE_POINT_MS;
        events.push({ type: "score", id: p.id, score: p.score });
      }
    }
    return events;
  },

  /// ★ ဖမ်းဖို့ ကြိုးစားတယ် — client က `{ type:'tag', targetId }` ပို့တယ်။
  ///   ဆုံးဖြတ်ချက်အားလုံး ဒီမှာ (server မှာ) ဖြစ်တယ်။
  onPlayerAction(match, actor, action, now) {
    if (action?.type !== "tag") return [];
    const st = match.modeState;
    if (!st?.seekerId) return [];
    if (actor.id !== st.seekerId) return [];
    if (now < st.blindUntil) return [];
    if (now - st.lastTagAt < TAG_COOLDOWN_MS) return [];

    const victim = match.players.get(String(action.targetId ?? ""));
    if (!victim || victim.id === actor.id) return [];
    if (victim.disconnectedUntil !== null) return [];

    // ★ အကွာအဝေးကို **server ရဲ့ နေရာနဲ့** တွက်တယ် — client က
    //   "ကပ်နေပြီ" လို့ ပြောတာကို မယုံဘူး။
    const dx = (victim.x ?? 0) - (actor.x ?? 0);
    const dz = (victim.z ?? 0) - (actor.z ?? 0);
    if (Math.hypot(dx, dz) > TAG_RANGE) return [];

    st.lastTagAt = now;
    st.seekerId = victim.id;
    if (!st.caught.includes(victim.id)) st.caught.push(victim.id);
    // ဖမ်းမိတာက ရှာဖွေသူအတွက် အမှတ် — ရှာဖွေသူဘဝမှာ ဘာမှ မရရင်
    // ဖမ်းဖို့ အားထုတ်စရာ အကြောင်း မရှိဘူး။
    actor.score += 5;
    // ★ အသစ်ဖြစ်လာတဲ့ ရှာဖွေသူရဲ့ အသက်ရှင်မှုနာရီကို ရပ်တယ် —
    //   မဟုတ်ရင် ရှာဖွေရင်းနဲ့ အမှတ်လည်း ရနေမယ်။
    st.scoredAt[victim.id] = now;
    return [
      { type: "tagged", by: actor.id, id: victim.id },
      { type: "role", id: victim.id, role: "seeker" },
      { type: "score", id: actor.id, score: actor.score },
    ];
  },

  /// ပွဲပြီးပြီလား — `null` = မပြီးသေး。
  checkEnd(match, now) {
    const st = match.modeState;
    if (!st?.seekerId) return null;

    // ★ ရှာဖွေသူတစ်ယောက်တည်း ကျန်ရင် ပွဲပြီး — ဖမ်းစရာ မကျန်တော့ဘူး。
    const active = [...match.players.values()].filter((p) => p.disconnectedUntil === null);
    if (active.length <= 1) {
      return { reason: "last-player", winnerId: active[0]?.id ?? null };
    }
    const hiders = active.filter((p) => p.id !== st.seekerId);
    if (hiders.length === 0) {
      return { reason: "all-caught", winnerId: st.seekerId };
    }

    if (match.endsAt !== null && now >= match.endsAt) {
      // ★ အချိန်ကုန်ရင် **မဖမ်းမိသေးသူ** အနိုင်ရ — အမှတ်အများဆုံး
      //   ဟိုက်ဒါ။ ရှာဖွေသူကို အနိုင်ပေးလို့ မရဘူး၊ သူက အဆုံးအထိ
      //   ရှာဖွေသူ ဖြစ်နေတာ ရှုံးတာပါ။
      let best = null;
      for (const p of hiders) {
        if (!best || p.score > best.score || (p.score === best.score && p.id < best.id)) best = p;
      }
      return { reason: "time", winnerId: best?.id ?? null };
    }
    return null;
  },

  /// ရှာဖွေသူက ထွက်သွား/ပြတ်သွားရင် — တခြားတစ်ယောက်ကို လွှဲရမယ်။
  /// ★ ဒါမလုပ်ရင် ပွဲက ရှာဖွေသူ မရှိဘဲ ဆက်သွားပြီး ဘယ်တော့မှ မပြီးဘူး။
  onPlayerLeft(match, id, now) {
    const st = match.modeState;
    if (!st?.seekerId || st.seekerId !== id) return [];
    const active = [...match.players.values()].filter(
      (p) => p.id !== id && p.disconnectedUntil === null,
    );
    if (active.length === 0) {
      st.seekerId = null;
      return [];
    }
    const next = active[hashSeed(String(now)) % active.length];
    st.seekerId = next.id;
    st.lastTagAt = now;
    st.scoredAt[next.id] = now;
    return [{ type: "role", id: next.id, role: "seeker", reason: "seeker-left" }];
  },
};

/// စာသားတစ်ခုကို ကိန်းတစ်လုံးအဖြစ် — FNV-1a。 ★ crypto မဟုတ်ဘူး၊
/// ဒီနေရာမှာ လိုတာက **ပြန်ထပ်တူဖြစ်မှု** ပဲ (တူညီတဲ့ match id က
/// တူညီတဲ့ ရှာဖွေသူကို ရွေးရမယ် — bug report ကို ပြန်စမ်းလို့ရအောင်)。
function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

module.exports = { hide, BLIND_MS, TAG_RANGE, TAG_COOLDOWN_MS, SURVIVE_POINT_MS, hashSeed };
