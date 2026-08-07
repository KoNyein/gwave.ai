// ============================================================
// server.js — Gwave Metaverse Server v2 (Server-Authoritative)
// ✔ Room-aware presence sync (15Hz)
// ✔ Movement validation — speed hack ကို snap-back ဖြင့် တားဆီး
// ✔ Strike Arena PvP — server ဘက်မှ hit validation (150ms lag rewind)
// ✔ HP / Kill / Respawn / Killboard — server က အပြီးသတ် ဆုံးဖြတ်
// ✔ Cognito JWT auth (gwave.cc တရားဝင် login) — AUTH_MODE=cognito
//
// Run (dev):     npm install && npm start                (auth မပါ)
// Run (တရားဝင်): AUTH_MODE=cognito AWS_REGION=ap-southeast-1 \
//                COGNITO_USER_POOL_ID=xxxx COGNITO_CLIENT_ID=xxxx npm start
// ============================================================
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8787;
const TICK_HZ = 15;
const AUTH_MODE = process.env.AUTH_MODE || 'off'; // 'off' | 'cognito'
// STATS_URL (သို့) STATS_API_URL နှစ်မျိုးလုံး လက်ခံ
const STATS_URL = process.env.STATS_URL || process.env.STATS_API_URL || ''; // ဥပမာ http://127.0.0.1:8790
const GAME_KEY  = process.env.GAME_KEY || 'dev-key';

// ---- ဂိမ်းစည်းမျဉ်း (server ကသာ ပိုင်သည့် တန်ဖိုးများ) ----
const MAX_SPEED = 9;          // m/s (RUN 8 + ခွင့်လွှတ်ချက်)
const SHOOT_COOLDOWN = 110;   // ms
const SHOOT_RANGE = 60;       // m
const REWIND_MS = 150;        // lag compensation
const BODY_RADIUS = 0.85, HEAD_RADIUS = 0.38;
const DMG_BODY = 34;
const RESPAWN_MS = parseInt(process.env.RESPAWN_MS) || 4000;
const STRIKE_SPAWNS = [[0,0,26],[-25,0,-25],[25,0,-25],[-25,0,25],[25,0,25],[0,0,-28]];

// ---- Cognito JWT verifier (AUTH_MODE=cognito ဖြစ်မှသာ) ----
let verifyToken = null;
if (AUTH_MODE === 'cognito') {
  const { createRemoteJWKSet, jwtVerify } = require('jose');
  const region = process.env.AWS_REGION;
  const poolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;
  if (!region || !poolId) {
    console.error('❌ AUTH_MODE=cognito — AWS_REGION နှင့် COGNITO_USER_POOL_ID လိုအပ်သည်');
    process.exit(1);
  }
  const issuer = `https://cognito-idp.${region}.amazonaws.com/${poolId}`;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  verifyToken = async (token) => {
    const { payload } = await jwtVerify(token, jwks, { issuer });
    if (clientId && payload.aud !== clientId && payload.client_id !== clientId) {
      throw new Error('client mismatch');
    }
    return payload;
  };
  console.log('🔐 Cognito auth ဖွင့်ထား —', issuer);
}

// ---- State ----
const wss = new WebSocketServer({ port: PORT });
const players = new Map();
let nextId = 1;
const now = () => Date.now();

function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function toRoom(room, msg, exceptId = null) {
  for (const [id, pl] of players)
    if (pl.room === room && id !== exceptId) send(pl.ws, msg);
}

// ---- Lag compensation — 150ms အတိတ်က target နေရာကို ပြန်တွက် ----
function rewindPos(pl, t) {
  const h = pl.history;
  if (!h.length) return pl.p;
  for (let i = h.length - 1; i > 0; i--) {
    if (h[i - 1].t <= t && t <= h[i].t) {
      const a = h[i - 1], b = h[i];
      const k = (t - a.t) / Math.max(1, b.t - a.t);
      return [a.p[0] + (b.p[0]-a.p[0])*k, a.p[1] + (b.p[1]-a.p[1])*k, a.p[2] + (b.p[2]-a.p[2])*k];
    }
  }
  return h[0].t > t ? h[0].p : pl.p;
}

// ---- Ray နှင့် အမှတ်တစ်ခုကြား perpendicular အကွာအဝေး ----
function rayPointDist(o, d, p, maxT) {
  const wx = p[0]-o[0], wy = p[1]-o[1], wz = p[2]-o[2];
  let t = wx*d[0] + wy*d[1] + wz*d[2];
  t = Math.max(0, Math.min(maxT, t));
  const cx = o[0]+d[0]*t, cy = o[1]+d[1]*t, cz = o[2]+d[2]*t;
  return Math.hypot(p[0]-cx, p[1]-cy, p[2]-cz);
}

function respawn(id) {
  const pl = players.get(id);
  if (!pl) return;
  pl.hp = 100; pl.alive = true;
  pl.p = [...STRIKE_SPAWNS[Math.floor(Math.random()*STRIKE_SPAWNS.length)]];
  pl.history = [];
  toRoom(pl.room, { t: 'respawn', id, p: pl.p });
  send(pl.ws, { t: 'respawn', id, p: pl.p });
}

// ---- Stats/Economy API ချိတ်ဆက်မှုများ ----
// Cognito sub ရှိလျှင် sub ကို key အဖြစ်သုံး (account တစ်ခု = stats/wallet တစ်ခု)
const playerKey = (pl) => pl.sub || `dev:${pl.name}`;

async function api(path, body, method, putBody) {
  if (!STATS_URL) return null;
  const payload = putBody || body;
  try {
    const r = await fetch(`${STATS_URL}${path}`, {
      method: method || (body ? 'POST' : 'GET'),
      headers: { 'content-type': 'application/json', 'x-game-key': GAME_KEY },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    return await r.json();
  } catch (e) { console.warn('stats api fail:', path, e.message); return null; }
}

// Kill → XP+GP+streak bonus+quests — ရလဒ်ကို killer ဆီ toast ပြန်ပို့
async function reportKill(killer, victim, headshot) {
  const out = await api('/report/kill', {
    killer: { key: playerKey(killer), name: killer.name },
    victim: { key: playerKey(victim), name: victim.name },
    headshot, room: 'strike', streak: killer.streak,
  });
  if (!out?.ok) return;
  const total = (out.earned || []).reduce((s, e) => s + e.amount, 0);
  send(killer.ws, { t: 'points', balance: out.points, earnedTotal: total, earned: out.earned });
  for (const q of out.completedQuests || [])
    send(killer.ws, { t: 'quest_done', name_mm: q.name_mm, reward: q.reward });
}

// Login → daily_login quest + equipped skin ပြန်ယူ
async function reportLogin(pl, id) {
  const out = await api('/report/login', { player: { key: playerKey(pl), name: pl.name } });
  if (!out?.ok) return;
  if (out.equipped_skin) pl.skin = out.equipped_skin; // snapshot ထဲ ပါသွားမည်
  send(pl.ws, { t: 'points', balance: out.points, earnedTotal: 0 });
  for (const q of out.completedQuests || [])
    send(pl.ws, { t: 'quest_done', name_mm: q.name_mm, reward: q.reward });
}

wss.on('connection', (ws) => {
  const id = nextId++;
  let me = null;

  ws.on('message', async (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    // ---------- HELLO (+ Cognito auth) ----------
    if (msg.t === 'hello') {
      let name = String(msg.name || `Player-${id}`).slice(0, 24);
      let sub = null;
      if (verifyToken) {
        try {
          const claims = await verifyToken(msg.token || '');
          sub = claims.sub;
          name = claims['cognito:username'] || claims.username || claims.email || name;
        } catch (e) {
          send(ws, { t: 'auth_error', reason: 'token မမှန် (သို့) သက်တမ်းကုန်' });
          ws.close();
          return;
        }
      }
      me = {
        ws, name, sub, room: 'yangon',
        p: [0, 0, 8], yaw: 0,
        hp: 100, alive: true, kills: 0, deaths: 0, streak: 0, skin: null,
        lastT: now(), lastShot: 0, history: [],
      };
      players.set(id, me);
      send(ws, { t: 'welcome', id, name, auth: AUTH_MODE });
      toRoom(me.room, { t: 'join', id, name }, id);
      reportLogin(me, id); // 📊 daily_login quest + skin
      console.log(`[+] #${id} ${name}${sub ? ' (cognito)' : ''} — online: ${players.size}`);
      return;
    }
    if (!me) return;

    // ---------- STATE (movement validation) ----------
    if (msg.t === 's') {
      const t = now();
      const dt = Math.max(0.001, (t - me.lastT) / 1000);
      me.lastT = t;
      if (typeof msg.y === 'number') me.yaw = msg.y;

      const roomChanged = typeof msg.r === 'string' && msg.r !== me.room;
      if (roomChanged) {
        toRoom(me.room, { t: 'leave', id, name: me.name }, id);
        me.room = msg.r;
        me.hp = 100; me.alive = true; me.history = [];
        toRoom(me.room, { t: 'join', id, name: me.name }, id);
      }

      if (Array.isArray(msg.p) && msg.p.length === 3) {
        if (roomChanged) {
          me.p = msg.p; // room ကူးခြင်း = တရားဝင် teleport
        } else {
          const dx = msg.p[0]-me.p[0], dz = msg.p[2]-me.p[2];
          const dist = Math.hypot(dx, dz);
          if (dist <= MAX_SPEED * dt + 0.7) {
            me.p = msg.p; // ✅ ပုံမှန်ရွေ့လျားမှု
          } else {
            send(ws, { t: 'snapback', p: me.p }); // ❌ speed hack → ပြန်ဆွဲ
          }
        }
        me.history.push({ t, p: me.p });
        while (me.history.length && me.history[0].t < t - 1000) me.history.shift();
      }
      return;
    }

    // ---------- SHOOT (PvP — strike room သာ) ----------
    if (msg.t === 'shoot') {
      if (me.room !== 'strike' || !me.alive) return;
      const t = now();
      if (t - me.lastShot < SHOOT_COOLDOWN) return; // fire rate hack တားဆီး
      me.lastShot = t;

      const target = players.get(msg.target);
      if (!target || target.room !== 'strike' || !target.alive || msg.target === id) return;
      if (!Array.isArray(msg.o) || !Array.isArray(msg.d)) return;

      // Direction normalize
      const dl = Math.hypot(msg.d[0], msg.d[1], msg.d[2]) || 1;
      const d = [msg.d[0]/dl, msg.d[1]/dl, msg.d[2]/dl];

      // ပစ်သူနေရာနှင့် ဝေးလွန်း origin မဖြစ်ရ (aimbot origin hack တားဆီး)
      if (Math.hypot(msg.o[0]-me.p[0], msg.o[2]-me.p[2]) > 3) return;

      // Lag rewind — 150ms အတိတ်က target နေရာ
      const tp = rewindPos(target, t - REWIND_MS);
      const distToTarget = Math.hypot(tp[0]-msg.o[0], tp[2]-msg.o[2]);
      if (distToTarget > SHOOT_RANGE) return;

      const head = [tp[0], tp[1] + 1.7, tp[2]];
      const body = [tp[0], tp[1] + 1.0, tp[2]];
      let dmg = 0, headshot = false;
      if (rayPointDist(msg.o, d, head, SHOOT_RANGE) < HEAD_RADIUS) { dmg = 100; headshot = true; }
      else if (rayPointDist(msg.o, d, body, SHOOT_RANGE) < BODY_RADIUS) { dmg = DMG_BODY; }
      if (!dmg) return; // server က "ထိမမှန်" ဟု ဆုံးဖြတ်

      target.hp -= dmg;
      toRoom('strike', { t: 'hit', by: id, target: msg.target, dmg, hp: Math.max(0, target.hp), headshot });

      if (target.hp <= 0) {
        target.alive = false;
        target.deaths++; me.kills++;
        me.streak++; target.streak = 0; // 🔥 kill streak
        if (me.streak === 3) toRoom('strike', { t: 'streak', name: me.name, streak: 3, label: '🔥 Triple Kill!' });
        if (me.streak === 5) toRoom('strike', { t: 'streak', name: me.name, streak: 5, label: '⚡ Rampage!' });
        toRoom('strike', {
          t: 'kill', by: id, byName: me.name,
          target: msg.target, targetName: target.name, headshot,
          board: [...players.entries()]
            .filter(([, p]) => p.room === 'strike')
            .map(([pid, p]) => ({ id: pid, n: p.name, k: p.kills, d: p.deaths })),
        });
        reportKill(me, target, headshot); // 📊 RDS game.* ထဲ မှတ်တမ်းတင်
        setTimeout(() => respawn(msg.target), RESPAWN_MS);
      }
      return;
    }

    // ---------- Economy (Phase 0) — wallet / quests / buy ----------
    if (msg.t === 'wallet') {
      const [w, shop] = await Promise.all([
        api(`/wallet/${encodeURIComponent(playerKey(me))}`),
        api('/shop'),
      ]);
      send(ws, { t: 'wallet', wallet: w, shop: shop?.items || [] });
      return;
    }
    if (msg.t === 'quests') {
      const q = await api(`/quests/${encodeURIComponent(playerKey(me))}`);
      send(ws, { t: 'quests', quests: q?.quests || [] });
      return;
    }
    if (msg.t === 'buy') {
      const out = await api('/shop/buy', {
        player: { key: playerKey(me), name: me.name }, item_id: msg.item_id,
      });
      if (out?.ok && out.equipped_skin) me.skin = out.equipped_skin; // snapshot → အားလုံးမြင်
      send(ws, { t: 'buy_result', ...out });
      return;
    }

    // ---------- POS Redeem (GP ↔ ကော်ဖီဆိုင်) ----------
    if (msg.t === 'rewards') {
      const [cat, mine] = await Promise.all([
        api('/rewards'),
        api(`/redemptions/${encodeURIComponent(playerKey(me))}`),
      ]);
      send(ws, { t: 'rewards', catalog: cat?.rewards || [], redemptions: mine?.redemptions || [] });
      return;
    }
    if (msg.t === 'redeem') {
      const out = await api('/redeem', {
        player: { key: playerKey(me), name: me.name }, reward_id: msg.reward_id,
      });
      send(ws, { t: 'redeem_result', ...out });
      return;
    }

    // ---------- Personal Worlds (ကိုယ်ပိုင် metaverse ကမ္ဘာ) ----------
    if (msg.t === 'world_load') {
      const key = msg.key || playerKey(me); // key မပါလျှင် ကိုယ့်ကမ္ဘာ
      let w = await api(`/world/${encodeURIComponent(key)}`);
      if (w?.error && key === playerKey(me)) {
        // ကမ္ဘာအသစ် — မူလလွတ်လပ်သော starter world
        w = { owner_key: key, name: `${me.name} ရဲ့ကမ္ဘာ`,
              data: { ground: '#2c4a2e', sky: '#87b7d9', objects: [] } };
      }
      if (w?.owner_key) send(ws, { t: 'world', key: w.owner_key, name: w.name, data: w.data, own: key === playerKey(me) });
      else send(ws, { t: 'toast', text: '🌍 အဲဒီကမ္ဘာ မတွေ့ပါ' });
      return;
    }
    if (msg.t === 'world_save') {
      const out = await api('/world', null, 'PUT', {
        owner: { key: playerKey(me), name: me.name }, name: msg.name, data: msg.data,
      });
      send(ws, { t: 'world_save_result', ok: !!out?.ok, error: out?.error });
      return;
    }
    if (msg.t === 'worlds_recent') {
      const out = await api('/worlds/recent');
      send(ws, { t: 'worlds_recent', worlds: out?.worlds || [] });
      return;
    }

    // ---------- NFT Mint (Web3 Phase 1) ----------
    if (msg.t === 'nft_mint') {
      const out = await api('/nft/mint', {
        player: { key: playerKey(me), name: me.name },
        item_id: msg.item_id, wallet: msg.wallet,
      });
      send(ws, { t: 'nft_result', ...out });
      return;
    }
    if (msg.t === 'trophies') {
      const out = await api(`/trophies/${encodeURIComponent(playerKey(me))}`);
      send(ws, { t: 'trophies', ...out });
      return;
    }
    if (msg.t === 'trophy_mint') {
      const out = await api('/trophy/mint', {
        player: { key: playerKey(me), name: me.name },
        season: msg.season, wallet: msg.wallet,
      });
      send(ws, { t: 'trophy_result', ...out });
      return;
    }
    if (msg.t === 'nft_list') {
      const out = await api(`/nft/${encodeURIComponent(playerKey(me))}`);
      send(ws, { t: 'nft_list', mints: out?.mints || [], chain_mode: out?.chain_mode || 'off' });
      return;
    }
  });

  ws.on('close', () => {
    if (!me) return;
    players.delete(id);
    toRoom(me.room, { t: 'leave', id, name: me.name });
    console.log(`[-] #${id} ${me.name} — online: ${players.size}`);
  });
});

// ---- Snapshot loop ----
setInterval(() => {
  const byRoom = new Map();
  for (const [id, pl] of players) {
    if (!byRoom.has(pl.room)) byRoom.set(pl.room, []);
    byRoom.get(pl.room).push({ id, n: pl.name, p: pl.p, y: pl.yaw, hp: pl.hp, a: pl.alive ? 1 : 0, c: pl.skin || null });
  }
  for (const [room, list] of byRoom) toRoom(room, { t: 'snap', players: list });
}, 1000 / TICK_HZ);

console.log(`🌊 Gwave Metaverse Server v2.1 — ws://localhost:${PORT} | auth: ${AUTH_MODE} | stats: ${STATS_URL || 'off'} | tick: ${TICK_HZ}Hz`);
