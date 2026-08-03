# GWAVE ASSASSIN — Metaverse Game Mode Integration Spec

> **ရည်ရွယ်ချက်** — `assassin-game.html` (သီးခြား prototype) ကို ဖျက်ပြီး Assassin ကို **metaverse ရဲ့ game mode တစ်ခုအဖြစ်** အသစ်တည်ဆောက်ရန်။
> Claude Code ကို ဒီ file ပေးပြီး Phase A1 → A9 အစဉ်လိုက်လုပ်ခိုင်းပါ။

---

# ၀။ ★ လက်ရှိ prototype ၏ ချို့ယွင်းချက် စိစစ်ချက်

Code ကို တကယ်စစ်ဆေးထားပါတယ်။ ဒါတွေက **ပြင်ရမယ့်စာရင်း** မဟုတ်ဘဲ **အသစ်ရေးရမယ့်အကြောင်းရင်း** ပါ။

## 0.1 တည်ဆောက်ပုံဆိုင်ရာ ချို့ယွင်းချက် (ကြီးမားသည်)

| # | ချို့ယွင်းချက် | အထောက်အထား | ဆိုးကျိုး |
|---|---|---|---|
| 1 | **Server ၂ ခု သီးခြားစီ** | metaverse: `update/chat/emote/setname`<br>assassin: `move/fire/reload/setSkin/switchWeapon` | Protocol ၂ မျိုး၊ code ၂ ဆ၊ ပြင်ရင် ၂ နေရာ |
| 2 | **Auth လုံးဝမရှိ** | assassin server မှာ Cognito/ticket code မရှိ | ဘယ်သူမဆို နာမည်အတုနဲ့ ဝင်လို့ရ |
| 3 | **DB ချိတ်ဆက်မှု မရှိ** | `pg`/query တစ်ခုမှမရှိ | Server restart ရင် အမှတ်အားလုံးပျောက် |
| 4 | **Room/map စနစ်မရှိ** | `room` ဆိုတဲ့စကားလုံး code ထဲမရှိ | Match တစ်ခုတည်းသာ၊ ကစားသမား ၅၀ ဆို ရှုပ်ကုန် |
| 5 | **Avatar ၂ မျိုး** | metaverse `createHuman()` vs assassin `createToonFighter()` | ကစားသမားရဲ့ကိုယ်ပိုင် avatar ပျောက်သွား |
| 6 | **Skin က entitlement နဲ့မချိတ်** | `SKINS` က server code ထဲ hardcode | G-Pay နဲ့ဝယ်ထားတာ အသုံးမဝင် |
| 7 | **Client မှာ monolithic HTML** | 1,200 လိုင်း ဖိုင်တစ်ခုတည်း | Next.js ထဲ ထည့်လို့မရ |

## 0.2 ★ Game design အရ ချို့ယွင်းချက် (အရေးအကြီးဆုံး)

**(က) Hit registration က client ကို ယုံနေတယ်**

```js
// လက်ရှိ client (p2.html:357)
const hits = raycaster.intersectObjects(meshes, false);
ws.send({ type:'fire', targetId: pid, hitPart });   // ★ client က "ဘယ်သူ ဘယ်နေရာ" ဆုံးဖြတ်
```
```js
// လက်ရှိ server — အကွာအဝေးပဲစစ်တယ်
if (dist > w.range) return;
```

★ **ပြဿနာ** — Client က `targetId` နဲ့ `hitPart:'head'` ကို လွတ်လပ်စွာပြောလို့ရတယ်။ ကွယ်နေတဲ့သူကို ပစ်လို့ရ၊ ခေါင်းမထိဘဲ ခေါင်းထိတယ်လို့ပြောလို့ရ (aimbot ရေးရ လွယ်လွယ်)။

★ **စံနည်း** — Server မှာ ကစားသမားနေရာ history သိမ်းထားပြီး၊ ပစ်ချိန်က ray ကို **server မှာပြန်တွက်** (lag compensation နဲ့ rewind)။

**(ခ) Lag compensation မရှိ**
Ping 150ms ဆိုရင် မြင်ရတဲ့နေရာနဲ့ တကယ့်နေရာ ၁ မီတာလောက်ကွာတယ် — ပစ်ရင် မထိဘူး။ ဒါက multiplayer shooter ရဲ့ အခြေခံလိုအပ်ချက်ပါ။

**(ဂ) Tick rate မရှိ** — `move` ရောက်တိုင်း ချက်ချင်း broadcast လုပ်တယ်။ ကစားသမား ၂၀ ဆို message 20×20×15 = **၆,၀၀၀/s**။ Snapshot tick (20Hz) နဲ့ delta compression လိုတယ်။

**(ဃ) Match lifecycle မရှိ** — lobby မရှိ၊ စောင့်ခန်းမရှိ၊ ပွဲပြီးရင် ဘာဆက်ဖြစ်လဲ မရှင်း၊ ကြည့်ရှုသူ (spectator) မရှိ၊ open world ကို ဘယ်လိုပြန်ထွက်မလဲ မရှိ။

## 0.3 ဆုံးဖြတ်ချက်

```
❌ လက်ရှိ assassin-game.html + assassin-server.js ကို ဖျက်ပါ
✅ Metaverse ရဲ့ server/client ကို ချဲ့ပြီး game mode အဖြစ်ရေးပါ
   (ကောင်းတဲ့အပိုင်း ၂ ခုကိုသာ ပြန်သုံး —
    ★ toon.js ရဲ့ အနုပညာစနစ်
    ★ ပစ်မှတ်သံသရာ algorithm — assignTargets() / relinkAfterRemoval())
```

---

# ၁။ တည်ဆောက်ပုံ (Architecture)

```
                    ┌──────── Metaverse Server (တစ်ခုတည်း) ────────┐
                    │  Cognito auth · rooms · persistence          │
                    │  ┌────────────────────────────────────────┐  │
   Open World  ◄────┼──┤ RoomManager                            │  │
   (city/farm/…)    │  │  ├ room:'city'   type:'social'         │  │
                    │  │  ├ room:'farm'   type:'social'         │  │
                    │  │  └ room:'arena'  type:'game' ★         │  │
                    │  │      └ MatchInstance (assassin)        │  │
                    │  │           ├ lobby → live → ended       │  │
                    │  │           ├ TargetCycle                │  │
                    │  │           ├ CombatSystem (server ray)  │  │
                    │  │           └ SnapshotBroadcaster 20Hz   │  │
                    │  └────────────────────────────────────────┘  │
                    └──────────────┬───────────────────────────────┘
                                   │ RDS
                    ┌──────────────▼───────────────┐
                    │ mv_matches · mv_match_players │
                    │ mv_inventory (skin ပိုင်ဆိုင်မှု)│
                    └──────────────────────────────┘
```

## 1.1 ★ အခြေခံမူ ၆ ချက်

1. **Server တစ်ခုတည်း** — Game က room type အသစ်တစ်ခုသာ။ WebSocket, auth, reconnect, chat အားလုံး ပြန်သုံး
2. **Avatar တစ်ခုတည်း** — ကစားသမားရဲ့ metaverse avatar ကိုပဲသုံး၊ combat gear ကို **အထပ်ထည့်** (attachment)
3. **Combat က server-authoritative** — hit ဆုံးဖြတ်ချက် client မှာ လုံးဝမလုပ်ရ
4. **Open world ↔ game seamless** — portal ကနေဝင်၊ ပွဲပြီးရင် ပြန်ထွက်၊ page reload မရှိ
5. **Cosmetic-only ကို default** — pay-to-win ကို config နဲ့ ဖွင့်/ပိတ်လို့ရအောင်
6. **Game ကျရင် metaverse မကျရ** — match instance ကျဆုံးလည်း room ဆက်အလုပ်လုပ်ရမယ်

---

# Phase A1 — Room Type စနစ်

## A1.1 Room သတ်မှတ်ချက်

```ts
// server/metaverse/rooms.ts
export type RoomType = 'social' | 'game';

export type RoomDef = {
  id: string;
  type: RoomType;
  mapId: MapId;                    // 'city' | 'farm' | 'snow' | 'sky' | 'arena'
  maxPlayers: number;
  gameMode?: GameModeId;           // type==='game' မှသာ
  gameConfig?: Record<string, unknown>;
};

export const ROOMS: RoomDef[] = [
  { id: 'city',  type: 'social', mapId: 'city',  maxPlayers: 200 },
  { id: 'farm',  type: 'social', mapId: 'farm',  maxPlayers: 200 },
  { id: 'snow',  type: 'social', mapId: 'snow',  maxPlayers: 200 },
  { id: 'sky',   type: 'social', mapId: 'sky',   maxPlayers: 200 },
  // ★ Game map — social နဲ့ သီးခြား
  { id: 'arena', type: 'game',   mapId: 'arena', maxPlayers: 16,
    gameMode: 'assassin',
    gameConfig: { killsToWin: 3, matchMinutes: 8, minPlayers: 3, maxPlayers: 12 } },
];
```

## A1.2 ★ Social room မှာ ဘယ်အရာတွေ ပိတ်ရမလဲ

| စနစ် | social | game |
|---|---|---|
| Chat | ✅ | ✅ (team/all) |
| Emote | ✅ | ✅ (lobby မှာသာ) |
| ယာဉ်စီး | ✅ | ❌ |
| ဆောက်လုပ်ရေး | ✅ | ❌ |
| **လက်နက်** | ❌ ★ | ✅ |
| **ထိခိုက်မှု** | ❌ ★ | ✅ |

> ★ **အရေးအကြီးဆုံးစည်းမျဉ်း** — Social room မှာ လက်နက်/ထိခိုက်မှု **လုံးဝမရှိရ**။ Server က `fire` message ကို social room ကနေလာရင် ချက်ချင်းငြင်းရမယ်။ ဒါက code မှာ တစ်နေရာတည်းမှာ စစ်ရမယ် (မမေ့အောင်)။

## A1.3 Acceptance Criteria
- [ ] Room type ကို config ကနေသတ်မှတ်၊ hardcode မဟုတ်
- [ ] ★ Social room မှာ `fire` ပို့ရင် server ငြင်း (log ထဲမှတ်)
- [ ] Room ကူးရင် WebSocket မပြတ် (reconnect မလို)
- [ ] Room အလိုက် ကစားသမားအရေအတွက် `/health` မှာပြ

---

# Phase A2 — Arena Map

## A2.1 ဒီဇိုင်းလိုအပ်ချက်

Assassin game ရဲ့ map က **social map နဲ့ လုံးဝမတူ** ရမယ် —

| လိုအပ်ချက် | အကြောင်းရင်း |
|---|---|
| **ကွယ်စရာများများ** (cover) | ပစ်ခတ်မှုမှာ အကာအကွယ်မရှိရင် ပထမပစ်သူပဲနိုင်တယ် |
| **လမ်းကြောင်း ၃ ခုအနည်းဆုံး** | တစ်ကြောင်းတည်းဆို ပိတ်ဆို့တတ်တယ် |
| **အမြင့်ကွာခြားမှု** | စနိုက်ပါနေရာ vs အနီးကပ်နေရာ ခွဲထားဖို့ |
| **အလယ်ဗဟို ရှုပ်ထွေးနေရာ** | တွေ့ဆုံမှုဖြစ်စေဖို့ |
| **အစွန်းမှာ လွတ်ကွက်မရှိရ** | ထောင့်ထဲပုန်းနေတာ ကာကွယ်ဖို့ |
| **အရွယ်** | ကစားသမား ၁၂ ယောက်အတွက် ~80×80 unit |

```ts
// components/metaverse/maps/arena.ts
export const ARENA: MapDef = {
  id: 'arena',
  name: 'ရင်ပြင်',
  worldRadius: 40,
  palette: { /* ★ ကာတွန်း storybook — toon.js နဲ့ တစ်သားတည်း */ },
  zones: [
    { id: 'plaza',    name: 'မြို့လယ်',   x: 0,   z: 0,   r: 12, cover: 'medium' },
    { id: 'market',   name: 'ဈေး',       x: -22, z: -16, r: 10, cover: 'high'   },
    { id: 'tower',    name: 'မျှော်စင်',  x: 24,  z: -18, r: 8,  cover: 'low', height: 8 },
    { id: 'garden',   name: 'ဥယျာဉ်',    x: 18,  z: 20,  r: 11, cover: 'high'   },
    { id: 'ruins',    name: 'အပျက်အစီး', x: -20, z: 22,  r: 9,  cover: 'medium' },
  ],
  spawns: [ /* ★ ၁၆ နေရာ — zone အလိုက်ဖြန့် */ ],
  // ★ ကစားချိန်မှာ ရာသီဥတု မပြောင်းစေရ — မျှတမှုပျက်တယ်
  weather: { default: 'clear', allowed: ['clear'] },
  // ★ နေ့/ည မပြောင်းစေရ (ည မှာ ပုန်းရလွယ်လွန်းတယ်)
  timeOfDay: { fixed: 0.32 },
};
```

> ★ **ရာသီဥတု/နေ့ည ကို ပုံသေထားရတဲ့အကြောင်း** — ပွဲအလယ်မှာ ည ဖြစ်သွားရင် ကစားသမားတချို့ အားသာသွားတယ်။ Competitive game မှာ အခြေအနေတူညီရမယ်။

## A2.2 Cover System

```ts
/** ★ Cover မှာ အမျိုးအစား ၃ မျိုးရှိရမယ် —
 *  full  — လုံးဝကွယ် (နံရံ)
 *  half  — ကုန်းလျှိုးရင်ကွယ် (အုတ်တံတိုင်း၊ လှည်း)
 *  soft  — မြင်ရခက် ဒါပေမယ့် ကျည်ဖောက် (ချုံ၊ ပိတ်ကား) */
export type CoverKind = 'full' | 'half' | 'soft';
```
- `full`/`half` → collider **နဲ့** raycast layer နှစ်ခုလုံး
- `soft` → collider မရှိ၊ raycast မတားဘူး၊ ဒါပေမယ့် ★ ပစ်မှတ်မြင်ရမှု လျော့စေတယ်

## A2.3 Acceptance Criteria
- [ ] Zone ၅ ခု၊ လမ်းကြောင်း ၃ ခုအနည်းဆုံး
- [ ] ★ ကွယ်လို့မရတဲ့ လွင်ပြင်ကြီး မရှိ (၈ unit ကျော် ဘာမှမရှိတဲ့နေရာ)
- [ ] Spawn ၁၆ ခု — တစ်ခုချင်း ၈ unit အနည်းဆုံးကွာ
- [ ] ★ Spawn မှာ ရန်သူမြင်နိုင်တဲ့ အနေအထား မဖြစ်စေရ (spawn camping)
- [ ] ရာသီဥတု/အချိန် ပုံသေ
- [ ] Map ကို bot ၁၂ ယောက်နဲ့ စမ်း — ပိတ်မိတဲ့နေရာ မရှိ

---

# Phase A3 — Match Lifecycle

## A3.1 State Machine

```
        ┌──────────────────────────────────────────────┐
        ▼                                              │
   ┌────────┐  ကစားသမား≥3   ┌──────────┐  ၂၀s   ┌──────┐
   │ WAITING├──────────────►│ COUNTDOWN├───────►│ LIVE │
   └────────┘               └────┬─────┘        └───┬──┘
        ▲                        │ <3 ဖြစ်သွား       │ အနိုင်ရ /
        │                        ▼                  │ အချိန်ကုန်
        │                   ┌────────┐              ▼
        └───────────────────┤ ENDED  │◄─────────────┘
              ၁၅s ပြီးရင်     └────────┘  (ရလဒ်ပြ)
```

```ts
export type MatchState = 'waiting' | 'countdown' | 'live' | 'ended';

export type Match = {
  id: string;                     // uuid — DB မှာသိမ်းဖို့
  roomId: string;
  state: MatchState;
  startedAt: number | null;
  endsAt: number | null;          // matchMinutes အရ
  players: Map<string, MatchPlayer>;   // ★ userId (Cognito sub) key
  spectators: Set<string>;
  cycle: TargetCycle;
};
```

## A3.2 ★ ကစားသမား ဝင်/ထွက်

```
【ဝင်】
Open world (city) → portal နှိပ် → room='arena' ကူး
  · WAITING/COUNTDOWN → ★ ကစားသမားအဖြစ်ဝင်
  · LIVE              → ★ spectator အဖြစ်ဝင် (နောက်ပွဲစောင့်)
  · ENDED             → ရလဒ်ကြည့်၊ နောက်ပွဲစောင့်

【ထွက်】
· ကိုယ်တိုင်ထွက် → open world ကို ပြန်
· ★ ပွဲအလယ်ထွက်ရင် — သံသရာ ပြန်ချိတ် + ၅ မိနစ် ပြန်ဝင်ခွင့်ပိတ် (rage quit ကာကွယ်)
· Disconnect → ၆၀ စက္ကန့် နေရာချန်ထား (reconnect ရရင် ပြန်ဝင်လို့ရ)
```

> ★ **Reconnect grace period က မဖြစ်မနေ** — Mae Sot ဘက် network မတည်ငြိမ်လို့ ပြတ်တာနဲ့ ပွဲထဲက ထုတ်ပစ်ရင် ကစားလို့မရတော့ဘူး။

## A3.3 Acceptance Criteria
- [ ] ကစားသမား ၃ ယောက်ပြည့်ရင် countdown စ
- [ ] Countdown အလယ် ၃ ယောက်အောက်ကျရင် WAITING ပြန်
- [ ] LIVE မှာဝင်ရင် spectator ဖြစ်
- [ ] ★ ပြတ်သွားပြီး ၆၀ စက္ကန့်အတွင်း ပြန်ဝင်ရင် အမှတ်မပျောက်
- [ ] ပွဲပြီးရင် ၁၅ စက္ကန့်ရလဒ်ပြပြီး WAITING ပြန်
- [ ] ပွဲအလယ် ကစားသမားအားလုံးထွက်ရင် match ရှင်းပစ်၊ room ကျန်

---

# Phase A4 — ★ Combat System (အရေးအကြီးဆုံး)

## A4.1 Server-Authoritative Hit Registration

**လက်ရှိ prototype ရဲ့ အကြီးဆုံးအမှားကို ဒီမှာပြင်တယ်။**

```ts
/* ★ Client က ray ရဲ့ "ဦးတည်ချက်" ပဲပို့တယ် — "ဘယ်သူထိလဲ" မပို့ရ */
type FireInput = {
  seq: number;              // client sequence — ထပ်ပို့တာကာကွယ်
  origin: [number, number, number];
  dir: [number, number, number];    // normalize ပြီးသား
  clientTime: number;               // ★ lag comp အတွက်
  weapon: WeaponId;
};
```

```ts
/* Server ဘက် */
function handleFire(match: Match, shooter: MatchPlayer, input: FireInput) {
  // ၁။ အခြေခံစစ်ဆေးမှု
  if (match.state !== 'live') return;
  if (!shooter.alive) return;
  if (input.seq <= shooter.lastSeq) return;        // ★ replay ကာကွယ်
  shooter.lastSeq = input.seq;

  const w = WEAPONS[input.weapon];
  const now = Date.now();
  if (now - shooter.lastFire < w.fireMs) return;   // ★ rapid-fire ကာကွယ်
  if (w.ammo !== Infinity && shooter.ammo[input.weapon] <= 0) return;

  // ၂။ ★ Origin က ကစားသမားနေရာနဲ့ နီးရမယ် (teleport-shoot ကာကွယ်)
  const dOrigin = dist3(input.origin, shooter.pos);
  if (dOrigin > 2.5) { flagSuspicious(shooter, 'origin_mismatch'); return; }

  // ၃။ ★ LAG COMPENSATION — ပစ်ချိန်က အခြေအနေကို ပြန်ခေါ်
  const rewindMs = clamp(now - input.clientTime + shooter.rttHalf, 0, 250);
  const snapshot = match.history.at(now - rewindMs);

  // ၄။ ★ Server မှာ ray ပြန်တွက် — ဒါက အဓိကအချက်
  const hit = raycastServer(snapshot, input.origin, input.dir, w.range, shooter.userId);
  if (!hit) { broadcastShot(match, shooter, input, null); return; }

  // ၅။ ★ နံရံကွယ်နေလား စစ် (wallhack ကာကွယ်)
  if (isBlockedByGeometry(input.origin, hit.point)) return;

  applyDamage(match, shooter, hit.playerId, w, hit.part, hit.distance);
}
```

## A4.2 ★ Hitbox — ရိုးရှင်းပြီး တိကျရမယ်

```ts
/* Mesh နဲ့ raycast မလုပ်ဘဲ ရိုးရှင်းတဲ့ပုံသဏ္ဌာန် ၃ ခုသာ —
   server မှာ မြန်ပြီး client/server တူညီစေတယ် */
const HITBOX = {
  head:  { type: 'sphere',  center: [0, 1.72, 0], radius: 0.24 },
  body:  { type: 'capsule', a: [0, 0.85, 0], b: [0, 1.50, 0], radius: 0.32 },
  legs:  { type: 'capsule', a: [0, 0.05, 0], b: [0, 0.85, 0], radius: 0.24 },
};
const PART_MULT = { head: 2.0, body: 1.0, legs: 0.75 };
```

> ★ Client မှာလည်း **ဒီ hitbox အတိုင်းပဲ** ပြရမယ် (debug mode မှာ မြင်ရအောင်)။ Mesh နဲ့ hitbox မတူရင် "ထိတယ်ထင်ပေမယ့် မထိဘူး" ဖြစ်တယ်။

## A4.3 Snapshot History

```ts
/** ★ ၁ စက္ကန့်စာ (20Hz = 20 snapshot) သိမ်းထားတယ် */
class PositionHistory {
  private buf: { t: number; positions: Map<string, Vec3 & { ry: number }> }[] = [];
  push(t: number, players: Map<string, MatchPlayer>) { /* ring buffer, max 20 */ }
  at(t: number) { /* ★ နှစ်ခုကြားဆို interpolate */ }
}
```

## A4.4 Anti-Cheat Layer

| Cheat | ကာကွယ်နည်း |
|---|---|
| Aimbot | ★ Server ray — client ရဲ့ targetId မယုံ |
| Wallhack (ပစ်တာ) | ★ Geometry occlusion စစ် |
| Wallhack (မြင်တာ) | ⚠️ ★ **Interest management** — ၄၀ unit ကျော် ဒါမှမဟုတ် ကွယ်နေရင် **နေရာမပို့** |
| Speed hack | Movement delta ≤ maxSpeed × 1.4 |
| Teleport | Origin mismatch စစ် |
| Rapid fire | Server cooldown |
| Packet replay | `seq` monotonic |

> ★ **Interest management က aimbot ကို ကာကွယ်တဲ့ အခိုင်မာဆုံးနည်း** — client မှာ data မရှိရင် hack လုပ်လို့မရဘူး။ Prototype မှာ ကစားသမားအားလုံးရဲ့နေရာ အားလုံးဆီပို့နေတယ် — ဒါက အခြေခံအမှားပါ။

## A4.5 Acceptance Criteria
- [ ] ★ Client က `targetId` ပို့တာ လုံးဝမလက်ခံ
- [ ] ★ နံရံနောက်ကနေ ပစ်လို့မရ
- [ ] Ping 150ms မှာ ရွေ့နေတဲ့ပစ်မှတ်ကို ပစ်ရင် ထိတယ် (lag comp)
- [ ] Rewind ၂၅၀ms ထက်မကျော်
- [ ] ★ ၄၀ unit ကျော် ကစားသမားရဲ့နေရာ client ဆီမရောက် (packet စစ်)
- [ ] Speed hack စမ်းရင် ငြင်းပြီး log ဝင်
- [ ] Hitbox ၃ ခု၊ client debug view နဲ့ တူညီ

---

# Phase A5 — Networking (Snapshot Model)

## A5.1 ★ လက်ရှိပြဿနာနှင့် ဖြေရှင်းချက်

```
❌ လက်ရှိ — move ရောက်တိုင်း ချက်ချင်း broadcast
   ကစားသမား ၂၀ × 15Hz × ၂၀ ယောက်ဆီ = ၆,၀၀၀ msg/s

✅ စံနည်း — Server tick 20Hz၊ snapshot တစ်ခုတည်း
   ၂၀ ယောက် × 20Hz = ၄၀၀ msg/s (★ ၉၃% လျော့)
```

## A5.2 Protocol

**Client → Server**
| Type | Payload | Rate |
|---|---|---|
| `input` | `{ seq, mv:[x,z], yaw, pitch, jump, run }` | 30Hz |
| `fire` | `{ seq, origin, dir, clientTime, weapon }` | ပစ်တိုင်း |
| `switchWeapon` | `{ weapon }` | — |
| `reload` | `{}` | — |
| `joinMatch` / `leaveMatch` | `{}` | — |

**Server → Client**
| Type | Payload | Rate |
|---|---|---|
| `snapshot` | `{ t, players:[{id,x,z,y,ry,st}] }` ★ မြင်ရသူများသာ | 20Hz |
| `personal` | `{ hp, ammo, target, kills, score }` | ပြောင်းမှ |
| `event` | `{ kind:'shot'\|'hit'\|'kill'\|'explosion', ... }` | ဖြစ်တိုင်း |
| `matchState` | `{ state, endsAt, scoreboard }` | ပြောင်းမှ |

## A5.3 Client-Side Prediction + Reconciliation

```ts
/* ★ ကိုယ့်လှုပ်ရှားမှုကို server မစောင့်ဘဲ ချက်ချင်းပြ (prediction)
   Server က တန်ဖိုးပြန်လာရင် ကွာရင် ညှိ (reconciliation) */
const pending: InputCmd[] = [];

function onSnapshot(snap) {
  const authoritative = snap.players.find(p => p.id === myId);
  if (!authoritative) return;
  // ★ Server အတည်ပြုပြီးသား input တွေ ဖယ်
  while (pending.length && pending[0].seq <= snap.ackSeq) pending.shift();
  // ★ Server နေရာကနေ မတင်ပြသေးတဲ့ input တွေ ပြန်အသုံးချ
  let pos = { ...authoritative };
  for (const cmd of pending) pos = simulateMove(pos, cmd);
  // ★ ကွာဟမှုနည်းရင် ညင်သာစွာဆွဲ၊ များရင် ချက်ချင်းရွှေ့
  const err = dist(myPos, pos);
  err > 2 ? snapTo(pos) : lerpTo(pos, 0.2);
}
```

**တခြားကစားသမား** — snapshot ၂ ခုကြား interpolate (100ms buffer)။ ★ Extrapolate မလုပ်ပါနဲ့ — မှားရင် ခုန်သွားတယ်။

## A5.4 Acceptance Criteria
- [ ] Server tick 20Hz တည်ငြိမ်
- [ ] ★ ကစားသမား ၁၂ ယောက်မှာ bandwidth < 30 KB/s တစ်ယောက်
- [ ] ကိုယ့်လှုပ်ရှားမှု ping မခံစားရ (prediction)
- [ ] ★ Server နဲ့ကွာရင် ညင်သာစွာညှိ (ခုန်မသွား)
- [ ] တခြားသူ ရွေ့လျားမှု ချောမွေ့ (interpolation)
- [ ] Packet ပျောက်ရင် ခဏနေ ပြန်ကောင်း

---

# Phase A6 — Avatar + Combat Gear

## A6.1 ★ Avatar တစ်ခုတည်း မူဝါဒ

```
❌ လက်ရှိ — createToonFighter() က avatar အသစ်ဆောက်တယ်
             ကစားသမားရဲ့ metaverse avatar ပျောက်သွားတယ်

✅ စံနည်း — metaverse avatar (AvatarConfig) ကိုပဲသုံးပြီး
             combat gear ကို attachment အဖြစ်ထပ်တင်
```

```ts
export function applyCombatGear(avatar: Avatar, gear: CombatGear) {
  // ★ Vest → torso · Helmet → neck · Weapon → forearmR
  //   အဆစ်မှာကပ်လို့ animation လိုက်လှုပ်တယ်
  if (gear.vest)   attach(avatar.joints.torso, buildVest(gear.vest));
  if (gear.helmet) attach(avatar.joints.neck,  buildHelmet(gear.helmet));
  attach(avatar.joints.forearmR, buildWeapon(gear.weapon));
}
```

## A6.2 ★ Toon Style ကို Arena မှာသာ

Prototype ရဲ့ `toon.js` က အနုပညာအရ ကောင်းပါတယ် — ဒါပေမယ့် metaverse map တွေက realistic-ish ဖြစ်နေတယ်။

**ဆုံးဖြတ်ချက်** — Arena map ဝင်တဲ့အခါ **material ပဲပြောင်း** (mesh မဆောက်)

```ts
/** ★ Avatar mesh တူတူ၊ material ပဲ toon ပြောင်း
 *  ဒါက avatar identity မပျောက်ဘဲ arena ရဲ့ ခံစားချက်ရစေတယ် */
export function setToonStyle(avatar: Avatar, on: boolean) {
  avatar.group.traverse(o => {
    if (!o.isMesh) return;
    o.material = on ? toonVariant(o.userData.baseMaterial)
                    : o.userData.baseMaterial;
  });
  toggleOutlines(avatar, on);
}
```

## A6.3 ★ Gear မြင်သာမှု (game design အရ မဖြစ်မနေ)

```
ကာကွယ်မှုရှိသူကို ★ မြင်ရုံနဲ့ သိရမယ် —
· Vest ရှိ    → ရင်အုပ်ကာ + ပခုံးပတ်
· Helmet ရှိ  → ခေါင်းစွပ်
· Helmet မြင့် → ကာဖန်

မမြင်ရရင် — "ဘာလို့ မသေတာလဲ" ဆိုပြီး မတရားသလို ခံစားရတယ်
```

## A6.4 Acceptance Criteria
- [ ] ★ Arena ထဲမှာ ကိုယ့် avatar customization မပျောက်
- [ ] Gear က အဆစ်မှာကပ်ပြီး animation လိုက်လှုပ်
- [ ] Toon style က material ပဲပြောင်း (mesh အသစ်မဆောက်)
- [ ] ★ Gear ရှိမရှိ အဝေးကနေ မြင်ရ
- [ ] Arena ကထွက်ရင် ပုံမှန် material ပြန်ဖြစ်
- [ ] Gear ပြောင်းရင် memory မတက် (dispose စစ်)

---

# Phase A7 — Entitlement (Skin ↔ G-Pay ↔ NFT)

## A7.1 ⚠️ Pay-to-Win ဆုံးဖြတ်ချက်

Prototype မှာ skin ဝယ်ရင် armor တိုးတယ် (တောင်းဆိုချက်အတိုင်း)။ ဒါကို **config နဲ့ ဖွင့်/ပိတ်လို့ရအောင်** ရေးပါ:

```ts
export const COMBAT_BALANCE = {
  /** 'cosmetic'   — အရောင်/ပုံစံပဲကွာ (★ အကြံပြု)
   *  'light'      — 0–12% အနည်းငယ်
   *  'full'       — 0–45% (prototype အတိုင်း) */
  mode: 'cosmetic' as 'cosmetic' | 'light' | 'full',
};

export function effectiveProtection(skin: SkinDef) {
  switch (COMBAT_BALANCE.mode) {
    case 'cosmetic': return { armor: 0, helmet: 0 };
    case 'light':    return { armor: skin.armor * 0.28, helmet: skin.helmet * 0.28 };
    case 'full':     return { armor: skin.armor, helmet: skin.helmet };
  }
}
```

> ★ **ရိုးရိုးသားသားအကြံပြုချက်** — `cosmetic` နဲ့စပါ။ Free Fire, PUBG, Fortnite အားလုံး cosmetic-only ဖြစ်တာ အကြောင်းရှိပါတယ်: ဝယ်နိုင်သူပဲနိုင်တဲ့ game မှာ ကစားသမားအသစ် မကျန်တော့ဘူး။ Gwave မှာ ကစားသမား အခြေခံမရှိသေးလို့ ဒါက ပိုအရေးကြီးတယ်။
>
> ကာကွယ်မှုကို **gameplay ကနေရအောင်** လုပ်ပါ — armor pickup ကို map ထဲမှာချထားရင် ဝယ်စရာမလိုဘဲ တန်းတူယှဉ်ပြိုင်လို့ရတယ်။

## A7.2 Entitlement Resolution

```ts
/** ★ Server-side သာ — client က "ငါပိုင်တယ်" ပြောတာ မယုံရ
 *  ရင်းမြစ် ၃ ခု: အခမဲ့ · G-Pay (mv_inventory) · NFT (web3_balances) */
async function resolveSkins(db, userId, wallet) {
  const owned = new Set(FREE_SKINS);
  const inv = await db.query(
    `SELECT sku FROM mv_inventory WHERE user_id=$1 AND sku LIKE 'skin_%'`, [userId]);
  inv.rows.forEach(r => owned.add(r.sku.replace('skin_', '')));
  if (wallet) {
    const nft = await db.query(
      `SELECT token_id FROM web3_balances WHERE owner=$1 AND balance>0`, [wallet.toLowerCase()]);
    nft.rows.forEach(r => { const s = NFT_SKIN_MAP[r.token_id]; if (s) owned.add(s); });
  }
  return owned;
}
```

## A7.3 Acceptance Criteria
- [ ] ★ မပိုင်တဲ့ skin ကို API တိုက်ရိုက်ခေါ်ပြီး သုံးလို့မရ
- [ ] `COMBAT_BALANCE.mode` ပြောင်းရုံနဲ့ balance ပြောင်း
- [ ] G-Pay နဲ့ဝယ်ထားတဲ့ skin ပေါ်လာ
- [ ] NFT ပိုင်တဲ့ skin ပေါ်လာ
- [ ] Wallet မရှိသူ အခမဲ့ skin နဲ့ ကစားလို့ရ
- [ ] Web3/G-Pay ကျဆုံးရင် အခမဲ့ skin နဲ့ ဆက်ကစားလို့ရ

---

# Phase A8 — Persistence & Leaderboard

```sql
CREATE TABLE mv_matches (
  id           UUID PRIMARY KEY,
  room_id      TEXT NOT NULL,
  mode         TEXT NOT NULL DEFAULT 'assassin',
  started_at   TIMESTAMPTZ NOT NULL,
  ended_at     TIMESTAMPTZ,
  winner_user  TEXT,
  player_count INTEGER NOT NULL
);

CREATE TABLE mv_match_players (
  match_id     UUID NOT NULL REFERENCES mv_matches(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  kills        INTEGER NOT NULL DEFAULT 0,   -- ပစ်မှတ်မှန်
  wrong_kills  INTEGER NOT NULL DEFAULT 0,
  deaths       INTEGER NOT NULL DEFAULT 0,
  score        INTEGER NOT NULL DEFAULT 0,
  headshots    INTEGER NOT NULL DEFAULT 0,
  placement    INTEGER,
  left_early   BOOLEAN NOT NULL DEFAULT false,   -- ★ rage quit မှတ်
  PRIMARY KEY (match_id, user_id)
);
CREATE INDEX ON mv_match_players (user_id);

/* ★ Aggregate — leaderboard query မြန်အောင် */
CREATE TABLE mv_player_stats (
  user_id      TEXT PRIMARY KEY,
  matches      INTEGER NOT NULL DEFAULT 0,
  wins         INTEGER NOT NULL DEFAULT 0,
  kills        INTEGER NOT NULL DEFAULT 0,
  wrong_kills  INTEGER NOT NULL DEFAULT 0,
  deaths       INTEGER NOT NULL DEFAULT 0,
  headshots    INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Leaderboard ၂ မျိုး** — ★ တစ်ပတ်စာ (အဓိကပြ) နဲ့ all-time။ တစ်ပတ်စာက နောက်ကျစသူတွေအတွက် အားပေးမှုဖြစ်တယ်။

★ **ဆုလာဘ်က cosmetic သာ** — ငွေ/crypto ဆု ထည့်ရင် လောင်းကစားဥပဒေနဲ့ ထိတွေ့နိုင်တယ်။

## Acceptance Criteria
- [ ] ပွဲပြီးတိုင်း DB မှာသိမ်း
- [ ] ★ Server restart ရင် stat မပျောက်
- [ ] Leaderboard ၂ မျိုး
- [ ] ပွဲအလယ်ထွက်တာ မှတ်တမ်းတင်
- [ ] ★ ဆုက cosmetic သာ

---

# Phase A9 — Client Structure

```
components/metaverse/
├─ game/
│  ├─ GameModeProvider.tsx     # room type အလိုက် UI ပြောင်း
│  ├─ assassin/
│  │  ├─ AssassinHUD.tsx       # ပစ်မှတ် · hp · အမှတ် · killfeed
│  │  ├─ WeaponBar.tsx
│  │  ├─ Scoreboard.tsx        # Tab နှိပ်ရင်
│  │  ├─ LobbyPanel.tsx        # စောင့်ခန်း
│  │  ├─ ResultPanel.tsx
│  │  └─ useCombat.ts          # ပစ်ခတ်မှု input + prediction
│  ├─ combat/
│  │  ├─ hitbox.ts             # ★ server နဲ့ တူညီရမယ်
│  │  ├─ weapons.ts            # ★ server နဲ့ တူညီရမယ်
│  │  └─ effects.ts            # muzzle · ဒဏ်ရာ · ပေါက်ကွဲမှု
│  └─ arena/
│     ├─ arenaMap.ts
│     └─ cover.ts
```

## A9.1 ★ Shared Constants (မဖြစ်မနေ)

```ts
// shared/combat.ts — client နဲ့ server ★ တစ်ခုတည်းက import လုပ်ရမယ်
export const WEAPONS = { /* ... */ } as const;
export const HITBOX  = { /* ... */ } as const;
```
> ★ Prototype မှာ weapon တန်ဖိုးတွေ client/server နှစ်နေရာမှာ ရေးထားတယ် — တစ်ဖက်ပြင်ပြီး တစ်ဖက်မေ့ရင် bug ဖြစ်တယ်။ **တစ်ခုတည်းက import လုပ်ပါ။**

## A9.2 HUD လိုအပ်ချက်
- ပစ်မှတ်နာမည် (★ ဖုန်းမှာလည်း ဖတ်ရလွယ်ရမယ်)
- HP + gear · လက်နက် + ကျည် · အမှတ် `2/3`
- Kill feed · ★ ပွဲကျန်ချိန်
- ★ Crosshair — ပစ်မှတ်ပေါ်ရောက်ရင် အရောင်ပြောင်း (ဒါက အသတ်မှားတာ လျှော့စေတယ်)
- Tab/ဆွဲ → scoreboard

## A9.3 Acceptance Criteria
- [ ] Component တွေ ခွဲထား (monolithic HTML မဟုတ်)
- [ ] ★ Weapon/hitbox constant တစ်နေရာတည်းက
- [ ] Room type ကူးရင် HUD အလိုအလျောက်ပြောင်း
- [ ] iPhone SE (375px) မှာ HUD မဖုံး
- [ ] Arena ကထွက်ရင် combat UI ပျောက်

---

# ၂။ ⚠️ ဘေးကင်းရေးနှင့် စည်းမျဉ်း

| အချက် | လိုအပ်ချက် |
|---|---|
| **ကလေးများ** | ★ Cartoon style၊ သွေးမပါ။ အသက်ကန့်သတ်ချက် စဉ်းစားပါ (Play Store rating: Teen) |
| **ဆဲဆိုမှု** | ★ Report/mute/block ခလုတ် — social room နဲ့ တူညီစွာ |
| **နာမည်** | ဆဲစကား filter |
| **ဆုလာဘ်** | ★ Cosmetic သာ — ငွေဆု ထည့်ရင် လောင်းကစားဖြစ်နိုင် |
| **ဝင်ကြေး** | ★ မယူပါနဲ့ — ဝင်ကြေး + ဆု = လောင်းကစား |
| **Social room** | ★ လက်နက်/ထိခိုက်မှု လုံးဝမရှိရ |

---

# ၃။ Phase အစဉ်နှင့် အလုပ်ချိန်

| Phase | ခေါင်းစဉ် | ခန့်မှန်း | မှီခို |
|---|---|---|---|
| A1 | Room type စနစ် | 2 ရက် | Metaverse Phase 2 |
| A2 | Arena map | 4 ရက် | Phase 8 (map စနစ်) |
| A3 | Match lifecycle | 3 ရက် | A1 |
| A4 | ★ Combat system | 5 ရက် | A1, A3 |
| A5 | Networking (snapshot) | 4 ရက် | A4 |
| A6 | Avatar + gear | 3 ရက် | Phase 15 |
| A7 | Entitlement | 2 ရက် | G-Pay, Web3 |
| A8 | Persistence | 2 ရက် | Phase 4 |
| A9 | Client structure | 4 ရက် | အားလုံး |

**စုစုပေါင်း ~29 ရက်**

## ကြိုတင်လိုအပ်ချက် (မရှိရင် မစရ)

```
✅ Phase 2  — WebSocket server
✅ Phase 3  — Cognito auth
✅ Phase 4  — RDS persistence
✅ Phase 8  — Map စနစ်
⬜ Phase 15 — Avatar စနစ် (A6 အတွက်)
```

---

# ၄။ ⚠️ နောက်ဆုံးအကြံပြုချက်

**၁။ ဒါက ၂၉ ရက်စာအလုပ်ပါ** — metaverse ရဲ့ အခြေခံ (Phase 0–13) ပြီးမှ လုပ်သင့်တယ်။ Social world မှာ ကစားသမား မရှိသေးဘဲ competitive shooter ဆောက်ရင် ကစားဖော်မရှိလို့ ဗလာဖြစ်နေမယ်။

**၂။ Prototype ကို သင်ခန်းစာအဖြစ်ထားပါ** — ဖျက်ပစ်ရမယ့်အရာမဟုတ်ဘဲ ဘာလိုအပ်လဲ သိရအောင် ဆောက်ခဲ့တာလို့ မှတ်ယူပါ။ ပစ်မှတ်သံသရာ algorithm နဲ့ toon အနုပညာစနစ် နှစ်ခုက တကယ်ကောင်းလို့ ပြန်သုံးပါ။

**၃။ အလွယ်ဆုံးလမ်း** — Competitive shooter မလုပ်ဘဲ **social party game** (ပိတ်ကန်၊ ဝှက်တမ်းရှာ၊ အပြေးပြိုင်) လုပ်ရင် —
- Lag compensation မလို
- Anti-cheat ရိုးရှင်း
- ကစားသမား နည်းနည်းနဲ့ ပျော်စရာဖြစ်
- **~၈ ရက်နဲ့ပြီး**

Assassin ကို ဒီအဆင့်မှာ လုပ်မယ်ဆိုရင် **combat ကို ရိုးရှင်းအောင်လုပ်ပါ** — hitscan အစား ဖြေးဖြေးပျံတဲ့ projectile (ဗုံး၊ လေးမြား) သုံးရင် lag compensation မလိုတော့ဘဲ ပျော်စရာလည်း မလျော့ပါဘူး။

---

**စာရွက်စာတမ်းဗားရှင်း** — Assassin Integration v1.0
**ရေးသားသည့်ရက်** — 2026-08-02
**ဆက်စပ်ဖိုင်** — `GWAVE_METAVERSE_BUILD.md` · `GWAVE_METAVERSE_BUILD_PART2.md`
**အစားထိုးခံရမည့်ဖိုင်** — ~~`assassin-game.html`~~ · ~~`assassin-server.js`~~ (`assassin-toon.js` ကို ပြန်သုံးမည်)
