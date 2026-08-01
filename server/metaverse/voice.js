"use strict";

/// Voice chat — signaling registry (Phase 14)。
///
/// Architecture: **WebRTC mesh** ကို metaverse WS ကနေ signal relay လုပ်တယ်။
///
/// ★ Chime SDK (spec ရဲ့ ပထမရွေးချယ်မှု) ကို မသုံးရတဲ့ အကြောင်း — Chime ရဲ့
///   JS SDK က attendee အားလုံးရဲ့ အသံကို **server မှာ ရောပြီး stream တစ်ခုတည်း**
///   ပေးတယ်။ အဲဒါနဲ့ "ဘယ်ဘက်ကလူရဲ့ အသံက ဘယ်နားကြပ်မှာ ကျယ်ရမယ်" (HRTF၊
///   spec 14.6 ရဲ့ acceptance criterion) ကို **လုပ်လို့မရဘူး** — per-speaker
///   stream လိုတယ်။ Spec 14.1 ရဲ့ ဇယားထဲမှာပဲ mesh က room သေးသေးအတွက်
///   တရားဝင် ရွေးချယ်မှုဖြစ်ပြီး spec 14.0 ကလည်း ပထမဗားရှင်းမှာ လူနည်းတဲ့
///   moderated room သာ ဖွင့်ဖို့ အကြံပြုတယ်။ Mesh က $0 လည်း ကျတယ်။
///
/// ★ စည်းမျဉ်း (spec 14.0 — အန္တရာယ်အရှိဆုံး feature):
///   - **၁၈ နှစ်အောက် / အသက်မသိသူ ဝင်လို့မရ** — ticket ထဲက `adult` claim
///     (Next.js က DOB ကြည့်ပြီး ထည့်တာ) ကို စစ်တယ်။ Fail-closed。
///   - Guest ဝင်လို့မရ — တာဝန်ခံမှုမရှိတဲ့ identity နဲ့ voice က အန္တရာယ်ကြီးတယ်။
///   - Mic default ပိတ် — အဲဒါက client မှာ၊ ဒီမှာက mute state ကို relay ပဲ။
///   - Recording မလုပ်ဘူး — server က audio ကို လုံးဝ မမြင်ဘူး (P2P)。

/// Mesh ရဲ့ ကန့်သတ် — n ယောက်ဆို connection က n(n-1)/2။ ၁၂ ယောက်မှာ ၆၆ ခု
/// ဖြစ်ပြီး ဒီထက်များရင် ဖုန်းတွေ မတင်တော့ဘူး။
const MAX_VOICE_PER_ROOM = 12;

function createVoiceRegistry() {
  /// roomId -> Map<playerId, { muted }>
  const rooms = new Map();

  const roomSet = (roomId) => {
    let m = rooms.get(roomId);
    if (!m) {
      m = new Map();
      rooms.set(roomId, m);
    }
    return m;
  };

  return {
    /// ဝင်ခွင့် စစ်ပြီး ထည့်တယ်။ ရလဒ်: "ok" | "auth" | "age" | "full"
    join(roomId, player) {
      // ★ Guest မရ — voice မှာ identity တာဝန်ခံမှု လိုတယ်
      if (!player.authed) return "auth";
      // ★ ၁၈+ သာ (spec 14.0) — `adult` က ticket ကနေ လာတယ်၊ fail-closed
      if (player.adult !== true) return "age";
      const m = roomSet(roomId);
      if (!m.has(player.id) && m.size >= MAX_VOICE_PER_ROOM) return "full";
      if (!m.has(player.id)) m.set(player.id, { muted: true });
      return "ok";
    },

    leave(roomId, playerId) {
      const m = rooms.get(roomId);
      if (!m) return false;
      return m.delete(playerId);
    },

    has(roomId, playerId) {
      return rooms.get(roomId)?.has(playerId) ?? false;
    },

    setMuted(roomId, playerId, muted) {
      const entry = rooms.get(roomId)?.get(playerId);
      if (entry) entry.muted = muted === true;
    },

    /// Voice ထဲရှိသူများ — client က ဒါနဲ့ mesh ဆောက်တယ်
    peers(roomId) {
      const m = rooms.get(roomId);
      if (!m) return [];
      return [...m.entries()].map(([id, s]) => ({ id, muted: s.muted }));
    },
  };
}

module.exports = { createVoiceRegistry, MAX_VOICE_PER_ROOM };
