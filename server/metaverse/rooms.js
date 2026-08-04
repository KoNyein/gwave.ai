"use strict";

/// Room = map တစ်ခု။ Player တွေက ကိုယ့် room ထဲကလူတွေကိုပဲ မြင်ရမယ်။
///
/// Phase 8 မှာ map ၄ ခု ဖြစ်လာမယ် (city/farm/snow/sky) — အဲဒီအခါ room က
/// map id ဖြစ်သွားတယ်။ အခုကတည်းက ခွဲထားတာက နောက်မှ ပြန်မွမ်းစရာမလိုအောင်။

/// ★ Room က စာသားတစ်လုံးမဟုတ်တော့ဘဲ **သတ်မှတ်ချက် record** ဖြစ်တယ်
///   (Arena spec A1.1)。 ဘာလို့လဲ — "ဒီ room မှာ လက်နက်ရလား" ဆိုတာကို
///   room name နဲ့ ခန့်မှန်းနေရင် (`id.startsWith("assassin")` မျိုး)
///   room အသစ်ထည့်တိုင်း ခန့်မှန်းချက်တွေ တစ်နေရာစီ ကျန်ခဲ့တတ်တယ်။
///   `type` ကို data ထဲ ထည့်လိုက်တော့ စစ်စရာ တစ်ခုတည်း ဖြစ်သွားတယ်။
///
/// - `social` — ကမ္ဘာလှည့်၊ စကားပြော၊ ယာဉ်စီး၊ ဆောက်လုပ်။ ★ လက်နက် လုံးဝမရှိ
/// - `game`   — ပွဲစဉ် (lobby → live → ended)。 ယာဉ်/ဆောက်လုပ် မရှိ
const ROOM_DEFS = [
  { id: "city", type: "social", mapId: "city", maxPlayers: 200 },
  { id: "farm", type: "social", mapId: "farm", maxPlayers: 200 },
  { id: "snow", type: "social", mapId: "snow", maxPlayers: 200 },
  { id: "sky", type: "social", mapId: "sky", maxPlayers: 200 },
  { id: "main", type: "social", mapId: "city", maxPlayers: 200 },
  // 🌆 Kenney kit showcase city (client: maps/gwave-city.ts)
  // ★ worldR — client map ရဲ့ walkRadius (114) က default anti-cheat bound
  //   (90) ထက် ကျယ်လို့ ဒီ room မှာ ချဲ့ပေးထားတယ်။ မချဲ့ရင် မြို့စွန်ရောက်တာနဲ့
  //   server က rubber-band လုပ်ပြီး "လမ်းလျှောက်လို့မရ" ဖြစ်တယ်။
  { id: "gwave-city", type: "social", mapId: "gwave-city", maxPlayers: 200, worldR: 120 },
  { id: "vip", type: "social", mapId: "city", maxPlayers: 200, gate: "token" },

  // FPV drone simulator maps (client: src/lib/fpv/maps.ts)。 ဒါတွေက
  // ပွဲစဉ်စနစ် မသုံးဘူး — အတူတူ ပျံနေရုံ၊ ဒါကြောင့် social ပဲ။
  { id: "fpv-race", type: "social", mapId: "fpv-race", maxPlayers: 32 },
  { id: "fpv-park", type: "social", mapId: "fpv-park", maxPlayers: 32 },
  { id: "fpv-city", type: "social", mapId: "fpv-city", maxPlayers: 32 },
  { id: "fpv-canyon", type: "social", mapId: "fpv-canyon", maxPlayers: 32 },
  { id: "fpv-warehouse", type: "social", mapId: "fpv-warehouse", maxPlayers: 32 },
  { id: "fpv-range", type: "social", mapId: "fpv-range", maxPlayers: 32 },

  // ★ Hub-world arena — metaverse client က map picker ကနေ တိုက်ရိုက်
  //   ဝင်တဲ့ Assassin game room (၁၈+)。 assassin-1..3 (သီးခြား /games
  //   client) နဲ့ room ခွဲထားတာက protocol ရောမသွားအောင် — ဒီ room ထဲမှာ
  //   metaverse presence (avatar) နဲ့ combat (aMove/aFire) နှစ်ထပ်လုံး
  //   သွားတယ်။
  {
    id: "arena",
    type: "game",
    mapId: "arena",
    maxPlayers: 12,
    gate: "adult",
    gameMode: "assassin",
  },

  // ★ Assassin mini-game arenas (၁၈+)。 Room ကို ခွဲထားတာက ပွဲတွေ
  //   သီးခြားဖြစ်ဖို့ — တစ်ခုတည်းဆိုရင် ကမ္ဘာပေါ်က လူအားလုံး တစ်ပွဲထဲ
  //   ရောနေမယ်။
  {
    id: "assassin-1",
    type: "game",
    mapId: "arena",
    maxPlayers: 12,
    gate: "adult",
    gameMode: "assassin",
  },
  {
    id: "assassin-2",
    type: "game",
    mapId: "arena",
    maxPlayers: 12,
    gate: "adult",
    gameMode: "assassin",
  },
  {
    id: "assassin-3",
    type: "game",
    mapId: "arena",
    maxPlayers: 12,
    gate: "adult",
    gameMode: "assassin",
  },

  // ★ ဝှက်တမ်း — ထိခိုက်မှု လုံးဝမရှိလို့ အသက်ကန့်သတ်ချက် မလိုဘူး။
  //   Arena spec က ဒါကို အရင်ထုတ်ဖို့ ပြောထားတယ်: lobby/match/snapshot
  //   အားလုံးကို combat မပါဘဲ စမ်းသပ်ပြီးသား ဖြစ်သွားလို့။
  {
    id: "hide-1",
    type: "game",
    mapId: "arena",
    maxPlayers: 12,
    gameMode: "hide",
    gameConfig: { minPlayers: 3, matchMinutes: 5, seekerCount: 1 },
  },
  {
    id: "hide-2",
    type: "game",
    mapId: "arena",
    maxPlayers: 12,
    gameMode: "hide",
    gameConfig: { minPlayers: 3, matchMinutes: 5, seekerCount: 1 },
  },
];

const ROOM_BY_ID = new Map(ROOM_DEFS.map((d) => [d.id, Object.freeze(d)]));

const ROOMS = new Set(ROOM_BY_ID.keys());

/// ★ ၁၈+ သာ ဝင်ခွင့်ရှိတဲ့ room။ Voice ရဲ့ ဂိတ်နဲ့ တူညီတဲ့ `adult` claim ကို
///   သုံးတယ် — client မှာ ခလုတ်ဖျောက်ရုံနဲ့ ဘာမှ မကာကွယ်ဘူး၊ စစ်တာက
///   server.js မှာ။
/// ★ စာရင်းကို လက်နဲ့ မရေးတော့ဘူး — def ကနေ ဆွဲထုတ်တယ်။ Room အသစ်ထည့်ပြီး
///   ဂိတ်စာရင်းထဲ ထည့်ဖို့ မေ့သွားတာက ဒီနေရာမှာ ဖြစ်လို့ မရတော့ဘူး။
const ADULT_ROOMS = new Set(ROOM_DEFS.filter((d) => d.gate === "adult").map((d) => d.id));

/// ★ NFT ပိုင်မှ ဝင်လို့ရတဲ့ room။ စစ်ဆေးမှုက **server မှာသာ** ဖြစ်တယ် —
/// client မှာ ခလုတ်ဖျောက်ထားရုံနဲ့ ဘာမှမကာကွယ်ဘူး (server.js ကြည့်ပါ)။
const GATED_ROOMS = new Set(ROOM_DEFS.filter((d) => d.gate === "token").map((d) => d.id));

/// Room သတ်မှတ်ချက်ကို ပြန်ရယူ — မသိတဲ့ id ဆိုရင် `null`。
function roomDef(id) {
  return ROOM_BY_ID.get(String(id || "")) ?? null;
}

/// ★ **တစ်နေရာတည်းက စစ်ချက်** (spec A1.2)。 Combat message တိုင်း ဒီကို
///   ဖြတ်ရမယ် — social room မှာ လက်နက်/ထိခိုက်မှု လုံးဝ မဖြစ်ရ။
///   `roomId` မသိရင် `false` — မသိတာကို ခွင့်ပြုတာက ဒီနေရာမှာ အန္တရာယ်ရှိတယ်。
function isGameRoom(id) {
  return roomDef(id)?.type === "game";
}

/// ဒီ room က ဘယ် mode လဲ (`null` = social)。
function roomGameMode(id) {
  return roomDef(id)?.gameMode ?? null;
}

/// room name ကို client ကနေတိုက်ရိုက်မယူရ — မသိတဲ့ name တစ်ခုနဲ့ တစ်ယောက်တည်း
/// ရှိတဲ့ "room" အသစ်တွေ အကန့်အသတ်မဲ့ ဆောက်လို့ရသွားမယ် (memory leak)။
function normalizeRoom(raw) {
  const r = String(raw || "city").toLowerCase();
  return ROOMS.has(r) ? r : "city";
}

class Rooms {
  constructor() {
    /// roomId -> Map<playerId, player>  (ဒီ task ပေါ်က socket ရှိသူတွေ)
    this.rooms = new Map();
    /// roomId -> Map<playerId, ghost>   (တခြား task ပေါ်က player တွေ)
    ///
    /// ★ "ဂိုးစ်" မှာ socket မရှိဘူး — ပြရုံသက်သက် အခြေအနေပဲ။ ဒီခွဲထားမှုက
    /// အရေးကြီးတယ်: broadcast က local socket တွေဆီပဲ ပို့ရမယ်၊ ဂိုးစ်ဆီ
    /// ပို့ဖို့ ကြိုးစားရင် `p.ws.send` က ချက်ချင်း ကျမယ်။
    this.ghosts = new Map();
    /// roomId -> Map<vehicleId, playerId> — ယာဉ်တစ်စီးမှာ driver တစ်ယောက်။
    /// ★ Server မှာ lock လုပ်မှ race condition မဖြစ်ဘူး — client ၂ ခု
    /// တစ်ပြိုင်နက် "ငါစီးမယ်" ပြောရင် တစ်ယောက်ပဲ ရရမယ်။
    this.drivers = new Map();
  }

  vehicleDriver(roomId, vehicleId) {
    return this.drivers.get(roomId)?.get(vehicleId) ?? null;
  }

  setVehicleDriver(roomId, vehicleId, playerId) {
    let m = this.drivers.get(roomId);
    if (!m) {
      m = new Map();
      this.drivers.set(roomId, m);
    }
    // player တစ်ယောက်က ယာဉ်တစ်စီးတည်း
    for (const [vid, pid] of m) if (pid === playerId) m.delete(vid);
    m.set(vehicleId, playerId);
  }

  /// ဒီ player ကိုင်ထားတဲ့ ယာဉ်အားလုံးကို လွတ်စေတယ်
  releaseVehicles(roomId, playerId) {
    const m = this.drivers.get(roomId);
    if (!m) return [];
    const freed = [];
    for (const [vid, pid] of m) {
      if (pid === playerId) {
        m.delete(vid);
        freed.push(vid);
      }
    }
    return freed;
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
  ///
  /// ★ `skipAfk` က နေရာ update အတွက်သာ — tab/app ကို နောက်ပိုင်း ပို့ထားသူက
  /// render မလုပ်တော့ဘူး၊ သူ့ဆီ 15Hz နဲ့ ပို့နေတာက ဖုန်း data ကို အလကား
  /// စားတာပဲ (Phase 17.4)。 chat/join/leave တို့ကတော့ အမြဲ ပို့ရမယ် —
  /// မဟုတ်ရင် ပြန်လာချိန်မှာ စာတွေ ပျောက်နေမယ်။
  broadcast(roomId, msg, exceptId, skipAfk = false) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const data = JSON.stringify(msg);
    for (const p of room.values()) {
      if (p.id === exceptId) continue;
      if (skipAfk && p.afk) continue;
      if (p.ws.readyState === 1) p.ws.send(data);
    }
  }

  // ── တခြား task ပေါ်က player တွေ (Phase 6.2) ─────────────────────────────

  ghostRoom(roomId) {
    let g = this.ghosts.get(roomId);
    if (!g) {
      g = new Map();
      this.ghosts.set(roomId, g);
    }
    return g;
  }

  setGhost(roomId, id, state, origin) {
    const g = this.ghostRoom(roomId);
    const cur = g.get(id) ?? { id, x: 0, y: 0, z: 0, ry: 0, name: "Gwave", emote: null, authed: false };
    g.set(id, { ...cur, ...state, origin, seenAt: Date.now() });
  }

  removeGhost(roomId, id) {
    this.ghosts.get(roomId)?.delete(id);
  }

  /// Task တစ်ခုရဲ့ player စာရင်း အပြည့်အစုံ ရောက်လာတဲ့အခါ — အဲဒီ task ကလာတဲ့
  /// ဂိုးစ်အားလုံးကို အစားထိုးတယ်။ ★ ဒါက **မဖြစ်မနေလိုတယ်** — message
  /// တစ်ခုချင်းနဲ့ ခြေရာခံရင် task အသစ်တက်လာချိန်မှာ ငြိမ်နေတဲ့လူတွေကို
  /// ဘယ်တော့မှ မမြင်ရဘူး (မရွှေ့ရင် update မပို့လို့)။
  syncGhosts(roomId, origin, players) {
    const g = this.ghostRoom(roomId);
    for (const [id, ghost] of g) {
      if (ghost.origin === origin) g.delete(id);
    }
    for (const [id, state] of Object.entries(players || {})) {
      g.set(id, { ...state, id, origin, seenAt: Date.now() });
    }
  }

  /// Task တစ်လုံး ရုတ်တရက် သေသွားရင် သူ့ဂိုးစ်တွေ ကျန်နေမယ် — အလှည့်ကျ
  /// ရှင်းတယ်။ (sync က ပုံမှန် ရောက်နေသရွေ့ seenAt အသစ်ဖြစ်နေမယ်။)
  sweepGhosts(maxAgeMs) {
    const cutoff = Date.now() - maxAgeMs;
    const dropped = [];
    for (const [roomId, g] of this.ghosts) {
      for (const [id, ghost] of g) {
        if (ghost.seenAt < cutoff) {
          g.delete(id);
          dropped.push([roomId, id]);
        }
      }
    }
    return dropped;
  }

  /// init message အတွက် — room ထဲရှိပြီးသားလူတွေ (local + ဂိုးစ်)
  snapshot(roomId, exceptId) {
    const out = {};
    const view = (p) => ({
      x: p.x,
      y: p.y,
      z: p.z,
      ry: p.ry,
      name: p.name,
      emote: p.emote ?? null,
      // ★ authed က client ဘက်မှာ "ဧည့်သည်" အမှတ်အသား ပြဖို့ — နာမည်ကို
      // ကြည့်ပြီး ခွဲလို့မရဘူး၊ guest က ဘယ်နာမည်မဆို ပေးလို့ရလို့။
      authed: p.authed,
    });
    for (const p of this.rooms.get(roomId)?.values() ?? []) {
      if (p.id !== exceptId) out[p.id] = view(p);
    }
    for (const p of this.ghosts.get(roomId)?.values() ?? []) {
      if (p.id !== exceptId && !out[p.id]) out[p.id] = view(p);
    }
    return out;
  }

  /// ဒီ task ပေါ်က player တွေချည်း — bus ပေါ် sync ပို့ဖို့
  localSnapshot(roomId) {
    const out = {};
    for (const p of this.rooms.get(roomId)?.values() ?? []) {
      out[p.id] = {
        x: p.x,
        y: p.y,
        z: p.z,
        ry: p.ry,
        name: p.name,
        emote: p.emote ?? null,
        authed: p.authed,
      };
    }
    return out;
  }

  /// Room အားလုံးက player အားလုံး — periodic flush (Phase 4) အတွက်။
  *everyone() {
    for (const room of this.rooms.values()) yield* room.values();
  }

  /// ★ ဂိုးစ်တွေပါ ရေတွက်တယ် — client မှာပြတဲ့ "👥 5" က တစ်လောကလုံးက
  /// အရေအတွက် ဖြစ်ရမယ်၊ ဒီ task ပေါ်က အရေအတွက် မဟုတ်ဘူး။
  count(roomId) {
    return (this.rooms.get(roomId)?.size ?? 0) + (this.ghosts.get(roomId)?.size ?? 0);
  }

  /// ဒီ task ရဲ့ တကယ့် socket အရေအတွက် — /health မှာ ဒါက ပိုအသုံးဝင်တယ်
  /// (autoscaling က task တစ်ခုချင်းရဲ့ ဝန်ကို ကြည့်ရမှာမို့)။
  localTotal() {
    let n = 0;
    for (const room of this.rooms.values()) n += room.size;
    return n;
  }

  total() {
    let n = this.localTotal();
    for (const g of this.ghosts.values()) n += g.size;
    return n;
  }

  /// ★ Room အလိုက် အရေအတွက် — `/health` မှာပြဖို့ (spec A1.3)。
  ///   စုစုပေါင်းတစ်ခုတည်းက "ဘယ် room မှာ လူပြည့်နေလဲ" ကို မဖြေနိုင်ဘူး၊
  ///   ပွဲစဉ်တွေ ဘာလို့ မစတာလဲ စစ်တဲ့အခါ အဲဒါက ပထမဆုံး မေးခွန်းပါ။
  ///   လူမရှိတဲ့ room ကို ချန်ထားတယ် — အမြဲ သုည ၁၅ ကြောင်း ပြနေရင်
  ///   အရေးကြီးတဲ့ ကိန်းက ပျောက်သွားတယ်။
  byRoom() {
    const out = {};
    for (const id of ROOM_BY_ID.keys()) {
      const n = this.count(id);
      if (n > 0) out[id] = n;
    }
    return out;
  }
}

module.exports = {
  Rooms,
  normalizeRoom,
  roomDef,
  roomGameMode,
  isGameRoom,
  ROOMS,
  ROOM_DEFS,
  GATED_ROOMS,
  ADULT_ROOMS,
};
