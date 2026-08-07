// ============================================================
// api/server.js — Gwave Game Stats + Economy API v2
// (P7 ပုံစံ + Web3 Phase 0: off-chain points/inventory on RDS)
//
// ✔ XP/Kill stats           — game.player_stats + game.kill_events
// ✔ GP (Gwave Points)       — game.wallets + game.point_ledger  ← Phase 0
// ✔ Item Shop + Inventory   — game.inventory (skins စသည်)
// ✔ Daily Quests            — game.daily_quests (auto-claim + GP ဆု)
// ✔ RDS auto-migration ၊ DATABASE_URL မရှိလျှင် memory fallback
//
// GP စည်းမျဉ်း — kill +10 | headshot +5 | streak×3 +15 | streak×5 +30
//               | quest ဆုများ | ပစ္စည်းဝယ်လျှင် နုတ် (ledger မှတ်တမ်းအပြည့်)
// XP စည်းမျဉ်း — kill +25 | headshot +10 | death +5 (leaderboard ဂုဏ်သတ္တိ)
// ============================================================
const express = require('express');

const PORT = process.env.PORT || 8790;
const GAME_KEY = process.env.GAME_KEY || 'dev-key';
const XP = { kill: 25, headshot: 10, death: 5 };
const GP = { kill: 10, headshot: 5, streak3: 15, streak5: 30 };

// ---- Item Catalog (Phase 0 — off-chain; နောက်ပိုင်း NFT ပြောင်းရန် အဆင်သင့်) ----
const ITEMS = [
  { id: 'skin_jade',  name_mm: 'စိမ်းလဲ့ရောင် Skin',   price: 50,  type: 'skin', color: '#3ddc97' },
  { id: 'skin_gold',  name_mm: 'ရွှေရောင် Skin',        price: 100, type: 'skin', color: '#f5c542' },
  { id: 'skin_ruby',  name_mm: 'ပတ္တမြားရောင် Skin',    price: 150, type: 'skin', color: '#d8324a' },
  { id: 'skin_cyber', name_mm: 'Cyber ခရမ်းရောင် Skin', price: 200, type: 'skin', color: '#7f5cff' },
  { id: 'tag_vip',    name_mm: 'VIP နာမည်ကတ်',          price: 300, type: 'tag' },
];

// ---- Daily Quests ----
const QUESTS = [
  { id: 'daily_login',    name_mm: 'ဒီနေ့ ဂိမ်းထဲဝင်ပါ',        target: 1, reward: 10 },
  { id: 'daily_kills',    name_mm: 'ရန်သူ ၅ ယောက် ပစ်ချပါ',     target: 5, reward: 50 },
  { id: 'daily_headshot', name_mm: 'Headshot ၁ ချက် ရအောင်ပစ်ပါ', target: 1, reward: 30 },
];
const questById = Object.fromEntries(QUESTS.map(q => [q.id, q]));
const today = () => new Date().toISOString().slice(0, 10);

const chain = require('./chain');
const POS_KEY = process.env.POS_KEY || 'dev-pos-key';

// ---- Leaderboard Seasons (weekly/monthly) ----
const SEASON_GP = [500, 300, 150]; // 🥇🥈🥉 season ဆု GP
function isoWeek(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThu = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date - firstThu) / 864e5 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return { year: date.getUTCFullYear(), week };
}
const weeklyId  = (d = new Date()) => { const { year, week } = isoWeek(d); return `W${year}-${String(week).padStart(2, '0')}`; };
const monthlyId = (d = new Date()) => `M${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const prevWeeklyId  = () => weeklyId(new Date(Date.now() - 7 * 864e5));
const prevMonthlyId = () => { const d = new Date(); return monthlyId(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0))); };

// ---- POS Redeem Catalog (ကော်ဖီဆိုင် promo — GP ↔ လက်တွေ့ဆု) ----
const REWARDS = [
  { id: 'coffee_free',  name_mm: '☕ ကော်ဖီ ၁ ခွက် အခမဲ့ (Gwave Rooftop)', cost: 500 },
  { id: 'drink_disc20', name_mm: '🧋 အချိုရည် 20% လျှော့စျေး',              cost: 300 },
  { id: 'sticker_pack', name_mm: '🎨 Gwave sticker pack',                    cost: 150 },
];
const rewardById = Object.fromEntries(REWARDS.map(r => [r.id, r]));
const genCode = () => 'GW-' + Array.from({ length: 6 },
  () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');

// ---- Personal Worlds validation ----
const WORLD_MAX_OBJECTS = 400, WORLD_MAX_BYTES = 64 * 1024, WORLD_MAX_NPC = 10;
const OBJ_TYPES = ['floor', 'wall', 'pillar', 'tree', 'lamp', 'prop', 'npc'];
const PROP_IDS = ['prop_bench', 'prop_stall', 'prop_planter'];
function validWorldData(data) {
  if (!data || typeof data !== 'object') return 'data မမှန်ပါ';
  if (!Array.isArray(data.objects)) return 'objects array လိုအပ်သည်';
  if (data.objects.length > WORLD_MAX_OBJECTS) return `object ${WORLD_MAX_OBJECTS} ခုထက် မကျော်ရ`;
  if (JSON.stringify(data).length > WORLD_MAX_BYTES) return 'world data ကြီးလွန်းသည် (64KB)';
  let npcCount = 0;
  for (const o of data.objects) {
    if (!OBJ_TYPES.includes(o.t)) return `မသိသော object type: ${o.t}`;
    if (o.t === 'prop' && !PROP_IDS.includes(o.prop)) return `မသိသော prop: ${o.prop}`;
    if (o.t === 'npc') {
      npcCount++;
      if (String(o.name || '').length > 24) return 'NPC နာမည် ရှည်လွန်းသည်';
      if (!Array.isArray(o.lines) || o.lines.length > 6) return 'NPC စကား ၆ ကြောင်းထက် မများရ';
      if (o.lines.some(l => String(l).length > 80)) return 'NPC စကားကြောင်း ရှည်လွန်းသည်';
    }
  }
  if (npcCount > WORLD_MAX_NPC) return `NPC ${WORLD_MAX_NPC} ယောက်ထက် မကျော်ရ`;
  return null;
}

// ============================================================
// Memory Store (dev)
// ============================================================
class MemStore {
  constructor() {
    this.players = new Map(); this.events = [];
    this.wallets = new Map(); this.ledger = [];
    this.inv = new Map(); this.questMap = new Map();
  }
  _stats(key, name) {
    if (!this.players.has(key))
      this.players.set(key, { player_key: key, name, kills: 0, deaths: 0, headshots: 0, xp: 0 });
    const p = this.players.get(key); p.name = name; return p;
  }
  _wallet(key, name) {
    if (!this.wallets.has(key))
      this.wallets.set(key, { player_key: key, name, points: 0, equipped_skin: null });
    const w = this.wallets.get(key); if (name) w.name = name; return w;
  }
  async earn(key, name, amount, reason) {
    const w = this._wallet(key, name);
    w.points += amount;
    this.ledger.push({ player_key: key, delta: amount, reason, at: new Date().toISOString() });
    return w.points;
  }
  async spend(key, amount, reason) {
    const w = this._wallet(key);
    if (w.points < amount) return { ok: false, points: w.points };
    w.points -= amount;
    this.ledger.push({ player_key: key, delta: -amount, reason, at: new Date().toISOString() });
    return { ok: true, points: w.points };
  }
  async addItem(key, itemId) {
    if (!this.inv.has(key)) this.inv.set(key, new Map());
    const m = this.inv.get(key);
    m.set(itemId, (m.get(itemId) || 0) + 1);
  }
  async setSkin(key, color) { this._wallet(key).equipped_skin = color; }
  async wallet(key) {
    const w = this._wallet(key);
    const inv = [...(this.inv.get(key) || new Map()).entries()]
      .map(([item_id, qty]) => ({ item_id, qty, ...(ITEMS.find(i => i.id === item_id) || {}) }));
    return { points: w.points, equipped_skin: w.equipped_skin, inventory: inv };
  }
  async questInc(key, name, questId, inc) {
    const day = today(), mapKey = `${key}:${day}`;
    if (!this.questMap.has(mapKey)) this.questMap.set(mapKey, {});
    const qs = this.questMap.get(mapKey);
    if (!qs[questId]) qs[questId] = { progress: 0, claimed: false };
    const q = qs[questId], def = questById[questId];
    q.progress += inc;
    if (!q.claimed && q.progress >= def.target) {
      q.claimed = true;
      await this.earn(key, name, def.reward, `quest:${questId}`);
      return { completed: true, ...def };
    }
    return { completed: false };
  }
  async quests(key) {
    const qs = this.questMap.get(`${key}:${today()}`) || {};
    return QUESTS.map(def => ({
      ...def,
      progress: Math.min(def.target, qs[def.id]?.progress || 0),
      claimed: !!qs[def.id]?.claimed,
    }));
  }
  async reportKill({ killer, victim, headshot }) {
    const k = this._stats(killer.key, killer.name);
    const v = this._stats(victim.key, victim.name);
    k.kills++; k.xp += XP.kill + (headshot ? XP.headshot : 0);
    if (headshot) k.headshots++;
    v.deaths++; v.xp += XP.death;
    this.events.push({ killer, victim, headshot, at: new Date().toISOString() });
    return { killer: k, victim: v };
  }
  async leaderboard(limit) {
    return [...this.players.values()].sort((a, b) => b.xp - a.xp).slice(0, limit);
  }
  async player(key) { return this.players.get(key) || null; }
}

// ============================================================
// Postgres Store (RDS)
// ============================================================
class PgStore {
  // url မပေးလျှင် pg က PGHOST/PGUSER/PGPASSWORD/PGDATABASE env များကိုယူသည် —
  // password ထဲ special char ပါလျှင် URL-encode ပြဿနာမရှိအောင် PG* ကို ဦးစားပေး
  constructor(url) {
    const { Pool } = require('pg');
    const local = (url || process.env.PGHOST || '').includes('localhost');
    this.pool = new Pool({
      ...(url ? { connectionString: url } : {}),
      ssl: local ? false : { rejectUnauthorized: false },
    });
  }
  async migrate() {
    await this.pool.query(`
      CREATE SCHEMA IF NOT EXISTS game;
      CREATE TABLE IF NOT EXISTS game.player_stats(
        player_key TEXT PRIMARY KEY, name TEXT NOT NULL,
        kills INT NOT NULL DEFAULT 0, deaths INT NOT NULL DEFAULT 0,
        headshots INT NOT NULL DEFAULT 0, xp INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS game.kill_events(
        id BIGSERIAL PRIMARY KEY, killer_key TEXT, killer_name TEXT,
        victim_key TEXT, victim_name TEXT, headshot BOOLEAN NOT NULL DEFAULT false,
        room TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS game.wallets(
        player_key TEXT PRIMARY KEY, name TEXT,
        points INT NOT NULL DEFAULT 0, equipped_skin TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS game.point_ledger(
        id BIGSERIAL PRIMARY KEY, player_key TEXT NOT NULL,
        delta INT NOT NULL, reason TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS game.inventory(
        player_key TEXT NOT NULL, item_id TEXT NOT NULL, qty INT NOT NULL DEFAULT 1,
        PRIMARY KEY (player_key, item_id));
      CREATE TABLE IF NOT EXISTS game.daily_quests(
        player_key TEXT NOT NULL, day DATE NOT NULL, quest_id TEXT NOT NULL,
        progress INT NOT NULL DEFAULT 0, claimed BOOLEAN NOT NULL DEFAULT false,
        PRIMARY KEY (player_key, day, quest_id));
      CREATE INDEX IF NOT EXISTS idx_stats_xp ON game.player_stats (xp DESC);
      CREATE INDEX IF NOT EXISTS idx_ledger_player ON game.point_ledger (player_key, created_at DESC);
    `);
    console.log('🗄️ RDS game.* tables ready (stats + wallets + inventory + quests)');
  }
  async earn(key, name, amount, reason) {
    await this.pool.query(`
      INSERT INTO game.wallets(player_key, name, points) VALUES ($1,$2,$3)
      ON CONFLICT (player_key) DO UPDATE SET
        points = game.wallets.points + $3, name = COALESCE($2, game.wallets.name), updated_at = now()
    `, [key, name, amount]);
    await this.pool.query(
      `INSERT INTO game.point_ledger(player_key, delta, reason) VALUES ($1,$2,$3)`,
      [key, amount, reason]);
    const r = await this.pool.query(`SELECT points FROM game.wallets WHERE player_key=$1`, [key]);
    return r.rows[0].points;
  }
  async spend(key, amount, reason) {
    const r = await this.pool.query(`
      UPDATE game.wallets SET points = points - $2, updated_at = now()
      WHERE player_key = $1 AND points >= $2 RETURNING points`, [key, amount]);
    if (!r.rows.length) {
      const cur = await this.pool.query(`SELECT points FROM game.wallets WHERE player_key=$1`, [key]);
      return { ok: false, points: cur.rows[0]?.points ?? 0 };
    }
    await this.pool.query(
      `INSERT INTO game.point_ledger(player_key, delta, reason) VALUES ($1,$2,$3)`,
      [key, -amount, reason]);
    return { ok: true, points: r.rows[0].points };
  }
  async addItem(key, itemId) {
    await this.pool.query(`
      INSERT INTO game.inventory(player_key, item_id, qty) VALUES ($1,$2,1)
      ON CONFLICT (player_key, item_id) DO UPDATE SET qty = game.inventory.qty + 1`,
      [key, itemId]);
  }
  async setSkin(key, color) {
    await this.pool.query(`UPDATE game.wallets SET equipped_skin=$2 WHERE player_key=$1`, [key, color]);
  }
  async wallet(key) {
    const w = await this.pool.query(
      `SELECT points, equipped_skin FROM game.wallets WHERE player_key=$1`, [key]);
    const inv = await this.pool.query(
      `SELECT item_id, qty FROM game.inventory WHERE player_key=$1`, [key]);
    return {
      points: w.rows[0]?.points ?? 0,
      equipped_skin: w.rows[0]?.equipped_skin ?? null,
      inventory: inv.rows.map(r => ({ ...r, ...(ITEMS.find(i => i.id === r.item_id) || {}) })),
    };
  }
  async questInc(key, name, questId, inc) {
    const def = questById[questId];
    const r = await this.pool.query(`
      INSERT INTO game.daily_quests(player_key, day, quest_id, progress)
      VALUES ($1, CURRENT_DATE, $2, $3)
      ON CONFLICT (player_key, day, quest_id) DO UPDATE SET
        progress = game.daily_quests.progress + $3
      RETURNING progress, claimed`, [key, questId, inc]);
    const { progress, claimed } = r.rows[0];
    if (!claimed && progress >= def.target) {
      await this.pool.query(`
        UPDATE game.daily_quests SET claimed = true
        WHERE player_key=$1 AND day=CURRENT_DATE AND quest_id=$2`, [key, questId]);
      await this.earn(key, name, def.reward, `quest:${questId}`);
      return { completed: true, ...def };
    }
    return { completed: false };
  }
  async quests(key) {
    const r = await this.pool.query(
      `SELECT quest_id, progress, claimed FROM game.daily_quests
       WHERE player_key=$1 AND day=CURRENT_DATE`, [key]);
    const map = Object.fromEntries(r.rows.map(x => [x.quest_id, x]));
    return QUESTS.map(def => ({
      ...def,
      progress: Math.min(def.target, map[def.id]?.progress || 0),
      claimed: !!map[def.id]?.claimed,
    }));
  }
  async _upsertStats(key, name, kills, deaths, headshots, xp) {
    await this.pool.query(`
      INSERT INTO game.player_stats(player_key, name, kills, deaths, headshots, xp)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (player_key) DO UPDATE SET
        name=$2, kills=game.player_stats.kills+$3, deaths=game.player_stats.deaths+$4,
        headshots=game.player_stats.headshots+$5, xp=game.player_stats.xp+$6, updated_at=now()
    `, [key, name, kills, deaths, headshots, xp]);
  }
  async reportKill({ killer, victim, headshot, room }) {
    await this._upsertStats(killer.key, killer.name, 1, 0, headshot ? 1 : 0, XP.kill + (headshot ? XP.headshot : 0));
    await this._upsertStats(victim.key, victim.name, 0, 1, 0, XP.death);
    await this.pool.query(
      `INSERT INTO game.kill_events(killer_key,killer_name,victim_key,victim_name,headshot,room)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [killer.key, killer.name, victim.key, victim.name, !!headshot, room || null]);
    return { killer: await this.player(killer.key), victim: await this.player(victim.key) };
  }
  async leaderboard(limit) {
    const r = await this.pool.query(
      `SELECT player_key, name, kills, deaths, headshots, xp
       FROM game.player_stats ORDER BY xp DESC LIMIT $1`, [limit]);
    return r.rows;
  }
  async player(key) {
    const r = await this.pool.query(
      `SELECT player_key, name, kills, deaths, headshots, xp
       FROM game.player_stats WHERE player_key=$1`, [key]);
    return r.rows[0] || null;
  }
}

// ============================================================
// v3 Extensions — Seasons / Redeem / Worlds / NFT (နှစ် store လုံး)
// ============================================================
Object.assign(MemStore.prototype, {
  async seasonBump(key, name, season, d) {
    const m = (this._seasonMap ||= new Map()), id = `${key}:${season}`;
    if (!m.has(id)) m.set(id, { player_key: key, name, season, kills: 0, deaths: 0, headshots: 0, xp: 0 });
    const r = m.get(id); r.name = name;
    r.kills += d.kills || 0; r.deaths += d.deaths || 0; r.headshots += d.headshots || 0; r.xp += d.xp || 0;
  },
  async seasonBoard(season, limit) {
    return [...(this._seasonMap || new Map()).values()]
      .filter(r => r.season === season).sort((a, b) => b.xp - a.xp).slice(0, limit);
  },
  async seasonFinalized(season) { return (this._finalized ||= new Set()).has(season); },
  async markSeasonReward(season, rank, key, name, gp) {
    (this._finalized ||= new Set()).add(season);
    (this._seasonRewards ||= []).push({ season, rank, player_key: key, name, gp });
  },
  async redeemCreate(key, rewardId, code) {
    (this._redemptions ||= new Map()).set(code,
      { code, player_key: key, reward_id: rewardId, status: 'pending', created_at: new Date().toISOString() });
  },
  async redemptionList(key) {
    return [...(this._redemptions || new Map()).values()].filter(r => r.player_key === key);
  },
  async posClaim(code) {
    const r = (this._redemptions || new Map()).get(code);
    if (!r) return { ok: false, error: 'Code မတွေ့ပါ' };
    if (r.status === 'claimed') return { ok: false, error: 'သုံးပြီးသား code ဖြစ်သည်' };
    r.status = 'claimed'; r.claimed_at = new Date().toISOString();
    return { ok: true, redemption: r };
  },
  async worldGet(key) { return (this._worlds || new Map()).get(key) || null; },
  async worldPut(key, name, data) {
    (this._worlds ||= new Map()).set(key,
      { owner_key: key, name, data, updated_at: new Date().toISOString() });
  },
  async worldsRecent(limit) {
    return [...(this._worlds || new Map()).values()]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, limit)
      .map(w => ({ owner_key: w.owner_key, name: w.name, updated_at: w.updated_at, objects: (w.data.objects || []).length }));
  },
  async nftGet(key, item) { return (this._nft || new Map()).get(`${key}:${item}`) || null; },
  async nftRecord(key, item, wallet, tx, tokenId) {
    (this._nft ||= new Map()).set(`${key}:${item}`,
      { player_key: key, item_id: item, wallet, tx_hash: tx, token_id: tokenId });
  },
  async nftList(key) { return [...(this._nft || new Map()).values()].filter(n => n.player_key === key); },
});

Object.assign(MemStore.prototype, {
  async walletLink(key, wallet) { (this._walletLinks ||= new Map()).set(key, wallet); },
  async walletOf(key) { return (this._walletLinks || new Map()).get(key) || null; },
  async seasonWins(key) {
    return (this._seasonRewards || []).filter(r => r.player_key === key)
      .map(r => ({ season: r.season, rank: r.rank, gp: r.gp }));
  },
  async seasonRankOf(key, season) {
    const r = (this._seasonRewards || []).find(x => x.player_key === key && x.season === season);
    return r ? r.rank : null;
  },
});

Object.assign(PgStore.prototype, {
  async walletLink(key, wallet) {
    await this.pool.query(`
      INSERT INTO game.wallet_links(player_key, wallet) VALUES ($1,$2)
      ON CONFLICT (player_key) DO UPDATE SET wallet=$2, updated_at=now()`, [key, wallet]);
  },
  async walletOf(key) {
    const r = await this.pool.query(`SELECT wallet FROM game.wallet_links WHERE player_key=$1`, [key]);
    return r.rows[0]?.wallet || null;
  },
  async seasonWins(key) {
    const r = await this.pool.query(`
      SELECT season, rank, gp FROM game.season_rewards WHERE player_key=$1 ORDER BY created_at DESC`, [key]);
    return r.rows;
  },
  async seasonRankOf(key, season) {
    const r = await this.pool.query(`
      SELECT rank FROM game.season_rewards WHERE player_key=$1 AND season=$2`, [key, season]);
    return r.rows[0]?.rank ?? null;
  },
  async migrateV3() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS game.season_stats(
        player_key TEXT NOT NULL, name TEXT, season TEXT NOT NULL,
        kills INT NOT NULL DEFAULT 0, deaths INT NOT NULL DEFAULT 0,
        headshots INT NOT NULL DEFAULT 0, xp INT NOT NULL DEFAULT 0,
        PRIMARY KEY (player_key, season));
      CREATE TABLE IF NOT EXISTS game.season_rewards(
        season TEXT NOT NULL, rank INT NOT NULL, player_key TEXT, name TEXT, gp INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (season, rank));
      CREATE TABLE IF NOT EXISTS game.redemptions(
        code TEXT PRIMARY KEY, player_key TEXT NOT NULL, reward_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(), claimed_at TIMESTAMPTZ);
      CREATE TABLE IF NOT EXISTS game.worlds(
        owner_key TEXT PRIMARY KEY, name TEXT, data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS game.nft_mints(
        player_key TEXT NOT NULL, item_id TEXT NOT NULL, wallet TEXT, tx_hash TEXT, token_id INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (player_key, item_id));
      CREATE TABLE IF NOT EXISTS game.wallet_links(
        player_key TEXT PRIMARY KEY, wallet TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE INDEX IF NOT EXISTS idx_season_xp ON game.season_stats (season, xp DESC);
    `);
  },
  async seasonBump(key, name, season, d) {
    await this.pool.query(`
      INSERT INTO game.season_stats(player_key, name, season, kills, deaths, headshots, xp)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (player_key, season) DO UPDATE SET
        name=$2, kills=game.season_stats.kills+$4, deaths=game.season_stats.deaths+$5,
        headshots=game.season_stats.headshots+$6, xp=game.season_stats.xp+$7
    `, [key, name, season, d.kills || 0, d.deaths || 0, d.headshots || 0, d.xp || 0]);
  },
  async seasonBoard(season, limit) {
    const r = await this.pool.query(`
      SELECT player_key, name, kills, deaths, headshots, xp
      FROM game.season_stats WHERE season=$1 ORDER BY xp DESC LIMIT $2`, [season, limit]);
    return r.rows;
  },
  async seasonFinalized(season) {
    const r = await this.pool.query(`SELECT 1 FROM game.season_rewards WHERE season=$1 LIMIT 1`, [season]);
    return !!r.rows.length;
  },
  async markSeasonReward(season, rank, key, name, gp) {
    await this.pool.query(`
      INSERT INTO game.season_rewards(season, rank, player_key, name, gp)
      VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [season, rank, key, name, gp]);
  },
  async redeemCreate(key, rewardId, code) {
    await this.pool.query(`
      INSERT INTO game.redemptions(code, player_key, reward_id) VALUES ($1,$2,$3)`,
      [code, key, rewardId]);
  },
  async redemptionList(key) {
    const r = await this.pool.query(`
      SELECT code, reward_id, status, created_at FROM game.redemptions
      WHERE player_key=$1 ORDER BY created_at DESC LIMIT 20`, [key]);
    return r.rows;
  },
  async posClaim(code) {
    const r = await this.pool.query(`
      UPDATE game.redemptions SET status='claimed', claimed_at=now()
      WHERE code=$1 AND status='pending' RETURNING *`, [code]);
    if (r.rows.length) return { ok: true, redemption: r.rows[0] };
    const exists = await this.pool.query(`SELECT status FROM game.redemptions WHERE code=$1`, [code]);
    return { ok: false, error: exists.rows.length ? 'သုံးပြီးသား code ဖြစ်သည်' : 'Code မတွေ့ပါ' };
  },
  async worldGet(key) {
    const r = await this.pool.query(`SELECT owner_key, name, data, updated_at FROM game.worlds WHERE owner_key=$1`, [key]);
    return r.rows[0] || null;
  },
  async worldPut(key, name, data) {
    await this.pool.query(`
      INSERT INTO game.worlds(owner_key, name, data) VALUES ($1,$2,$3)
      ON CONFLICT (owner_key) DO UPDATE SET name=$2, data=$3, updated_at=now()`,
      [key, name, JSON.stringify(data)]);
  },
  async worldsRecent(limit) {
    const r = await this.pool.query(`
      SELECT owner_key, name, updated_at, jsonb_array_length(data->'objects') AS objects
      FROM game.worlds ORDER BY updated_at DESC LIMIT $1`, [limit]);
    return r.rows;
  },
  async nftGet(key, item) {
    const r = await this.pool.query(`SELECT * FROM game.nft_mints WHERE player_key=$1 AND item_id=$2`, [key, item]);
    return r.rows[0] || null;
  },
  async nftRecord(key, item, wallet, tx, tokenId) {
    await this.pool.query(`
      INSERT INTO game.nft_mints(player_key, item_id, wallet, tx_hash, token_id)
      VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [key, item, wallet, tx, tokenId]);
  },
  async nftList(key) {
    const r = await this.pool.query(`SELECT item_id, wallet, tx_hash, token_id FROM game.nft_mints WHERE player_key=$1`, [key]);
    return r.rows;
  },
});

// ============================================================
// App
// ============================================================
async function main() {
  let store;
  if (process.env.DATABASE_URL || process.env.PGHOST) { store = new PgStore(process.env.DATABASE_URL); await store.migrate(); await store.migrateV3(); }
  else { store = new MemStore(); console.log('⚠️ DATABASE_URL မရှိ — memory mode (dev)'); }
  await chain.init();

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'content-type, x-game-key');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  const needKey = (req, res, next) =>
    req.get('x-game-key') === GAME_KEY ? next() : res.status(401).json({ error: 'invalid game key' });

  // ---------- Kill report → XP + GP + streak bonus + quests ----------
  app.post('/report/kill', needKey, async (req, res) => {
    const { killer, victim, headshot, room, streak } = req.body || {};
    if (!killer?.key || !victim?.key) return res.status(400).json({ error: 'killer/victim required' });

    const stats = await store.reportKill({ killer, victim, headshot: !!headshot, room });

    // Season stats (weekly + monthly) — killer နှင့် victim နှစ်ဦးလုံး
    for (const season of [weeklyId(), monthlyId()]) {
      await store.seasonBump(killer.key, killer.name, season,
        { kills: 1, headshots: headshot ? 1 : 0, xp: XP.kill + (headshot ? XP.headshot : 0) });
      await store.seasonBump(victim.key, victim.name, season, { deaths: 1, xp: XP.death });
    }

    // GP earn + ledger
    const earned = [{ reason: 'kill', amount: GP.kill }];
    await store.earn(killer.key, killer.name, GP.kill, 'kill');
    if (headshot) { earned.push({ reason: 'headshot', amount: GP.headshot }); await store.earn(killer.key, killer.name, GP.headshot, 'headshot'); }
    if (streak === 3) { earned.push({ reason: 'streak3', amount: GP.streak3 }); await store.earn(killer.key, killer.name, GP.streak3, 'streak:3'); }
    if (streak === 5) { earned.push({ reason: 'streak5', amount: GP.streak5 }); await store.earn(killer.key, killer.name, GP.streak5, 'streak:5'); }

    // Daily quests
    const completedQuests = [];
    const q1 = await store.questInc(killer.key, killer.name, 'daily_kills', 1);
    if (q1.completed) completedQuests.push(q1);
    if (headshot) {
      const q2 = await store.questInc(killer.key, killer.name, 'daily_headshot', 1);
      if (q2.completed) completedQuests.push(q2);
    }

    const wallet = await store.wallet(killer.key);
    res.json({ ok: true, ...stats, points: wallet.points, earned, completedQuests });
  });

  // ---------- Login report → daily_login quest ----------
  app.post('/report/login', needKey, async (req, res) => {
    const { player } = req.body || {};
    if (!player?.key) return res.status(400).json({ error: 'player required' });
    const completedQuests = [];
    const q = await store.questInc(player.key, player.name, 'daily_login', 1);
    if (q.completed) completedQuests.push(q);
    const wallet = await store.wallet(player.key);
    res.json({ ok: true, points: wallet.points, equipped_skin: wallet.equipped_skin, completedQuests });
  });

  // ---------- Shop / Wallet / Quests ----------
  app.get('/shop', (req, res) => res.json({ items: ITEMS }));

  app.post('/shop/buy', needKey, async (req, res) => {
    const { player, item_id } = req.body || {};
    const item = ITEMS.find(i => i.id === item_id);
    if (!player?.key || !item) return res.status(400).json({ error: 'player/item_id required' });
    const spend = await store.spend(player.key, item.price, `buy:${item_id}`);
    if (!spend.ok) return res.json({ ok: false, error: 'GP မလုံလောက်ပါ', points: spend.points, need: item.price });
    await store.addItem(player.key, item_id);
    if (item.type === 'skin') await store.setSkin(player.key, item.color);
    res.json({ ok: true, points: spend.points, item, equipped_skin: item.type === 'skin' ? item.color : undefined });
  });

  app.get('/wallet/:key', async (req, res) => res.json(await store.wallet(req.params.key)));
  app.get('/quests/:key', async (req, res) => res.json({ quests: await store.quests(req.params.key) }));

  // ---------- Stats reads ----------
  app.get('/leaderboard', async (req, res) => {
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const season = req.query.season; // alltime (default) | weekly | monthly | W2026-32 | M2026-08
    if (!season || season === 'alltime')
      return res.json({ season: 'alltime', leaderboard: await store.leaderboard(limit) });
    const id = season === 'weekly' ? weeklyId() : season === 'monthly' ? monthlyId() : season;
    res.json({ season: id, leaderboard: await store.seasonBoard(id, limit) });
  });
  app.get('/player/:key', async (req, res) => {
    const p = await store.player(req.params.key);
    if (!p) return res.status(404).json({ error: 'not found' });
    res.json(p);
  });
  // ---------- Seasons — finalize + ဆုပေး ----------
  async function finalizeSeason(seasonId) {
    if (await store.seasonFinalized(seasonId)) return { ok: true, already: true };
    const top = await store.seasonBoard(seasonId, 3);
    const rewards = [];
    for (let i = 0; i < top.length; i++) {
      const gp = SEASON_GP[i];
      await store.earn(top[i].player_key, top[i].name, gp, `season:${seasonId}:rank${i + 1}`);
      await store.markSeasonReward(seasonId, i + 1, top[i].player_key, top[i].name, gp);
      rewards.push({ rank: i + 1, name: top[i].name, gp });
    }
    if (!top.length) await store.markSeasonReward(seasonId, 0, null, null, 0); // empty season လည်း finalized
    console.log(`🏁 Season ${seasonId} finalized —`, rewards.map(r => `#${r.rank} ${r.name} +${r.gp}GP`).join(', ') || 'empty');
    return { ok: true, rewards };
  }
  app.get('/season/current', (req, res) =>
    res.json({ weekly: weeklyId(), monthly: monthlyId(), rewards_gp: SEASON_GP }));
  app.post('/season/finalize', needKey, async (req, res) =>
    res.json(await finalizeSeason(req.body?.season || prevWeeklyId())));
  // နာရီစဉ် — ပြီးသွားသော week/month များ အလိုအလျောက် finalize
  setInterval(() => { finalizeSeason(prevWeeklyId()); finalizeSeason(prevMonthlyId()); }, 3600_000);

  // ---------- POS Redeem (GP ↔ ကော်ဖီဆိုင် promo) ----------
  app.get('/rewards', (req, res) => res.json({ rewards: REWARDS }));

  app.post('/redeem', needKey, async (req, res) => {
    const { player, reward_id } = req.body || {};
    const reward = rewardById[reward_id];
    if (!player?.key || !reward) return res.status(400).json({ error: 'player/reward_id required' });
    const spend = await store.spend(player.key, reward.cost, `redeem:${reward_id}`);
    if (!spend.ok) return res.json({ ok: false, error: 'GP မလုံလောက်ပါ', points: spend.points, need: reward.cost });
    const code = genCode();
    await store.redeemCreate(player.key, reward_id, code);
    res.json({ ok: true, code, reward, points: spend.points });
  });

  app.get('/redemptions/:key', async (req, res) =>
    res.json({ redemptions: await store.redemptionList(req.params.key) }));

  // ဆိုင်ကောင်တာ POS — code စစ်ပြီး claim (x-pos-key လိုအပ်)
  app.post('/pos/claim', async (req, res) => {
    if (req.get('x-pos-key') !== POS_KEY) return res.status(401).json({ error: 'invalid pos key' });
    const out = await store.posClaim(String(req.body?.code || '').trim().toUpperCase());
    if (out.ok) out.reward = rewardById[out.redemption.reward_id];
    res.json(out);
  });

  // ---------- Personal Worlds (ကိုယ်ပိုင် metaverse ကမ္ဘာ) ----------
  app.get('/world/:key', async (req, res) => {
    const w = await store.worldGet(req.params.key);
    if (!w) return res.status(404).json({ error: 'world မရှိသေးပါ' });
    res.json(w);
  });
  app.put('/world', needKey, async (req, res) => {
    const { owner, name, data } = req.body || {};
    if (!owner?.key) return res.status(400).json({ error: 'owner required' });
    const err = validWorldData(data);
    if (err) return res.status(400).json({ error: err });
    await store.worldPut(owner.key, String(name || `${owner.name} ရဲ့ကမ္ဘာ`).slice(0, 40), data);
    res.json({ ok: true });
  });
  app.get('/worlds/recent', async (req, res) =>
    res.json({ worlds: await store.worldsRecent(Math.min(20, parseInt(req.query.limit) || 10)) }));

  // ---------- NFT Mint (Web3 Phase 1 — testnet) ----------
  app.post('/nft/mint', needKey, async (req, res) => {
    const { player, item_id, wallet } = req.body || {};
    if (!player?.key || !item_id || !wallet) return res.status(400).json({ error: 'player/item_id/wallet required' });
    const w = await store.wallet(player.key);
    if (!w.inventory.some(i => i.item_id === item_id))
      return res.json({ ok: false, error: 'ဒီ skin ကို မပိုင်ဆိုင်သေးပါ — ဂိမ်းထဲမှာ အရင်ဝယ်ပါ' });
    const existing = await store.nftGet(player.key, item_id);
    if (existing) return res.json({ ok: false, error: 'NFT ထုတ်ပြီးသား ဖြစ်သည်', mint: existing });
    const out = await chain.mintSkin(wallet, item_id);
    if (!out.ok) return res.json(out);
    await store.nftRecord(player.key, item_id, wallet, out.tx_hash, out.token_id);
    await store.walletLink(player.key, wallet); // trophy claim အတွက် wallet မှတ်ထား
    res.json({ ok: true, ...out, item_id });
  });

  // ---------- Season NFT Trophies (🏆 season ဆုကို on-chain trophy) ----------
  app.get('/trophies/:key', async (req, res) => {
    const won = await store.seasonWins(req.params.key);
    const mints = await store.nftList(req.params.key);
    const minted = new Set(mints.filter(m => m.item_id.startsWith('trophy_')).map(m => m.item_id));
    res.json({
      trophies: won.filter(w => w.rank >= 1).map(w => ({
        ...w, item_id: `trophy_${w.season}_r${w.rank}`,
        minted: minted.has(`trophy_${w.season}_r${w.rank}`),
      })),
      chain_mode: chain.MODE,
    });
  });
  app.post('/trophy/mint', needKey, async (req, res) => {
    const { player, season, wallet } = req.body || {};
    if (!player?.key || !season || !wallet) return res.status(400).json({ error: 'player/season/wallet required' });
    const rank = await store.seasonRankOf(player.key, season);
    if (!rank || rank < 1) return res.json({ ok: false, error: 'ဒီ season မှာ ဆုမရခဲ့ပါ' });
    const itemId = `trophy_${season}_r${rank}`;
    if (await store.nftGet(player.key, itemId)) return res.json({ ok: false, error: 'Trophy ထုတ်ပြီးသား ဖြစ်သည်' });
    const out = await chain.mintSkin(wallet, itemId);
    if (!out.ok) return res.json(out);
    await store.nftRecord(player.key, itemId, wallet, out.tx_hash, out.token_id);
    await store.walletLink(player.key, wallet);
    res.json({ ok: true, ...out, item_id: itemId, season, rank });
  });
  app.get('/nft/:key', async (req, res) =>
    res.json({ mints: await store.nftList(req.params.key), chain_mode: chain.MODE }));

  app.get('/health', (req, res) => res.json({ ok: true, db: !!(process.env.DATABASE_URL || process.env.PGHOST), chain: chain.MODE }));

  app.listen(PORT, () =>
    console.log(`📊 Gwave Stats+Economy API v2 — http://localhost:${PORT} | db: ${process.env.DATABASE_URL || process.env.PGHOST ? 'RDS' : 'memory'}`));
}
main().catch(e => { console.error(e); process.exit(1); });
