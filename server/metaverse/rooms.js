"use strict";

/// Room = map တစ်ခု။ Player တွေက ကိုယ့် room ထဲကလူတွေကိုပဲ မြင်ရမယ်။
///
/// Phase 8 မှာ map ၄ ခု ဖြစ်လာမယ် (city/farm/snow/sky) — အဲဒီအခါ room က
/// map id ဖြစ်သွားတယ်။ အခုကတည်းက ခွဲထားတာက နောက်မှ ပြန်မွမ်းစရာမလိုအောင်။

const ROOMS = new Set(["city", "farm", "snow", "sky", "main"]);

/// room name ကို client ကနေတိုက်ရိုက်မယူရ — မသိတဲ့ name တစ်ခုနဲ့ တစ်ယောက်တည်း
/// ရှိတဲ့ "room" အသစ်တွေ အကန့်အသတ်မဲ့ ဆောက်လို့ရသွားမယ် (memory leak)။
function normalizeRoom(raw) {
  const r = String(raw || "city").toLowerCase();
  return ROOMS.has(r) ? r : "city";
}

class Rooms {
  constructor() {
    /// roomId -> Map<playerId, player>
    this.rooms = new Map();
  }

  get(roomId) {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new Map();
      this.rooms.set(roomId, room);
    }
    return room;
  }

  add(roomId, player) {
    this.get(roomId).set(player.id, player);
  }

  remove(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.delete(playerId);
    // ဗလာ room ကို ချက်ချင်းမဖျက်ဘူး — Map တစ်ခုက သိပ်မကုန်ဘူး၊ ဖျက်ပြီး
    // ချက်ချင်းပြန်ဆောက်ရတာက ပိုကုန်တယ်။ ကိန်းသေ ၅ ခုပဲ ရှိမှာမို့ ဒါနဲ့ရတယ်။
  }

  /// ကိုယ့်ကလွဲပြီး ကျန်တဲ့သူတွေဆီ ပို့။
  broadcast(roomId, msg, exceptId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const data = JSON.stringify(msg);
    for (const p of room.values()) {
      if (p.id === exceptId) continue;
      if (p.ws.readyState === 1) p.ws.send(data);
    }
  }

  /// init message အတွက် — room ထဲရှိပြီးသားလူတွေ
  snapshot(roomId, exceptId) {
    const room = this.rooms.get(roomId);
    const out = {};
    if (!room) return out;
    for (const p of room.values()) {
      if (p.id === exceptId) continue;
      out[p.id] = {
        x: p.x,
        y: p.y,
        z: p.z,
        ry: p.ry,
        name: p.name,
        emote: p.emote,
        // ★ authed က client ဘက်မှာ "ဧည့်သည်" အမှတ်အသား ပြဖို့ — နာမည်ကို
        // ကြည့်ပြီး ခွဲလို့မရဘူး၊ guest က ဘယ်နာမည်မဆို ပေးလို့ရလို့။
        authed: p.authed,
      };
    }
    return out;
  }

  count(roomId) {
    return this.rooms.get(roomId)?.size ?? 0;
  }

  total() {
    let n = 0;
    for (const room of this.rooms.values()) n += room.size;
    return n;
  }
}

module.exports = { Rooms, normalizeRoom, ROOMS };
