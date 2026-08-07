// ============================================================
// api/server.js — Gwave Game Stats REST API (P7 ပုံစံအတိုင်း)
// Kill/XP stats များကို RDS Postgres `game.*` tables ထဲ သိမ်း
//
// ✔ POST /report/kill   — game server မှသာ (x-game-key header လိုအပ်)
// ✔ GET  /leaderboard   — public (gwave.cc website ကပါ တိုက်ရိုက်ခေါ်နိုင်)
// ✔ GET  /player/:key   — public (ကစားသမားတစ်ဦးချင်း stats)
// ✔ RDS auto-migration  — game.player_stats + game.kill_events
// ✔ DATABASE_URL မရှိလျှင် memory fallback (dev အတွက်)
//
// XP စည်းမျဉ်း — kill +25 | headshot bonus +10 | death +5 (ပါဝင်မှုဆု)
//
// Run (dev):  npm install && npm start                       (memory mode)
// Run (RDS):  DATABASE_URL=postgres://user:pw@rds-host:5432/gwave \
//             GAME_KEY=super-secret npm start
// ============================================================
const express = require('express');

const PORT = process.env.PORT || 8790;
const GAME_KEY = process.env.GAME_KEY || 'dev-key';
const XP_KILL = 25, XP_HEADSHOT = 10, XP_DEATH = 5;

// ---------- Store abstraction — Postgres (RDS) သို့ Memory ----------
class MemStore {
  constructor() { this.players = new Map(); this.events = []; }
  _get(key, name) {
    if (!this.players.has(key))
      this.players.set(key, { player_key: key, name, kills: 0, deaths: 0, headshots: 0, xp: 0 });
    const p = this.players.get(key); p.name = name; return p;
  }
  async reportKill({ killer, victim, headshot, room }) {
    const k = this._get(killer.key, killer.name);
    const v = this._get(victim.key, victim.name);
    k.kills++; k.xp += XP_KILL + (headshot ? XP_HEADSHOT : 0);
    if (headshot) k.headshots++;
    v.deaths++; v.xp += XP_DEATH;
    this.events.push({ ...arguments[0], created_at: new Date().toISOString() });
    return { killer: k, victim: v };
  }
  async leaderboard(limit) {
    return [...this.players.values()].sort((a, b) => b.xp - a.xp).slice(0, limit);
  }
  async player(key) { return this.players.get(key) || null; }
}

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
        player_key TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        kills      INT NOT NULL DEFAULT 0,
        deaths     INT NOT NULL DEFAULT 0,
        headshots  INT NOT NULL DEFAULT 0,
        xp         INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS game.kill_events(
        id          BIGSERIAL PRIMARY KEY,
        killer_key  TEXT, killer_name TEXT,
        victim_key  TEXT, victim_name TEXT,
        headshot    BOOLEAN NOT NULL DEFAULT false,
        room        TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_stats_xp ON game.player_stats (xp DESC);
    `);
    console.log('🗄️ RDS game.* tables ready');
  }
  async _upsert(key, name, kills, deaths, headshots, xp) {
    await this.pool.query(`
      INSERT INTO game.player_stats(player_key, name, kills, deaths, headshots, xp)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (player_key) DO UPDATE SET
        name = $2,
        kills = game.player_stats.kills + $3,
        deaths = game.player_stats.deaths + $4,
        headshots = game.player_stats.headshots + $5,
        xp = game.player_stats.xp + $6,
        updated_at = now()
    `, [key, name, kills, deaths, headshots, xp]);
  }
  async reportKill({ killer, victim, headshot, room }) {
    await this._upsert(killer.key, killer.name, 1, 0, headshot ? 1 : 0, XP_KILL + (headshot ? XP_HEADSHOT : 0));
    await this._upsert(victim.key, victim.name, 0, 1, 0, XP_DEATH);
    await this.pool.query(
      `INSERT INTO game.kill_events(killer_key,killer_name,victim_key,victim_name,headshot,room)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [killer.key, killer.name, victim.key, victim.name, !!headshot, room || null]
    );
    return {
      killer: await this.player(killer.key),
      victim: await this.player(victim.key),
    };
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
       FROM game.player_stats WHERE player_key = $1`, [key]);
    return r.rows[0] || null;
  }
}

// ---------- App ----------
async function main() {
  let store;
  if (process.env.DATABASE_URL || process.env.PGHOST) {
    store = new PgStore(process.env.DATABASE_URL);
    await store.migrate();
  } else {
    store = new MemStore();
    console.log('⚠️ DATABASE_URL မရှိ — memory mode (dev)');
  }

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { // CORS — gwave.cc website ကပါ ခေါ်နိုင်ရန်
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'content-type, x-game-key');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Game server မှသာ ခေါ်ခွင့်ရှိ — GAME_KEY စစ်ဆေး
  app.post('/report/kill', async (req, res) => {
    if (req.get('x-game-key') !== GAME_KEY)
      return res.status(401).json({ error: 'invalid game key' });
    const { killer, victim, headshot, room } = req.body || {};
    if (!killer?.key || !victim?.key)
      return res.status(400).json({ error: 'killer/victim required' });
    const out = await store.reportKill({ killer, victim, headshot: !!headshot, room });
    res.json({ ok: true, ...out });
  });

  app.get('/leaderboard', async (req, res) => {
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    res.json({ leaderboard: await store.leaderboard(limit) });
  });

  app.get('/player/:key', async (req, res) => {
    const p = await store.player(req.params.key);
    if (!p) return res.status(404).json({ error: 'not found' });
    res.json(p);
  });

  app.get('/health', (req, res) =>
    res.json({ ok: true, db: !!(process.env.DATABASE_URL || process.env.PGHOST) }));

  app.listen(PORT, () =>
    console.log(`📊 Gwave Stats API — http://localhost:${PORT} | db: ${process.env.DATABASE_URL ? 'RDS' : 'memory'}`));
}
main().catch(e => { console.error(e); process.exit(1); });
